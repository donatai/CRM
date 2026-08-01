import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Campaign {
  id: number;
  name: string;
  subject_line: string;
  body_template: string;
  status: string;
  target_count: number;
  sent_count: number;
  opened_count: number;
  replied_count: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignRecipient {
  id: number;
  campaign_id: number;
  lead_id: number | null;
  email: string;
  name: string;
  company: string | null;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  created_at: string;
}

export interface ScrapedLead {
  id: number;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source_url: string | null;
  source_type: string | null;
  industry: string | null;
  notes: string | null;
  imported_to_crm: boolean;
  created_at: string;
}

export interface MarketingStats {
  active_campaigns: number;
  total_sent: number;
  total_opened: number;
  total_replied: number;
  scraped_leads: number;
  open_rate: number;
  reply_rate: number;
}

// ---------------------------------------------------------------------------
// Migration — idempotent, safe to call on every marketing access
// ---------------------------------------------------------------------------

export const ensureTables = createServerFn().handler(async () => {
  const s = sql();

  await s`CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    subject_line TEXT NOT NULL,
    body_template TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
    target_count INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    opened_count INTEGER NOT NULL DEFAULT 0,
    replied_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await s`CREATE TABLE IF NOT EXISTS campaign_recipients (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    company TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'opened', 'replied', 'bounced', 'unsubscribed')),
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await s`CREATE TABLE IF NOT EXISTS scraped_leads (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    company TEXT,
    email TEXT,
    phone TEXT,
    source_url TEXT,
    source_type TEXT CHECK (source_type IN ('google_maps', 'linkedin', 'website', 'directory')),
    industry TEXT,
    notes TEXT,
    imported_to_crm BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await s`CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status)`;
  await s`CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_id ON campaign_recipients(campaign_id)`;
  await s`CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON campaign_recipients(status)`;
  await s`CREATE INDEX IF NOT EXISTS idx_scraped_leads_source_type ON scraped_leads(source_type)`;
  await s`CREATE INDEX IF NOT EXISTS idx_scraped_leads_imported ON scraped_leads(imported_to_crm)`;

  return { ok: true };
});

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

function coerceCampaign(row: Record<string, unknown>): Campaign {
  return {
    ...row,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  } as Campaign;
}

function coerceRecipient(row: Record<string, unknown>): CampaignRecipient {
  return {
    ...row,
    sent_at: row.sent_at ? String(row.sent_at) : null,
    opened_at: row.opened_at ? String(row.opened_at) : null,
    created_at: String(row.created_at),
  } as CampaignRecipient;
}

function coerceScrapedLead(row: Record<string, unknown>): ScrapedLead {
  return {
    ...row,
    created_at: String(row.created_at),
  } as ScrapedLead;
}

// ---------------------------------------------------------------------------
// Campaign CRUD
// ---------------------------------------------------------------------------

export const getCampaigns = createServerFn()
  .validator((data: { status?: string } | void) => data ?? {})
  .handler(async ({ data }) => {
    const s = sql();
    const { status } = data;

    if (status && status !== "all") {
      const rows = await s`SELECT * FROM campaigns WHERE status = ${status} ORDER BY updated_at DESC`;
      return rows.map(coerceCampaign);
    }
    const rows = await s`SELECT * FROM campaigns ORDER BY updated_at DESC`;
    return rows.map(coerceCampaign);
  });

export const getCampaign = createServerFn()
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    const s = sql();
    const [campaign] = await s`SELECT * FROM campaigns WHERE id = ${id}`;
    if (!campaign) return { campaign: null, recipients: [] };

    const recipients = await s`SELECT * FROM campaign_recipients WHERE campaign_id = ${id} ORDER BY created_at DESC`;

    return {
      campaign: coerceCampaign(campaign),
      recipients: recipients.map(coerceRecipient),
    };
  });

export const createCampaign = createServerFn()
  .validator(
    (data: {
      name: string;
      subject_line: string;
      body_template: string;
      target_count?: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    const s = sql();
    const [campaign] = await s`
      INSERT INTO campaigns (name, subject_line, body_template, target_count)
      VALUES (${data.name}, ${data.subject_line}, ${data.body_template}, ${data.target_count ?? 0})
      RETURNING *
    `;
    return coerceCampaign(campaign);
  });

export const updateCampaign = createServerFn()
  .validator(
    (data: {
      id: number;
      name?: string;
      subject_line?: string;
      body_template?: string;
      status?: string;
      target_count?: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    const s = sql();
    const { id, ...fields } = data;

    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        setClauses.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (setClauses.length === 0) {
      const [campaign] = await s`SELECT * FROM campaigns WHERE id = ${id}`;
      return campaign ? coerceCampaign(campaign) : null;
    }

    setClauses.push("updated_at = NOW()");

    const query = `UPDATE campaigns SET ${setClauses.map((c, i) => c.replace("?", `$${i + 2}`)).join(", ")} WHERE id = $1 RETURNING *`;
    const rows = (await s.unsafe(query, [id, ...values])) as Record<string, unknown>[];
    return rows.length > 0 ? coerceCampaign(rows[0]) : null;
  });

// ---------------------------------------------------------------------------
// Recipient management
// ---------------------------------------------------------------------------

export const getRecipients = createServerFn()
  .validator(
    (data: { campaign_id: number; status?: string }) => data,
  )
  .handler(async ({ data }) => {
    const s = sql();
    const { campaign_id, status } = data;

    if (status) {
      const rows = await s`SELECT * FROM campaign_recipients WHERE campaign_id = ${campaign_id} AND status = ${status} ORDER BY created_at DESC`;
      return rows.map(coerceRecipient);
    }
    const rows = await s`SELECT * FROM campaign_recipients WHERE campaign_id = ${campaign_id} ORDER BY created_at DESC`;
    return rows.map(coerceRecipient);
  });

export const addRecipients = createServerFn()
  .validator(
    (data: {
      campaign_id: number;
      recipients: {
        email: string;
        name: string;
        company?: string;
        lead_id?: number;
      }[];
    }) => data,
  )
  .handler(async ({ data }) => {
    const s = sql();
    const { campaign_id, recipients } = data;

    const inserted: CampaignRecipient[] = [];
    for (const r of recipients) {
      const [row] = await s`
        INSERT INTO campaign_recipients (campaign_id, email, name, company, lead_id)
        VALUES (${campaign_id}, ${r.email}, ${r.name}, ${r.company ?? null}, ${r.lead_id ?? null})
        ON CONFLICT DO NOTHING
        RETURNING *
      `;
      if (row) inserted.push(coerceRecipient(row));
    }

    // Update target count
    const [count] = await s`SELECT COUNT(*)::int AS c FROM campaign_recipients WHERE campaign_id = ${campaign_id}`;
    await s`UPDATE campaigns SET target_count = ${(count as { c: number }).c}, updated_at = NOW() WHERE id = ${campaign_id}`;

    return inserted;
  });

export const sendCampaign = createServerFn()
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    const s = sql();

    // Mark campaign as active
    await s`UPDATE campaigns SET status = 'active', updated_at = NOW() WHERE id = ${id}`;

    // Mark all pending recipients as sent
    await s`
      UPDATE campaign_recipients
      SET status = 'sent', sent_at = NOW()
      WHERE campaign_id = ${id} AND status = 'pending'
    `;

    // Update sent_count
    const [count] = await s`SELECT COUNT(*)::int AS c FROM campaign_recipients WHERE campaign_id = ${id} AND status = 'sent'`;
    await s`UPDATE campaigns SET sent_count = ${(count as { c: number }).c}, updated_at = NOW() WHERE id = ${id}`;

    const [campaign] = await s`SELECT * FROM campaigns WHERE id = ${id}`;
    return campaign ? coerceCampaign(campaign) : null;
  });

// ---------------------------------------------------------------------------
// Scraping
// ---------------------------------------------------------------------------

export const getScrapedLeads = createServerFn()
  .validator(
    (data: { source?: string; imported?: boolean } | void) => data ?? {},
  )
  .handler(async ({ data }) => {
    const s = sql();
    const { source, imported } = data;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (source) {
      params.push(source);
      conditions.push(`source_type = $${params.length}`);
    }
    if (imported !== undefined) {
      params.push(imported);
      conditions.push(`imported_to_crm = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const query = `SELECT * FROM scraped_leads ${where} ORDER BY created_at DESC`;

    const rows = (await (params.length > 0
      ? s.unsafe(query, params)
      : s.unsafe(query))) as Record<string, unknown>[];
    return rows.map(coerceScrapedLead);
  });

