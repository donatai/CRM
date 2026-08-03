import { sql } from "~/db";

// ---------------------------------------------------------------------------
// Content Discovery Engine.
//
// Finds trending security-related content for the social scheduler's "Discover"
// tab and stores it in the `discovered_content` table so results persist
// between runs. Sources:
//   - X/Twitter API v2 search/recent (OAuth 1.0a, same signing as social-posting)
//   - Google News RSS feeds (no API key required)
//
// Graceful degradation: each source is independent — if one fails the others
// still contribute, and failures are surfaced as `warnings` on the result.
//
// NOTE: node:crypto is only ever imported inside functions (never at module top
// level) so this module stays safe for the client bundle, which imports it
// through social-api.ts.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiscoveredMetrics {
  retweets?: number;
  likes?: number;
  replies?: number;
  views?: number;
}

export interface DiscoveredContent {
  id: number;
  source: "x" | "rss";
  source_id: string;
  author: string | null;
  title: string | null;
  text: string | null;
  snippet: string | null;
  url: string;
  metrics: DiscoveredMetrics | null;
  discovered_at: string;
  status: "new" | "reposted" | "dismissed";
  created_at: string;
}

export interface DiscoveryResult {
  items: DiscoveredContent[];
  warnings: string[];
  ran_at: string;
}

export interface RepostResult {
  success: boolean;
  post?: {
    id: number;
    title: string;
    platform: string;
    status: string;
    scheduled_at: string | null;
  };
  error?: string;
}

/** A fresh (not-yet-stored) discovered item. */
interface NewItem {
  source: "x" | "rss";
  source_id: string;
  author: string | null;
  title: string | null;
  text: string | null;
  snippet: string | null;
  url: string;
  metrics: DiscoveredMetrics | null;
}

interface SourceResult<T> {
  items: T[];
  error?: string;
}

interface XTweet {
  id: string;
  username: string;
  text: string;
  metrics: DiscoveredMetrics;
}

interface RssArticle {
  title: string;
  link: string;
  source: string;
  snippet: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const X_KEYWORDS = [
  '"security guard"',
  '"event security"',
  '"executive protection"',
  '"private security"',
  '"construction site security"',
  '"security company"',
];

const X_SEARCH_URL = "https://api.x.com/2/tweets/search/recent";
const X_MAX_RESULTS = "10";

const RSS_FEEDS: { label: string; query: string }[] = [
  {
    label: "Google News — Security Guard Company",
    query: '"security guard company" OR "security industry"',
  },
  {
    label: "Google News — Security Events & Protection",
    query: '"event security" OR "executive protection" OR "private security" OR "construction site security"',
  },
];

const RSS_PER_FEED = 8;
const MAX_MERGED_ITEMS = 20;
const REQUEST_TIMEOUT_MS = 20_000;

// Scheduled discovery: Tuesday and Friday at 09:00 UTC.
const DISCOVERY_RUN_KEY = "discovery_last_run";
const DISCOVERY_DAYS_UTC = [2, 5]; // 0 = Sunday … 6 = Saturday
const DISCOVERY_HOUR_UTC = 9;
const SCHEDULER_INTERVAL_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** RFC 3986 percent-encoding (as required by OAuth 1.0a). */
function pctEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function truncate(str: string, max: number): string {
  const s = str.trim().replace(/\s+/g, " ");
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function decodeEntities(str: string): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function stripHtml(str: string): string {
  return str
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
  return re.exec(block)?.[1] ?? "";
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function guessVertical(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("executive protection") || t.includes("close protection")) {
    return "executive_protection";
  }
  if (
    t.includes("event security") ||
    t.includes("crowd control") ||
    t.includes("concert") ||
    t.includes("festival") ||
    t.includes("venue")
  ) {
    return "events";
  }
  if (
    t.includes("private security") ||
    t.includes("residential") ||
    t.includes("homeowner") ||
    t.includes("private client")
  ) {
    return "private_clients";
  }
  return "post_arm_guards"; // security guard, construction site, commercial, etc.
}

// ---------------------------------------------------------------------------
// Source 1: X (Twitter) API v2 — search/recent with OAuth 1.0a signing
// ---------------------------------------------------------------------------

async function searchX(): Promise<SourceResult<XTweet>> {
  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;
  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    return {
      items: [],
      error:
        "X search skipped — credentials not configured (need X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET)",
    };
  }

  const { createHmac, randomBytes } = await import("node:crypto");

  const query = `${X_KEYWORDS.join(" OR ")} -is:retweet lang:en`;
  const params: Record<string, string> = {
    query,
    max_results: X_MAX_RESULTS,
    "tweet.fields": "public_metrics,author_id,created_at",
    expansions: "author_id",
    "user.fields": "username",
  };
  const queryString = Object.entries(params)
    .map(([k, v]) => `${pctEncode(k)}=${pctEncode(v)}`)
    .join("&");
  const fullUrl = `${X_SEARCH_URL}?${queryString}`;

  const oauth: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };
  const paramString = Object.keys(oauth)
    .sort()
    .map((k) => `${pctEncode(k)}=${pctEncode(oauth[k] ?? "")}`)
    .join("&");
  const signatureBase = `GET&${pctEncode(fullUrl)}&${pctEncode(paramString)}`;
  const signingKey = `${pctEncode(apiSecret)}&${pctEncode(accessTokenSecret)}`;
  const signature = createHmac("sha1", signingKey)
    .update(signatureBase)
    .digest("base64");
  const header =
    "OAuth " +
    Object.entries({ ...oauth, oauth_signature: signature })
      .map(([k, v]) => `${pctEncode(k)}="${pctEncode(v)}"`)
      .join(", ");

