import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
// ---------------------------------------------------------------------------
// Social media auto-posting engine.
//
// Each platform is an independent module of plain (server-side) functions plus
// a thin createServerFn() wrapper (suffixed `Action`) for client use. TikTok
// can be added later by following the same pattern.
//
// NOTE: all node:crypto usage lives inside functions (never at module top
// level) so the client bundle — which imports this module for the `Action`
// wrappers — never needs a browser crypto implementation.
// ---------------------------------------------------------------------------
export interface PostResult {
  success: boolean;
  id?: string;
  error?: string;
}
export interface SocialConnectionStatus {
  x: boolean;
  instagram: boolean;
  youtube: boolean;
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** RFC 3986 percent-encoding (as required by OAuth 1.0a). */
function pctEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
// ---------------------------------------------------------------------------
// X (Twitter) — API v2, OAuth 1.0a (HMAC-SHA1 signed manually)
// ---------------------------------------------------------------------------
/**
 * Posts a tweet to X via the API v2 endpoint POST https://api.x.com/2/tweets.
 * Requires env vars: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET.
 */
export async function postToX(text: string): Promise<PostResult> {
  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;
  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    return {
      success: false,
      error:
        "X credentials not configured (need X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET)",
    };
  }
  const { createHmac, randomBytes } = await import("node:crypto");
  const method = "POST";
  const url = "https://api.x.com/2/tweets";
  const oauth: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };
  // Signature base string: METHOD&encodedUrl&encodedParams (params sorted by key).
  const paramString = Object.keys(oauth)
    .sort()
    .map((k) => `${pctEncode(k)}=${pctEncode(oauth[k] ?? "")}`)
    .join("&");
  const signatureBase = `${method}&${pctEncode(url)}&${pctEncode(paramString)}`;
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
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: header,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    return {
      success: false,
      error: `X request failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  const json: unknown = await res.json().catch(() => null);
  if (res.status === 201 && json && typeof json === "object" && "data" in json) {
    const data = (json as { data?: { id?: string } }).data;
    if (data?.id) return { success: true, id: data.id };
  }
  const errObj = json as {
    errors?: { message?: string }[];
    detail?: string;
    title?: string;
  } | null;
  const msg =
    errObj?.errors?.[0]?.message ??
    errObj?.detail ??
    errObj?.title ??
    `X API error (HTTP ${res.status})`;
  return { success: false, error: msg };
}
// ---------------------------------------------------------------------------
// Instagram — Meta Graph API v21.0 (caption-only for now; REELS for video URLs)
// ---------------------------------------------------------------------------
let cachedIgAccountId: string | null = null;

async function getInstagramAccountId(
  accessToken: string,
): Promise<{ id: string } | { error: string }> {
  if (cachedIgAccountId) return { id: cachedIgAccountId };
  try {
    const accountsRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${encodeURIComponent(accessToken)}`,
    );
    const accountsJson = (await accountsRes.json().catch(() => null)) as {
      data?: { id: string; name?: string }[];
      error?: { message?: string };
    } | null;
    if (!accountsRes.ok || !accountsJson?.data?.length) {
      return {
        error:
          accountsJson?.error?.message ??
          `Failed to list Facebook pages (HTTP ${accountsRes.status})`,
      };
    }
    const page = accountsJson.data[0];
    const pageRes = await fetch(
      `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${encodeURIComponent(accessToken)}`,
    );
    const pageJson = (await pageRes.json().catch(() => null)) as {
      instagram_business_account?: { id?: string };
      error?: { message?: string };
    } | null;
    const igId = pageJson?.instagram_business_account?.id;
    if (!pageRes.ok || !igId) {
      return {
        error:
          pageJson?.error?.message ??
          "No Instagram Business account is linked to this Facebook page",
      };
    }
    cachedIgAccountId = igId;
    return { id: igId };
  } catch (err) {
    return {
      error: `Instagram API request failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Posts to Instagram via the Graph API.
 * Requires env var: META_PAGE_ACCESS_TOKEN.
 *
 * `videoUrl` (optional) posts a Reel when provided. Text-only posts are not
 * possible on Instagram (every post needs media), so without a media URL we
 * return a graceful error — media hosting can be wired up later.
 * The Instagram Business account ID is cached in memory after the first fetch.
 */
export async function postToInstagram(
  caption: string,
  videoUrl?: string,
): Promise<PostResult> {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) {
    return {
      success: false,
      error: "Instagram not configured (META_PAGE_ACCESS_TOKEN missing)",
    };
  }
  if (!videoUrl) {
    return {
      success: false,
      error:
        "Instagram posts require media (image or video URL). No media URL was provided — media hosting is not wired up yet.",
    };
  }
  const account = await getInstagramAccountId(token);
  if ("error" in account) return { success: false, error: account.error };
  try {
    // 1. Create a media container (REELS for short-form video).
    const containerBody = new URLSearchParams({
      caption,
      media_type: "REELS",
      video_url: videoUrl,
      access_token: token,
    });
    const containerRes = await fetch(
      `https://graph.facebook.com/v21.0/${account.id}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: containerBody,
      },
    );
    const containerJson = (await containerRes.json().catch(() => null)) as {
      id?: string;
      error?: { message?: string };
    } | null;
    if (!containerRes.ok || !containerJson?.id) {
      return {
        success: false,
        error:
          containerJson?.error?.message ??
          `Failed to create Instagram media container (HTTP ${containerRes.status})`,
      };
    }
    // 2. Publish the container.
    const publishBody = new URLSearchParams({
      creation_id: containerJson.id,
      access_token: token,
    });
    const publishRes = await fetch(
      `https://graph.facebook.com/v21.0/${account.id}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: publishBody,
      },
    );
    const publishJson = (await publishRes.json().catch(() => null)) as {
      id?: string;
      error?: { message?: string };
    } | null;
    if (!publishRes.ok || !publishJson?.id) {
      return {
        success: false,
        error:
          publishJson?.error?.message ??
          `Failed to publish Instagram media (HTTP ${publishRes.status})`,
      };
    }
    return { success: true, id: publishJson.id };
  } catch (err) {
    return {
      success: false,
      error: `Instagram API request failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
// ---------------------------------------------------------------------------
// YouTube — OAuth 2.0 + YouTube Data API v3
// ---------------------------------------------------------------------------
const YOUTUBE_REDIRECT_URI = "https://no602.ctonew.app/social";
const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.upload";

interface YouTubeTokens {
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
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

async function getYouTubeTokens(): Promise<YouTubeTokens | null> {
  await ensureSettingsTable();
  const s = sql();
  const [row] = await s`SELECT value FROM receptionist_settings WHERE key = 'youtube_tokens'`;
  if (!row) return null;
  const raw = row.value as unknown;
  if (raw && typeof raw === "object") return raw as YouTubeTokens;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as YouTubeTokens;
    } catch {
      return null;
    }
  }
  return null;
}

