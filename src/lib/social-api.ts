import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import {
  postToInstagram,
  postToX,
  postToYouTube,
} from "~/lib/social-posting";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScheduledPost {
  id: number;
  title: string;
  vertical: string;
  platform: string;
  script: string;
  hook: string | null;
  thumbnail_concept: string | null;
  status: string;
  last_error: string | null;
  scheduled_at: string | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SocialStats {
  upcoming_this_week: number;
  total_scheduled: number;
  posted_this_month: number;
  drafts: number;
}

// ---------------------------------------------------------------------------
// Migration — idempotent, safe to call on every social access
// ---------------------------------------------------------------------------

export const ensureTables = createServerFn().handler(async () => {
  const s = sql();

  await s`CREATE TABLE IF NOT EXISTS scheduled_posts (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    vertical TEXT NOT NULL CHECK (vertical IN ('post_arm_guards', 'events', 'private_clients', 'executive_protection')),
    platform TEXT NOT NULL CHECK (platform IN ('x', 'tiktok', 'instagram', 'youtube', 'all')),
    script TEXT NOT NULL,
    hook TEXT,
    thumbnail_concept TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'posted', 'failed')),
    last_error TEXT,
    scheduled_at TIMESTAMPTZ,
    posted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await s`CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON scheduled_posts(status)`;
  await s`CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_at ON scheduled_posts(scheduled_at)`;
  // Migrate existing tables created before X (Twitter) was added.
  await s`ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS last_error TEXT`;
  await s`ALTER TABLE scheduled_posts DROP CONSTRAINT IF EXISTS scheduled_posts_platform_check`;
  await s`ALTER TABLE scheduled_posts ADD CONSTRAINT scheduled_posts_platform_check CHECK (platform IN ('x', 'tiktok', 'instagram', 'youtube', 'all'))`;

  return { ok: true };
});

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

function coercePost(row: Record<string, unknown>): ScheduledPost {
  return {
    ...row,
    last_error: row.last_error ? String(row.last_error) : null,
    scheduled_at: row.scheduled_at ? String(row.scheduled_at) : null,
    posted_at: row.posted_at ? String(row.posted_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  } as ScheduledPost;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export const getPosts = createServerFn()
  .validator((data: { status?: string } | void) => data ?? {})
  .handler(async ({ data }) => {
    const s = sql();
    const { status } = data;

    if (status && status !== "all") {
      const rows = await s`SELECT * FROM scheduled_posts WHERE status = ${status} ORDER BY updated_at DESC`;
      return rows.map(coercePost);
    }
    const rows = await s`SELECT * FROM scheduled_posts ORDER BY updated_at DESC`;
    return rows.map(coercePost);
  });

export const getPost = createServerFn()
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    const s = sql();
    const [post] = await s`SELECT * FROM scheduled_posts WHERE id = ${id}`;
    return post ? coercePost(post) : null;
  });

export const createPost = createServerFn()
  .validator(
    (data: {
      title: string;
      vertical: string;
      platform: string;
      script: string;
      hook?: string;
      thumbnail_concept?: string;
      status?: string;
      scheduled_at?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const s = sql();
    const [post] = await s`
      INSERT INTO scheduled_posts (title, vertical, platform, script, hook, thumbnail_concept, status, scheduled_at)
      VALUES (${data.title}, ${data.vertical}, ${data.platform}, ${data.script}, ${data.hook ?? null}, ${data.thumbnail_concept ?? null}, ${data.status ?? "draft"}, ${data.scheduled_at ? new Date(data.scheduled_at).toISOString() : null})
      RETURNING *
    `;
    return coercePost(post);
  });

export const updatePost = createServerFn()
  .validator(
    (data: {
      id: number;
      title?: string;
      vertical?: string;
      platform?: string;
      script?: string;
      hook?: string;
      thumbnail_concept?: string;
      status?: string;
      scheduled_at?: string | null;
      posted_at?: string | null;
    }) => data,
  )
  .handler(async ({ data }) => {
    const s = sql();
    const { id, ...fields } = data;

    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        if ((key === "scheduled_at" || key === "posted_at") && value !== null) {
          setClauses.push(`${key} = ?`);
          values.push(new Date(value as string).toISOString());
        } else {
          setClauses.push(`${key} = ?`);
          values.push(value);
        }
      }
    }

    if (setClauses.length === 0) {
      const [post] = await s`SELECT * FROM scheduled_posts WHERE id = ${id}`;
      return post ? coercePost(post) : null;
    }

    setClauses.push("updated_at = NOW()");

    const query = `UPDATE scheduled_posts SET ${setClauses
      .map((c, i) => c.replace("?", `$${i + 2}`))
      .join(", ")} WHERE id = $1 RETURNING *`;
    const rows = (await s.unsafe(query, [id, ...values])) as Record<string, unknown>[];
    return rows.length > 0 ? coercePost(rows[0]) : null;
  });

export const deletePost = createServerFn()
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    const s = sql();
    await s`DELETE FROM scheduled_posts WHERE id = ${id}`;
    return { ok: true };
  });
// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------
export interface PublishResult {
  success: boolean;
  error?: string;
  results: { platform: string; success: boolean; id?: string; error?: string }[];
}
export const publishPost = createServerFn()
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    const s = sql();
    const [row] = await s`SELECT * FROM scheduled_posts WHERE id = ${id}`;
    if (!row) return { success: false, error: `Post ${id} not found`, results: [] };
    const post = coercePost(row);
    if (post.status === "posted") {
      return { success: false, error: "Post is already marked as posted", results: [] };
    }
    // Build the caption from hook + script (hook first reads better on socials).
    const caption = [post.hook, post.script].filter(Boolean).join("\n\n");
    const targets =
      post.platform === "all"
        ? (["x", "instagram", "youtube"] as const)
        : ([post.platform] as const);
    const results: { platform: string; success: boolean; id?: string; error?: string }[] = [];
    for (const target of targets) {
      if (target === "x") {
        results.push({ platform: "x", ...(await postToX(caption)) });
      } else if (target === "instagram") {
        results.push({ platform: "instagram", ...(await postToInstagram(caption)) });
      } else if (target === "youtube") {
        results.push({ platform: "youtube", ...(await postToYouTube(post.title, caption, "")) });
      } else if (target === "tiktok") {
        results.push({ platform: "tiktok", success: false, error: "TikTok posting is not implemented yet" });
      } else {
        results.push({ platform: target, success: false, error: `Unknown platform: ${target}` });
      }
    }
    const anySuccess = results.some((r) => r.success);
    if (anySuccess) {
      await s`UPDATE scheduled_posts SET status = 'posted', posted_at = NOW(), last_error = NULL, updated_at = NOW() WHERE id = ${id}`;
      return { success: true, results };
    }
    const error = results
      .map((r) => `${r.platform}: ${r.error ?? "failed"}`)
      .join("; ");
    await s`UPDATE scheduled_posts SET status = 'failed', last_error = ${error}, updated_at = NOW() WHERE id = ${id}`;
    return { success: false, error, results };
  });

// ---------------------------------------------------------------------------
// Specialized queries
// ---------------------------------------------------------------------------

export const getUpcomingPosts = createServerFn().handler(async () => {
  const s = sql();
  const rows = await s`
    SELECT * FROM scheduled_posts
    WHERE status = 'scheduled' AND scheduled_at > NOW()
    ORDER BY scheduled_at ASC
  `;
  return rows.map(coercePost);
});

export const getCalendarPosts = createServerFn()
  .validator((month: string) => month)
  .handler(async ({ data: month }) => {
    const s = sql();
    const startDate = `${month}-01`;
    const [yearStr, monthStr] = month.split("-");
    const y = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);
    const nextM = m === 12 ? 1 : m + 1;
    const nextY = m === 12 ? y + 1 : y;
    const endDate = `${String(nextY).padStart(4, "0")}-${String(nextM).padStart(2, "0")}-01`;

    const rows = await s`
      SELECT * FROM scheduled_posts
      WHERE scheduled_at >= ${startDate}::timestamptz
        AND scheduled_at < ${endDate}::timestamptz
      ORDER BY scheduled_at ASC
    `;
    return rows.map(coercePost);
  });

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export const getSocialStats = createServerFn().handler(async () => {
  const s = sql();

  const [upcomingWeek] = await s`
    SELECT COUNT(*)::int AS count FROM scheduled_posts
    WHERE status = 'scheduled'
      AND scheduled_at > NOW()
      AND scheduled_at <= NOW() + INTERVAL '7 days'
  `;

  const [totalScheduled] = await s`
    SELECT COUNT(*)::int AS count FROM scheduled_posts
    WHERE status = 'scheduled'
  `;

  const [postedMonth] = await s`
    SELECT COUNT(*)::int AS count FROM scheduled_posts
    WHERE status = 'posted'
      AND posted_at >= date_trunc('month', NOW())
  `;

  const [drafts] = await s`
    SELECT COUNT(*)::int AS count FROM scheduled_posts
    WHERE status = 'draft'
  `;

  return {
    upcoming_this_week: (upcomingWeek as { count: number }).count,
    total_scheduled: (totalScheduled as { count: number }).count,
    posted_this_month: (postedMonth as { count: number }).count,
    drafts: (drafts as { count: number }).count,
  } as SocialStats;
});