  let res: Response;
  try {
    res = await fetch(fullUrl, {
      method: "GET",
      headers: { Authorization: header },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    return { items: [], error: `X search request failed: ${errMessage(err)}` };
  }

  const json = (await res.json().catch(() => null)) as {
    data?: { id: string; text: string; author_id?: string; public_metrics?: Record<string, number> }[];
    includes?: { users?: { id: string; username: string }[] };
    errors?: { message?: string }[];
    detail?: string;
    title?: string;
  } | null;

  if (!res.ok || !json?.data) {
    const msg =
      json?.errors?.[0]?.message ??
      json?.detail ??
      json?.title ??
      `X search failed (HTTP ${res.status})`;
    return { items: [], error: msg };
  }

  const usernames = new Map(
    (json.includes?.users ?? []).map((u) => [u.id, u.username]),
  );

  const items: XTweet[] = json.data.map((tweet) => {
    const m = tweet.public_metrics ?? {};
    const username = tweet.author_id ? (usernames.get(tweet.author_id) ?? "unknown") : "unknown";
    return {
      id: tweet.id,
      username,
      text: tweet.text,
      metrics: {
        retweets: m.retweet_count ?? 0,
        likes: m.like_count ?? 0,
        replies: m.reply_count ?? 0,
        views: m.impression_count ?? 0,
      },
    };
  });
  return { items };
}

// ---------------------------------------------------------------------------
// Source 2: Google News RSS (no API key required)
// ---------------------------------------------------------------------------

async function fetchRssNews(): Promise<SourceResult<RssArticle>> {
  const errors: string[] = [];
  const seen = new Set<string>();
  const items: RssArticle[] = [];

  for (const feed of RSS_FEEDS) {
    const url =
      "https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en&q=" +
      encodeURIComponent(feed.query);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (no602-content-discovery; +https://no602.ctonew.app)",
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        errors.push(`${feed.label}: HTTP ${res.status}`);
        continue;
      }
      const xml = await res.text();
      const parsed = parseGoogleNewsRss(xml);
      for (const article of parsed) {
        const key = article.title.toLowerCase().trim();
        if (seen.has(key) || items.length >= RSS_PER_FEED) continue;
        seen.add(key);
        items.push(article);
      }
    } catch (err) {
      errors.push(`${feed.label}: ${errMessage(err)}`);
    }
  }

  return errors.length > 0 ? { items, error: errors.join("; ") } : { items };
}

function parseGoogleNewsRss(xml: string): RssArticle[] {
  const articles: RssArticle[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;
  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[1];
    const title = decodeEntities(extractTag(block, "title")).trim();
    if (!title) continue;
    const link = decodeEntities(extractTag(block, "link")).trim();
    if (!link) continue;
    const sourceMatch = /<source[^>]*>([\s\S]*?)<\/source>/.exec(block);
    const source = sourceMatch ? decodeEntities(sourceMatch[1]).trim() : "";
    const desc = decodeEntities(extractTag(block, "description"));
    const snippet = stripHtml(desc);
    articles.push({ title, link, source, snippet });
  }
  return articles;
}

// ---------------------------------------------------------------------------
// Merge + dedupe
// ---------------------------------------------------------------------------

function mergeDedupe(xItems: XTweet[], rssItems: RssArticle[]): NewItem[] {
  const out: NewItem[] = [];
  const seen = new Set<string>();

  for (const t of xItems) {
    const key = `x:${t.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      source: "x",
      source_id: t.id,
      author: `@${t.username}`,
      title: null,
      text: t.text,
      snippet: null,
      url: `https://x.com/${t.username}/status/${t.id}`,
      metrics: t.metrics,
    });
  }

  for (const a of rssItems) {
    const key = `rss:${a.title.toLowerCase().trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      source: "rss",
      source_id: a.link,
      author: a.source || null,
      title: a.title,
      text: null,
      snippet: a.snippet || null,
      url: a.link,
      metrics: null,
    });
  }

  return out.slice(0, MAX_MERGED_ITEMS);
}

// ---------------------------------------------------------------------------
// Storage — discovered_content table + receptionist_settings run bookkeeping
// ---------------------------------------------------------------------------

export async function ensureDiscoveredTable(): Promise<void> {
  const s = sql();
  await s`CREATE TABLE IF NOT EXISTS discovered_content (
    id SERIAL PRIMARY KEY,
    source TEXT NOT NULL CHECK (source IN ('x', 'rss')),
    source_id TEXT NOT NULL,
    author TEXT,
    title TEXT,
    text TEXT,
    snippet TEXT,
    url TEXT NOT NULL,
    metrics JSONB,
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reposted', 'dismissed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source, source_id)
  )`;
  await s`CREATE INDEX IF NOT EXISTS idx_discovered_content_status ON discovered_content(status)`;
  await s`CREATE INDEX IF NOT EXISTS idx_discovered_content_discovered_at ON discovered_content(discovered_at)`;
}

async function ensureSettingsTable(): Promise<void> {
  const s = sql();
  await s`CREATE TABLE IF NOT EXISTS receptionist_settings (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}

