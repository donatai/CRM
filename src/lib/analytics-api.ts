import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnalyticsSnapshot {
  // Pipeline
  pipeline_total: number;
  pipeline_new: number;
  pipeline_contacted: number;
  pipeline_qualified: number;
  pipeline_proposal: number;
  pipeline_won: number;
  pipeline_lost: number;
  pipeline_won_revenue: number; // won count * 5000 (placeholder per-deal value)
  conversion_rate: number; // won / total as percentage

  // Leads by service type
  post_arm_guards: number;
  events: number;
  private_clients: number;
  executive_protection: number;

  // Receptionist
  total_calls: number;
  answered_calls: number;
  missed_calls: number;
  total_messages: number;
  sms_messages: number;
  email_messages: number;

  // Marketing
  active_campaigns: number;
  total_emails_sent: number;
  total_opens: number;
  total_replies: number;
  open_rate: number;
  reply_rate: number;
  total_scraped_leads: number;
  imported_scraped_leads: number;
}

export interface PipelineOverTime {
  month: string;
  new: number;
  won: number;
}

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

export const getAnalyticsSnapshot = createServerFn().handler(async () => {
  const s = sql();

  // -- Pipeline: count by status -------------------------------------------
  const pipelineRows = await s`
    SELECT status, COUNT(*)::int AS count
    FROM leads
    GROUP BY status
  `;

  const pipeCounts: Record<string, number> = {
    new: 0,
    contacted: 0,
    qualified: 0,
    proposal: 0,
    won: 0,
    lost: 0,
  };

  for (const row of pipelineRows as { status: string; count: number }[]) {
    if (row.status in pipeCounts) {
      pipeCounts[row.status] = row.count;
    }
  }

  const pipeline_total =
    pipeCounts.new +
    pipeCounts.contacted +
    pipeCounts.qualified +
    pipeCounts.proposal +
    pipeCounts.won +
    pipeCounts.lost;

  const pipeline_won_revenue = pipeCounts.won * 5000;
  const conversion_rate =
    pipeline_total > 0
      ? Math.round((pipeCounts.won / pipeline_total) * 100)
      : 0;

  // -- Leads by service type ------------------------------------------------
  const serviceRows = await s`
    SELECT COALESCE(service_type, 'unset') AS st, COUNT(*)::int AS count
    FROM leads
    GROUP BY service_type
  `;

  const serviceCounts: Record<string, number> = {
    post_arm_guards: 0,
    events: 0,
    private_clients: 0,
    executive_protection: 0,
  };

  for (const row of serviceRows as { st: string; count: number }[]) {
    if (row.st in serviceCounts) {
      serviceCounts[row.st] = row.count;
    }
  }

  // -- Receptionist: calls --------------------------------------------------
  const [totalCalls] = await s`
    SELECT COUNT(*)::int AS count FROM calls
  `;
  const [answeredCalls] = await s`
    SELECT COUNT(*)::int AS count FROM calls WHERE status = 'answered'
  `;
  const [missedCalls] = await s`
    SELECT COUNT(*)::int AS count FROM calls WHERE status = 'missed'
  `;

  // -- Receptionist: messages -----------------------------------------------
  const [totalMessages] = await s`
    SELECT COUNT(*)::int AS count FROM messages
  `;
  const [smsMessages] = await s`
    SELECT COUNT(*)::int AS count FROM messages WHERE channel = 'sms'
  `;
  const [emailMessages] = await s`
    SELECT COUNT(*)::int AS count FROM messages WHERE channel = 'email'
  `;

  // -- Marketing: campaigns -------------------------------------------------
  const [activeCampaigns] = await s`
    SELECT COUNT(*)::int AS count FROM campaigns WHERE status = 'active'
  `;
  const [emailsSent] = await s`
    SELECT COALESCE(SUM(sent_count), 0)::int AS count FROM campaigns
  `;
  const [totalOpens] = await s`
    SELECT COALESCE(SUM(opened_count), 0)::int AS count FROM campaigns
  `;
  const [totalReplies] = await s`
    SELECT COALESCE(SUM(replied_count), 0)::int AS count FROM campaigns
  `;

  const sent = (emailsSent as { count: number }).count;
  const opened = (totalOpens as { count: number }).count;
  const replied = (totalReplies as { count: number }).count;
  const open_rate = sent > 0 ? Math.round((opened / sent) * 100) : 0;
  const reply_rate = sent > 0 ? Math.round((replied / sent) * 100) : 0;

  // -- Marketing: scraped leads ---------------------------------------------
  const [scrapedTotal] = await s`
    SELECT COUNT(*)::int AS count FROM scraped_leads
  `;
  const [importedScraped] = await s`
    SELECT COUNT(*)::int AS count FROM scraped_leads WHERE imported_to_crm = true
  `;

  // -- Assemble -------------------------------------------------------------
  return {
    pipeline_total,
    pipeline_new: pipeCounts.new,
    pipeline_contacted: pipeCounts.contacted,
    pipeline_qualified: pipeCounts.qualified,
    pipeline_proposal: pipeCounts.proposal,
    pipeline_won: pipeCounts.won,
    pipeline_lost: pipeCounts.lost,
    pipeline_won_revenue,
    conversion_rate,

    post_arm_guards: serviceCounts.post_arm_guards,
    events: serviceCounts.events,
    private_clients: serviceCounts.private_clients,
    executive_protection: serviceCounts.executive_protection,

    total_calls: (totalCalls as { count: number }).count,
    answered_calls: (answeredCalls as { count: number }).count,
    missed_calls: (missedCalls as { count: number }).count,
    total_messages: (totalMessages as { count: number }).count,
    sms_messages: (smsMessages as { count: number }).count,
    email_messages: (emailMessages as { count: number }).count,

    active_campaigns: (activeCampaigns as { count: number }).count,
    total_emails_sent: sent,
    total_opens: opened,
    total_replies: replied,
    open_rate,
    reply_rate,
    total_scraped_leads: (scrapedTotal as { count: number }).count,
    imported_scraped_leads: (importedScraped as { count: number }).count,
  } as AnalyticsSnapshot;
});

export const getPipelineOverTime = createServerFn().handler(async () => {
  const s = sql();

  const rows = await s`
    SELECT
      to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
      COUNT(*) FILTER (WHERE status = 'new')::int AS new,
      COUNT(*) FILTER (WHERE status = 'won')::int AS won
    FROM leads
    WHERE created_at >= date_trunc('month', NOW()) - INTERVAL '11 months'
    GROUP BY date_trunc('month', created_at)
    ORDER BY date_trunc('month', created_at) ASC
  `;

  return (rows as Record<string, unknown>[]).map((r) => ({
    month: String(r.month),
    new: (r.new as number) ?? 0,
    won: (r.won as number) ?? 0,
  })) as PipelineOverTime[];
});