async function storeYouTubeTokens(tokens: YouTubeTokens): Promise<void> {
  await ensureSettingsTable();
  const s = sql();
  await s`INSERT INTO receptionist_settings (key, value)
    VALUES ('youtube_tokens', ${JSON.stringify(tokens)})
    ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(tokens)}, updated_at = NOW()`;
}

/** Returns the Google OAuth URL the user visits to authorize YouTube uploads. */
export async function getYouTubeAuthUrl(): Promise<
  { url: string } | { error: string }
> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  if (!clientId) {
    return { error: "YouTube not configured (YOUTUBE_CLIENT_ID missing)" };
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: YOUTUBE_REDIRECT_URI,
    response_type: "code",
    scope: YOUTUBE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
}

/** Exchanges the OAuth authorization code for tokens and stores the refresh token. */
export async function handleYouTubeCallback(
  code: string,
): Promise<{ success: boolean; error?: string }> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return {
      success: false,
      error: "YouTube not configured (need YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET)",
    };
  }
  try {
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: YOUTUBE_REDIRECT_URI,
      grant_type: "authorization_code",
    });
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json().catch(() => null)) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    } | null;
    if (!res.ok || !json?.refresh_token) {
      return {
        success: false,
        error: json?.error_description ?? json?.error ?? `Token exchange failed (HTTP ${res.status})`,
      };
    }
    await storeYouTubeTokens({
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      expires_at: new Date(
        Date.now() + (json.expires_in ?? 3600) * 1000,
      ).toISOString(),
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: `YouTube token exchange failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Refreshes the access token using the stored refresh token (if needed). */
async function getValidYouTubeAccessToken(
  tokens: YouTubeTokens,
): Promise<string | null> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const now = Date.now();
  if (
    tokens.access_token &&
    tokens.expires_at &&
    new Date(tokens.expires_at).getTime() > now + 60_000
  ) {
    return tokens.access_token;
  }
  if (!tokens.refresh_token) return null;
  try {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    });
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json().catch(() => null)) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    } | null;
    if (!res.ok || !json?.access_token) return null;
    await storeYouTubeTokens({
      access_token: json.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(
        Date.now() + (json.expires_in ?? 3600) * 1000,
      ).toISOString(),
    });
    return json.access_token;
  } catch {
    return null;
  }
}

/**
 * Uploads a video to YouTube using the stored refresh token.
 * Requires the user to have completed the "Connect YouTube" OAuth flow.
 */
export async function postToYouTube(
  title: string,
  description: string,
  videoUrl: string,
): Promise<PostResult> {
  const tokens = await getYouTubeTokens();
  if (!tokens?.refresh_token) {
    return {
      success: false,
      error: "YouTube not connected — click \"Connect YouTube\" in the Social dashboard first.",
    };
  }
  const accessToken = await getValidYouTubeAccessToken(tokens);
  if (!accessToken) {
    return {
      success: false,
      error: "Could not get a valid YouTube access token — reconnect YouTube.",
    };
  }
  try {
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      return {
        success: false,
        error: `Could not fetch video from URL (HTTP ${videoRes.status})`,
      };
    }
    const videoBlob = await videoRes.blob();
    // Single-request multipart upload: JSON snippet/status metadata + video bytes.
    const metadata = {
      snippet: { title, description },
      status: { privacyStatus: "private" },
    };
    const boundary = `----no602-${Date.now().toString(16)}`;
    const head = new Blob([
      `--${boundary}\r\n` +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\n` +
        "Content-Type: application/octet-stream\r\n\r\n",
    ]);
    const tail = new Blob([`\r\n--${boundary}--\r\n`]);
    const body = new Blob([head, videoBlob, tail]);
    const res = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );
    const json = (await res.json().catch(() => null)) as {
      id?: string;
      error?: { message?: string };
    } | null;
    if (res.ok && json?.id) return { success: true, id: json.id };
    return {
      success: false,
      error: json?.error?.message ?? `YouTube upload failed (HTTP ${res.status})`,
    };
  } catch (err) {
    return {
      success: false,
      error: `YouTube upload failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Reports which platforms are currently connected (env vars / stored tokens). */
export async function getSocialConnectionStatus(): Promise<SocialConnectionStatus> {
  const tokens = await getYouTubeTokens();
  return {
    x: Boolean(
      process.env.X_API_KEY &&
        process.env.X_API_SECRET &&
        process.env.X_ACCESS_TOKEN &&
        process.env.X_ACCESS_TOKEN_SECRET,
    ),
    instagram: Boolean(process.env.META_PAGE_ACCESS_TOKEN),
    youtube: Boolean(tokens?.refresh_token),
  };
}
// ---------------------------------------------------------------------------
// Client-callable server functions (thin wrappers)
// ---------------------------------------------------------------------------
export const postToXAction = createServerFn()
  .validator((text: string) => text)
  .handler(async ({ data }) => postToX(data));

export const postToInstagramAction = createServerFn()
  .validator((data: { caption: string; videoUrl?: string }) => data)
  .handler(async ({ data }) => postToInstagram(data.caption, data.videoUrl));

export const postToYouTubeAction = createServerFn()
  .validator((data: { title: string; description: string; videoUrl: string }) => data)
  .handler(async ({ data }) => postToYouTube(data.title, data.description, data.videoUrl));

export const getYouTubeAuthUrlAction = createServerFn().handler(async () =>
  getYouTubeAuthUrl(),
);

export const handleYouTubeCallbackAction = createServerFn()
  .validator((code: string) => code)
  .handler(async ({ data }) => handleYouTubeCallback(data));

export const getSocialConnectionStatusAction = createServerFn().handler(async () =>
  getSocialConnectionStatus(),
);