function coerceDiscovered(row: Record<string, unknown>): DiscoveredContent {
  return {
    id: Number(row.id),
    source: String(row.source) === "rss" ? "rss" : "x",
    source_id: String(row.source_id),
    author: row.author ? String(row.author) : null,
    title: row.title ? String(row.title) : null,
    text: row.text ? String(row.text) : null,
    snippet: row.snippet ? String(row.snippet) : null,
    url: String(row.url),
    metrics: row.metrics ? (row.metrics as DiscoveredMetrics) : null,
    discovered_at: String(row.discovered_at),
    status: (String(row.status) as DiscoveredContent["status"]) ?? "new",
    created_at: String(row.created_at),
  };
}

async function storeItems(items: NewItem[]): Promise<DiscoveredContent[]> {
  const s = sql();
  for (const it of items) {
    await s`
      INSERT INTO discovered_content (source, source_id, author, title, text, snippet, url, metrics, status)
      VALUES (${it.source}, ${it.source_id}, ${it.author}, ${it.title}, ${it.text}, ${it.snippet}, ${it.url}, ${it.metrics ? JSON.stringify(it.metrics) : null}, 'new')
      ON CONFLICT (source, source_id) DO NOTHING
    `;
  }
  // Newest first; keep previously-reposted items so they show as dimmed.
  const rows = await s`
    SELECT * FROM discovered_content
    WHERE status <> 'dismissed'
    ORDER BY (status = 'new') DESC, discovered_at DESC
    LIMIT ${MAX_MERGED_ITEMS}
  `;
  return (rows as Record<string, unknown>[]).map(coerceDiscovered);
}

// ---------------------------------------------------------------------------
// Public API — discovery
// ---------------------------------------------------------------------------

/**
 * Runs a full discovery pass: queries X and the RSS feeds, merges + dedupes the
 * results, persists new items to `discovered_content`, and returns the current
 * list of discoverable content. Never throws on a single source failing —
 * failures are returned as `warnings` with partial results.
 */
export async function discoverContent(): Promise<DiscoveryResult> {
  await ensureDiscoveredTable();
  const [xResult, rssResult] = await Promise.all([searchX(), fetchRssNews()]);
  const warnings = [xResult.error, rssResult.error].filter(
    (w): w is string => Boolean(w),
  );
  const merged = mergeDedupe(xResult.items, rssResult.items);
  const items = await storeItems(merged);
  return { items, warnings, ran_at: new Date().toISOString() };
}

/**
 * Creates a scheduled post from a discovered item (3 days out, for review) and
 * marks the item as reposted. The original content becomes the post script with
 * the source attributed.
 */
