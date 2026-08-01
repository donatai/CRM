import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Lead {
  id: number;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  service_type: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: number;
  lead_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  notes: string | null;
  created_at: string;
}

export interface Activity {
  id: number;
  lead_id: number;
  type: string;
  description: string;
  created_at: string;
}

export interface PipelineStats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  proposal: number;
  won: number;
  lost: number;
}

// ---------------------------------------------------------------------------
// Migration — idempotent, safe to call on every CRM access
// ---------------------------------------------------------------------------

export const ensureTables = createServerFn().handler(async () => {
  const s = sql();

  await s`CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    company TEXT,
    email TEXT,
    phone TEXT,
    service_type TEXT CHECK (service_type IN ('post_arm_guards', 'events', 'private_clients', 'executive_protection')),
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await s`CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await s`CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'note')),
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  // Indexes (idempotent via IF NOT EXISTS)
  await s`CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)`;
  await s`CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON activities(lead_id)`;
  await s`CREATE INDEX IF NOT EXISTS idx_contacts_lead_id ON contacts(lead_id)`;

  return { ok: true };
});

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

function coerceLead(row: Record<string, unknown>): Lead {
  return {
    ...row,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  } as Lead;
}

function coerceContact(row: Record<string, unknown>): Contact {
  return {
    ...row,
    created_at: String(row.created_at),
  } as Contact;
}

function coerceActivity(row: Record<string, unknown>): Activity {
  return {
    ...row,
    created_at: String(row.created_at),
  } as Activity;
}

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

export const getLeads = createServerFn()
  .validator((data: { status?: string } | void) => data ?? {})
  .handler(async ({ data }) => {
    const s = sql();
    const { status } = data;

    let rows;
    if (status && status !== "all") {
      rows = await s`SELECT * FROM leads WHERE status = ${status} ORDER BY updated_at DESC`;
    } else {
      rows = await s`SELECT * FROM leads ORDER BY updated_at DESC`;
    }
    return rows.map(coerceLead);
  });

export const getLead = createServerFn()
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    const s = sql();

    const [lead] = await s`SELECT * FROM leads WHERE id = ${id}`;
    if (!lead) return { lead: null, contacts: [], activities: [] };

    const contacts = await s`SELECT * FROM contacts WHERE lead_id = ${id} ORDER BY created_at DESC`;
    const activities = await s`SELECT * FROM activities WHERE lead_id = ${id} ORDER BY created_at DESC`;

    return {
      lead: coerceLead(lead),
      contacts: contacts.map(coerceContact),
      activities: activities.map(coerceActivity),
    };
  });

export const createLead = createServerFn()
  .validator(
    (data: {
      name: string;
      company?: string;
      email?: string;
      phone?: string;
      service_type?: string;
      notes?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const s = sql();
    const [lead] = await s`
      INSERT INTO leads (name, company, email, phone, service_type, notes)
      VALUES (${data.name}, ${data.company ?? null}, ${data.email ?? null}, ${data.phone ?? null}, ${data.service_type ?? null}, ${data.notes ?? null})
      RETURNING *
    `;
    return coerceLead(lead);
  });

export const updateLead = createServerFn()
  .validator(
    (data: {
      id: number;
      name?: string;
      company?: string;
      email?: string;
      phone?: string;
      service_type?: string;
      status?: string;
      notes?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const s = sql();
    const { id, ...fields } = data;

    // Build SET clause dynamically from non-undefined fields
    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        setClauses.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (setClauses.length === 0) {
      const [lead] = await s`SELECT * FROM leads WHERE id = ${id}`;
      return lead ? coerceLead(lead) : null;
    }

    // Add updated_at
    setClauses.push("updated_at = NOW()");

    // Use raw query since we can't easily parameterize column names with the template tag
    const setStr = setClauses.join(", ");

    // Build the full query with proper interpolation
    // Safe: column names come from our own code, values are parameterized
    const query = `UPDATE leads SET ${setClauses.map((c, i) => c.replace('?', `$${i + 2}`)).join(", ")} WHERE id = $1 RETURNING *`;

    // Use sql.unsafe for the constructed SET clause but values are safe
    const rows = await s.unsafe(query, [id, ...values]) as Record<string, unknown>[];
    return rows.length > 0 ? coerceLead(rows[0]) : null;
  });

export const addContact = createServerFn()
  .validator(
    (data: {
      lead_id: number;
      name: string;
      email?: string;
      phone?: string;
      role?: string;
      notes?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const s = sql();
    const [contact] = await s`
      INSERT INTO contacts (lead_id, name, email, phone, role, notes)
      VALUES (${data.lead_id}, ${data.name}, ${data.email ?? null}, ${data.phone ?? null}, ${data.role ?? null}, ${data.notes ?? null})
      RETURNING *
    `;
    return coerceContact(contact);
  });

export const addActivity = createServerFn()
  .validator(
    (data: {
      lead_id: number;
      type: string;
      description: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const s = sql();
    const [activity] = await s`
      INSERT INTO activities (lead_id, type, description)
      VALUES (${data.lead_id}, ${data.type}, ${data.description})
      RETURNING *
    `;
    return coerceActivity(activity);
  });

export const getPipelineStats = createServerFn().handler(async () => {
  const s = sql();
  const rows = await s`
    SELECT status, COUNT(*)::int AS count
    FROM leads
    GROUP BY status
  `;

  const stats: PipelineStats = {
    total: 0,
    new: 0,
    contacted: 0,
    qualified: 0,
    proposal: 0,
    won: 0,
    lost: 0,
  };

  for (const row of rows as { status: string; count: number }[]) {
    const key = row.status as keyof PipelineStats;
    if (key in stats) {
      stats[key] = row.count;
    }
  }

  stats.total =
    stats.new +
    stats.contacted +
    stats.qualified +
    stats.proposal +
    stats.won +
    stats.lost;

  return stats;
});
