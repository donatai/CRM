import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  getAnalyticsSnapshot,
  getPipelineOverTime,
  type AnalyticsSnapshot,
  type PipelineOverTime,
} from "~/lib/analytics-api";

export const Route = createFileRoute("/analytics")({
  component: AnalyticsDashboard,
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};

const STAGE_COLORS: Record<string, string> = {
  new: "bg-neutral-600",
  contacted: "bg-blue-600",
  qualified: "bg-amber-500",
  proposal: "bg-purple-600",
  won: "bg-emerald-500",
  lost: "bg-red-600",
};

const SERVICE_LABELS: Record<string, string> = {
  post_arm_guards: "Post Arm Guards",
  events: "Events",
  private_clients: "Private Clients",
  executive_protection: "Executive Protection",
};

const SERVICE_ICONS: Record<string, string> = {
  post_arm_guards: "🛡️",
  events: "🎪",
  private_clients: "🏠",
  executive_protection: "👤",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function AnalyticsDashboard() {
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const [pipelineHistory, setPipelineHistory] = useState<PipelineOverTime[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [snapResult, historyResult] = await Promise.all([
        getAnalyticsSnapshot(),
        getPipelineOverTime(),
      ]);
      setSnapshot(snapResult);
      setPipelineHistory(historyResult);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load data";
      if (msg.includes("DATABASE_URL")) {
        setError(
          "Database not connected. Connect a database to enable analytics.",
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  // -----------------------------------------------------------------------
  // Error state (no DB)
  // -----------------------------------------------------------------------
  if (error) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black">
        <div className="text-center">
          <div className="mb-4 text-5xl">📊</div>
          <h2 className="mb-2 text-xl font-bold text-white">Analytics</h2>
          <p className="max-w-md text-neutral-400">{error}</p>
          <p className="mt-4 text-sm text-neutral-600">
            The schema and API are ready. Connect a Neon database to activate
            analytics.
          </p>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------
  if (loading || !snapshot) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black">
        <p className="text-neutral-500">Loading analytics...</p>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Dashboard
  // -----------------------------------------------------------------------
  const pipelineStages = [
    { key: "new", count: snapshot.pipeline_new },
    { key: "contacted", count: snapshot.pipeline_contacted },
    { key: "qualified", count: snapshot.pipeline_qualified },
    { key: "proposal", count: snapshot.pipeline_proposal },
    { key: "won", count: snapshot.pipeline_won },
  ];

  const serviceTypes = [
    {
      key: "post_arm_guards",
      count: snapshot.post_arm_guards,
    },
    { key: "events", count: snapshot.events },
    { key: "private_clients", count: snapshot.private_clients },
    {
      key: "executive_protection",
      count: snapshot.executive_protection,
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-neutral-900 px-6 py-6">
        <div className="mx-auto max-w-[1600px]">
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Production &amp; growth metrics
          </p>
        </div>
      </header>

      {/* KPI stat bar */}
      <div className="border-b border-neutral-900 px-6 py-4">
        <div className="mx-auto flex max-w-[1600px] flex-wrap gap-6">
          <StatBox label="Total Pipeline" value={snapshot.pipeline_total} />
          <StatBox label="Won Deals" value={snapshot.pipeline_won} />
          <StatBox label="Conversion Rate" value={`${snapshot.conversion_rate}%`} />
          <StatBox label="Total Calls" value={snapshot.total_calls} />
          <StatBox label="Emails Sent" value={snapshot.total_emails_sent} />
          <StatBox label="Open Rate" value={`${snapshot.open_rate}%`} />
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="mx-auto max-w-[1600px] space-y-8">
          {/* ── Pipeline section ─────────────────────────────────────── */}
          <PipelineSection
            stages={pipelineStages}
            lost={snapshot.pipeline_lost}
            total={snapshot.pipeline_total}
            wonRevenue={snapshot.pipeline_won_revenue}
          />

          {/* ── Service type breakdown ───────────────────────────────── */}
          <ServiceSection services={serviceTypes} />

          {/* ── Receptionist + Marketing side-by-side ────────────────── */}
          <div className="grid gap-6 lg:grid-cols-2">
            <ReceptionistCard snapshot={snapshot} />
            <MarketingCard snapshot={snapshot} />
          </div>

          {/* ── Pipeline over time ───────────────────────────────────── */}
          <PipelineHistoryTable history={pipelineHistory} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatBox({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wider text-neutral-500">
        {label}
      </p>
    </div>
  );
}

function PipelineSection({
  stages,
  lost,
  total,
  wonRevenue,
}: {
  stages: { key: string; count: number }[];
  lost: number;
  total: number;
  wonRevenue: number;
}) {
  return (
    <section className="rounded-lg border border-neutral-900 bg-neutral-950/50 p-6">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-400">
        Pipeline Breakdown
      </h3>

      {/* Segmented bar */}
      {total > 0 ? (
        <div className="mb-4 flex h-8 w-full overflow-hidden rounded">
          {stages.map((stage) => {
            const pct = (stage.count / total) * 100;
            return pct > 0 ? (
              <div
                key={stage.key}
                className={`${STAGE_COLORS[stage.key] ?? "bg-neutral-700"} flex items-center justify-center text-xs font-bold text-white transition-all`}
                style={{ width: `${pct}%` }}
                title={`${STAGE_LABELS[stage.key]}: ${stage.count}`}
              >
                {pct >= 8 ? stage.count : ""}
              </div>
            ) : null;
          })}
        </div>
      ) : (
        <div className="mb-4 flex h-8 w-full items-center justify-center rounded bg-neutral-800 text-xs text-neutral-500">
          No leads in pipeline
        </div>
      )}

      {/* Stage legend */}
      <div className="mb-4 flex flex-wrap gap-4">
        {stages.map((stage) => (
          <div key={stage.key} className="flex items-center gap-1.5">
            <span
              className={`inline-block h-3 w-3 rounded-sm ${STAGE_COLORS[stage.key] ?? "bg-neutral-700"}`}
            />
            <span className="text-xs text-neutral-400">
              {STAGE_LABELS[stage.key]}{" "}
              <span className="font-mono text-white">{stage.count}</span>
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-red-600" />
          <span className="text-xs text-neutral-400">
            Lost <span className="font-mono text-red-400">{lost}</span>
          </span>
        </div>
      </div>

      {/* Won Revenue */}
      <div className="flex items-center gap-2 border-t border-neutral-800 pt-4">
        <span className="text-sm text-neutral-500">Estimated Won Revenue</span>
        <span className="text-xl font-bold text-amber-500">
          ${wonRevenue.toLocaleString()}
        </span>
        <span className="text-xs text-neutral-600">($5k/deal placeholder)</span>
      </div>
    </section>
  );
}

function ServiceSection({
  services,
}: {
  services: { key: string; count: number }[];
}) {
  return (
    <section>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-400">
        Leads by Service Type
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {services.map((svc) => (
          <div
            key={svc.key}
            className="rounded-lg border border-neutral-900 bg-neutral-950/50 p-5"
          >
            <div className="mb-3 text-2xl">
              {SERVICE_ICONS[svc.key] ?? "📋"}
            </div>
            <p className="text-2xl font-bold text-white">{svc.count}</p>
            <p className="mt-1 text-xs uppercase tracking-wider text-neutral-500">
              {SERVICE_LABELS[svc.key] ?? svc.key}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReceptionistCard({ snapshot }: { snapshot: AnalyticsSnapshot }) {
  const totalCalls = snapshot.answered_calls + snapshot.missed_calls;
  const answerRate =
    totalCalls > 0
      ? Math.round((snapshot.answered_calls / totalCalls) * 100)
      : 0;

  return (
    <section className="rounded-lg border border-neutral-900 bg-neutral-950/50 p-6">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-400">
        📞 Receptionist
      </h3>

      {/* Calls */}
      <div className="mb-4">
        <p className="mb-2 text-xs uppercase tracking-wider text-neutral-600">
          Calls
        </p>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-lg font-bold text-emerald-400">
              {snapshot.answered_calls}
            </p>
            <p className="text-xs text-neutral-500">Answered</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-red-400">
              {snapshot.missed_calls}
            </p>
            <p className="text-xs text-neutral-500">Missed</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white">
              {snapshot.total_calls}
            </p>
            <p className="text-xs text-neutral-500">Total</p>
          </div>
        </div>
        {/* Answer rate bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Answer rate</span>
            <span>{answerRate}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${answerRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="border-t border-neutral-800 pt-4">
        <p className="mb-2 text-xs uppercase tracking-wider text-neutral-600">
          Messages
        </p>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-lg font-bold text-blue-400">
              {snapshot.sms_messages}
            </p>
            <p className="text-xs text-neutral-500">SMS</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-purple-400">
              {snapshot.email_messages}
            </p>
            <p className="text-xs text-neutral-500">Email</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white">
              {snapshot.total_messages}
            </p>
            <p className="text-xs text-neutral-500">Total</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function MarketingCard({ snapshot }: { snapshot: AnalyticsSnapshot }) {
  return (
    <section className="rounded-lg border border-neutral-900 bg-neutral-950/50 p-6">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-400">
        📧 Marketing
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-lg font-bold text-white">
            {snapshot.active_campaigns}
          </p>
          <p className="text-xs text-neutral-500">Active Campaigns</p>
        </div>
        <div>
          <p className="text-lg font-bold text-white">
            {snapshot.total_emails_sent}
          </p>
          <p className="text-xs text-neutral-500">Emails Sent</p>
        </div>
        <div>
          <p className="text-lg font-bold text-emerald-400">
            {snapshot.open_rate}%
          </p>
          <p className="text-xs text-neutral-500">Open Rate</p>
        </div>
        <div>
          <p className="text-lg font-bold text-purple-400">
            {snapshot.reply_rate}%
          </p>
          <p className="text-xs text-neutral-500">Reply Rate</p>
        </div>
        <div>
          <p className="text-lg font-bold text-amber-400">
            {snapshot.total_scraped_leads}
          </p>
          <p className="text-xs text-neutral-500">Scraped Leads</p>
        </div>
        <div>
          <p className="text-lg font-bold text-white">
            {snapshot.imported_scraped_leads}
          </p>
          <p className="text-xs text-neutral-500">Imported to CRM</p>
        </div>
      </div>
    </section>
  );
}

function PipelineHistoryTable({
  history,
}: {
  history: PipelineOverTime[];
}) {
  return (
    <section className="rounded-lg border border-neutral-900 bg-neutral-950/50 p-6">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-400">
        Pipeline Over Time
      </h3>

      {history.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No pipeline data available yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-xs uppercase tracking-wider text-neutral-500">
                <th className="pb-3 pr-6 font-medium">Month</th>
                <th className="pb-3 pr-6 font-medium">New Leads</th>
                <th className="pb-3 font-medium">Won Deals</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr
                  key={row.month}
                  className="border-b border-neutral-900 transition-colors hover:bg-neutral-900/50"
                >
                  <td className="py-3 pr-6 font-mono text-neutral-300">
                    {row.month}
                  </td>
                  <td className="py-3 pr-6 font-mono text-white">
                    {row.new}
                  </td>
                  <td className="py-3 font-mono text-emerald-400">
                    {row.won}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