export async function repostContent(id: number): Promise<RepostResult> {
  await ensureDiscoveredTable();
  const s = sql();
  const [row] = await s`SELECT * FROM discovered_content WHERE id = ${id}`;
  if (!row) return { success: false, error: `Discovered item ${id} not found` };
  const item = coerceDiscovered(row);
  if (item.status === "reposted") {
    return { success: false, error: "This item has already been reposted" };
  }
  if (item.status === "dismissed") {
    return { success: false, error: "This item has been dismissed" };
  }

  const rawText = [item.title, item.text, item.snippet].filter(Boolean).join(" — ");
  const title = item.title ?? truncate(item.text ?? "Trending security content", 80);
  const script =
    item.source === "x"
      ? `Repost from ${item.author ?? "X"}: “${item.text ?? ""}”\n\nOriginal: ${item.url}`
      : `“${item.title ?? "Security industry news"}” — ${item.author ?? "news source"}.\n\n${item.snippet ? `${item.snippet}\n\n` : ""}Read more: ${item.url}`;
  const scheduledAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  const [post] = await s`
    INSERT INTO scheduled_posts (title, vertical, platform, script, hook, status, scheduled_at)
    VALUES (${title}, ${guessVertical(rawText)}, 'x', ${script}, NULL, 'scheduled', ${scheduledAt})
    RETURNING id, title, platform, status, scheduled_at
  `;

  await s`UPDATE discovered_content SET status = 'reposted' WHERE id = ${id}`;

  return {
    success: true,
    post: {
      id: Number(post.id),
      title: String(post.title),
      platform: String(post.platform),
      status: String(post.status),
      scheduled_at: post.scheduled_at ? String(post.scheduled_at) : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Scheduled discovery — Tuesday & Friday 09:00 UTC
// ---------------------------------------------------------------------------

export async function getLastDiscoveryRun(): Promise<string | null> {
  await ensureSettingsTable();
  const s = sql();
  const [row] = await s`SELECT value FROM receptionist_settings WHERE key = ${DISCOVERY_RUN_KEY}`;
  if (!row) return null;
  const value = row.value as unknown;
  const obj =
    value && typeof value === "object"
      ? (value as { last_run?: string })
      : typeof value === "string"
        ? (JSON.parse(value) as { last_run?: string })
        : null;
  return obj?.last_run ?? null;
}

/** True when a discovery window (Tue/Fri ≥ 09:00 UTC) has passed unrun. */
export function isDiscoveryDue(lastRun: string | null, now = new Date()): boolean {
  const day = now.getUTCDay();
  if (!DISCOVERY_DAYS_UTC.includes(day)) return false;
  if (now.getUTCHours() < DISCOVERY_HOUR_UTC) return false;
  const windowStart = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      DISCOVERY_HOUR_UTC,
    ),
  );
  if (!lastRun) return true;
  const last = new Date(lastRun).getTime();
  if (Number.isNaN(last)) return true;
  return last < windowStart.getTime();
}

async function setLastDiscoveryRun(ranAt: string, itemCount: number): Promise<void> {
  await ensureSettingsTable();
  const s = sql();
  const value = JSON.stringify({ last_run: ranAt, item_count: itemCount });
  await s`INSERT INTO receptionist_settings (key, value)
    VALUES (${DISCOVERY_RUN_KEY}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = NOW()`;
}

/**
 * Scheduled entry point. Runs discovery only if a Tue/Fri 09:00 UTC window has
 * passed since the last recorded run, then records the run time to prevent
 * duplicate runs. Used by the in-app scheduler (serve.ts).
 */
export async function runDiscovery(): Promise<{
  ran: boolean;
  reason: string;
  result?: DiscoveryResult;
}> {
  const lastRun = await getLastDiscoveryRun();
  if (!isDiscoveryDue(lastRun)) {
    return { ran: false, reason: "not due (scheduled Tue & Fri 09:00 UTC)" };
  }
  const result = await discoverContent();
  await setLastDiscoveryRun(new Date().toISOString(), result.items.length);
  return { ran: true, reason: `due (last run: ${lastRun ?? "never"})`, result };
}

/** Installs the discovery scheduler (startup check + periodic re-check). */
export function startDiscoveryScheduler(): void {
  const tick = async (): Promise<void> => {
    try {
      const res = await runDiscovery();
      if (res.ran) {
        console.log(
          `[discovery] ran — ${res.result?.items.length ?? 0} items stored (${res.reason})`,
        );
      }
    } catch (err) {
      console.error("[discovery] scheduled run failed", errMessage(err));
    }
  };
  // Check on startup (covers the case where a window passed while the server
  // was down), then re-check every 15 minutes. The due-check is cheap — most
  // ticks are a single settings read.
  void tick();
  setInterval(tick, SCHEDULER_INTERVAL_MS);
}