export const importToCRM = createServerFn()
  .validator((ids: number[]) => ids)
  .handler(async ({ data: ids }) => {
    const s = sql();
    const imported: number[] = [];

    for (const id of ids) {
      const [scraped] = await s`SELECT * FROM scraped_leads WHERE id = ${id}`;
      if (!scraped || (scraped as Record<string, unknown>).imported_to_crm) continue;

      // Create a CRM lead from the scraped lead
      const [lead] = await s`
        INSERT INTO leads (name, company, email, phone, notes, status)
        VALUES (
          ${(scraped as Record<string, unknown>).name as string},
          ${((scraped as Record<string, unknown>).company as string) ?? null},
          ${((scraped as Record<string, unknown>).email as string) ?? null},
          ${((scraped as Record<string, unknown>).phone as string) ?? null},
          ${"Imported from lead scraper. Source: " + ((scraped as Record<string, unknown>).source_type as string) + ". " + (((scraped as Record<string, unknown>).notes as string) ?? "")},
          'new'
        )
        RETURNING id
      `;

      // Mark as imported
      await s`UPDATE scraped_leads SET imported_to_crm = true WHERE id = ${id}`;
      imported.push((lead as { id: number }).id);
    }

    return { imported: imported.length, lead_ids: imported };
  });

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export const getMarketingStats = createServerFn().handler(async () => {
  const s = sql();

  const [activeCampaigns] = await s`
    SELECT COUNT(*)::int AS count FROM campaigns WHERE status = 'active'
  `;

  const [sentTotal] = await s`
    SELECT COALESCE(SUM(sent_count), 0)::int AS count FROM campaigns
  `;

  const [openedTotal] = await s`
    SELECT COALESCE(SUM(opened_count), 0)::int AS count FROM campaigns
  `;

  const [repliedTotal] = await s`
    SELECT COALESCE(SUM(replied_count), 0)::int AS count FROM campaigns
  `;

  const [scrapedTotal] = await s`
    SELECT COUNT(*)::int AS count FROM scraped_leads WHERE imported_to_crm = false
  `;

  const totalSent = (sentTotal as { count: number }).count;
  const totalOpened = (openedTotal as { count: number }).count;
  const totalReplied = (repliedTotal as { count: number }).count;

  return {
    active_campaigns: (activeCampaigns as { count: number }).count,
    total_sent: totalSent,
    total_opened: totalOpened,
    total_replied: totalReplied,
    scraped_leads: (scrapedTotal as { count: number }).count,
    open_rate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
    reply_rate: totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0,
  } as MarketingStats;
});
