import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Call {
  id: number;
  lead_id: number | null;
  caller_number: string | null;
  caller_name: string | null;
  direction: string;
  status: string;
  duration_seconds: number;
  transcript: string | null;
  summary: string | null;
  notes: string | null;
  created_at: string;
}

export interface Message {
  id: number;
  lead_id: number | null;
  contact_number: string | null;
  contact_email: string | null;
  direction: string;
  channel: string;
  subject: string | null;
  body: string;
  status: string;
  thread_id: string | null;
  created_at: string;
}

export interface ThreadPreview {
  thread_id: string;
  contact_name: string | null;
  contact_number: string | null;
  contact_email: string | null;
  channel: string;
  latest_message: string;
  latest_time: string;
  message_count: number;
  lead_id: number | null;
}

export interface ReceptionistStats {
  calls_today: number;
  missed_calls: number;
  messages_sent: number;
  active_conversations: number;
}

export interface ReceptionistSetting {
  id: number;
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Migration — idempotent, safe to call on every receptionist access
// ---------------------------------------------------------------------------

export const ensureTables = createServerFn().handler(async () => {
  const s = sql();

  await s`CREATE TABLE IF NOT EXISTS calls (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
    caller_number TEXT,
    caller_name TEXT,
    direction TEXT NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
    status TEXT NOT NULL DEFAULT 'missed' CHECK (status IN ('missed', 'answered', 'voicemail', 'completed')),
    duration_seconds INTEGER DEFAULT 0,
    transcript TEXT,
    summary TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await s`CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
    contact_number TEXT,
    contact_email TEXT,
    direction TEXT NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
    channel TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms', 'email')),
    subject TEXT,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
    thread_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await s`CREATE TABLE IF NOT EXISTS receptionist_settings (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await s`CREATE INDEX IF NOT EXISTS idx_calls_lead_id ON calls(lead_id)`;
  await s`CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status)`;
  await s`CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON messages(lead_id)`;
  await s`CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id)`;

  return { ok: true };
});

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

function coerceCall(row: Record<string, unknown>): Call {
  return { ...row, created_at: String(row.created_at) } as Call;
}

function coerceMessage(row: Record<string, unknown>): Message {
  return { ...row, created_at: String(row.created_at) } as Message;
}

function coerceSetting(row: Record<string, unknown>): ReceptionistSetting {
  return { ...row, updated_at: String(row.updated_at) } as ReceptionistSetting;
}

// ---------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------

export const getCalls = createServerFn()
  .validator(
    (data: { status?: string; limit?: number } | void) =>
      data ?? {},
  )
  .handler(async ({ data }) => {
    const s = sql();
    const { status, limit = 50 } = data;

    let rows;
    if (status) {
      rows = await s`SELECT * FROM calls WHERE status = ${status} ORDER BY created_at DESC LIMIT ${limit}`;
    } else {
      rows = await s`SELECT * FROM calls ORDER BY created_at DESC LIMIT ${limit}`;
    }
    return rows.map(coerceCall);
  });

export const getCall = createServerFn()
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    const s = sql();
    const [call] = await s`SELECT * FROM calls WHERE id = ${id}`;
    if (!call) return null;
    return coerceCall(call);
  });

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export const getMessages = createServerFn()
  .validator(
    (data: {
      lead_id?: number;
      channel?: string;
      thread_id?: string;
      limit?: number;
    } | void) => data ?? {},
  )
  .handler(async ({ data }) => {
    const s = sql();
    const { lead_id, channel, thread_id, limit = 100 } = data;

    // Build conditions
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (lead_id !== undefined) {
      params.push(lead_id);
      conditions.push(`lead_id = $${params.length}`);
    }
    if (channel) {
      params.push(channel);
      conditions.push(`channel = $${params.length}`);
    }
    if (thread_id) {
      params.push(thread_id);
      conditions.push(`thread_id = $${params.length}`);
    }

    params.push(limit);

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const query = `SELECT * FROM messages ${where} ORDER BY created_at DESC LIMIT $${params.length}`;

    const rows = await s.unsafe(query, params) as Record<string, unknown>[];
    return rows.map(coerceMessage);
  });

export const getMessageThread = createServerFn()
  .validator((threadId: string) => threadId)
  .handler(async ({ data: threadId }) => {
    const s = sql();
    const rows =
      await s`SELECT * FROM messages WHERE thread_id = ${threadId} ORDER BY created_at ASC`;
    return rows.map(coerceMessage);
  });

export const getThreadPreviews = createServerFn().handler(async () => {
  const s = sql();

  // Get the latest message per thread plus count
  const rows = await s`
    SELECT DISTINCT ON (thread_id)
      thread_id,
      lead_id,
      contact_number,
      contact_email,
      channel,
      body AS latest_message,
      created_at AS latest_time,
      (SELECT COUNT(*) FROM messages m2 WHERE m2.thread_id = messages.thread_id)::int AS message_count
    FROM messages
    WHERE thread_id IS NOT NULL
    ORDER BY thread_id, created_at DESC
  `;

  return (rows as Record<string, unknown>[]).map((r) => ({
    ...r,
    latest_time: String(r.latest_time),
    contact_name: null as string | null, // will be enriched from leads in the UI
  })) as ThreadPreview[];
});

export const sendMessage = createServerFn()
  .validator(
    (data: {
      lead_id?: number;
      contact_number?: string;
      contact_email?: string;
      channel: string;
      subject?: string;
      body: string;
      thread_id?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const s = sql();
    const threadId = data.thread_id ?? `thread_${Date.now()}`;

    const [msg] = await s`
      INSERT INTO messages (lead_id, contact_number, contact_email, direction, channel, subject, body, status, thread_id)
      VALUES (
        ${data.lead_id ?? null},
        ${data.contact_number ?? null},
        ${data.contact_email ?? null},
        'outbound',
        ${data.channel},
        ${data.subject ?? null},
        ${data.body},
        'sent',
        ${threadId}
      )
      RETURNING *
    `;
    return coerceMessage(msg);
  });

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export const getReceptionistStats = createServerFn().handler(async () => {
  const s = sql();

  const [callsToday] = await s`
    SELECT COUNT(*)::int AS count FROM calls
    WHERE created_at::date = CURRENT_DATE
  `;
  const [missedCalls] = await s`
    SELECT COUNT(*)::int AS count FROM calls
    WHERE status = 'missed' AND created_at::date = CURRENT_DATE
  `;
  const [messagesSent] = await s`
    SELECT COUNT(*)::int AS count FROM messages
    WHERE direction = 'outbound' AND created_at::date = CURRENT_DATE
  `;
  const [activeConvs] = await s`
    SELECT COUNT(DISTINCT thread_id)::int AS count FROM messages
    WHERE created_at::date = CURRENT_DATE
  `;

  return {
    calls_today: (callsToday as { count: number }).count,
    missed_calls: (missedCalls as { count: number }).count,
    messages_sent: (messagesSent as { count: number }).count,
    active_conversations: (activeConvs as { count: number }).count,
  } as ReceptionistStats;
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const getSettings = createServerFn().handler(async () => {
  const s = sql();
  const rows = await s`SELECT * FROM receptionist_settings ORDER BY key ASC`;
  return rows.map(coerceSetting);
});

export const updateSettings = createServerFn()
  .validator(
    (data: { key: string; value: Record<string, unknown> }) => data,
  )
  .handler(async ({ data }) => {
    const s = sql();
    const [row] = await s`
      INSERT INTO receptionist_settings (key, value)
      VALUES (${data.key}, ${JSON.stringify(data.value)})
      ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(data.value)}, updated_at = NOW()
      RETURNING *
    `;
    return coerceSetting(row);
  });
