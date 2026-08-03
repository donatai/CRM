import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { checkAuth } from "~/lib/auth";
import { useEffect, useState } from "react";
import {
  ensureTables,
  getLeads,
  getPipelineStats,
  type Lead,
  type PipelineStats,
} from "~/lib/crm-api";

export const Route = createFileRoute("/crm/")({
  beforeLoad: async () => {
    const { authenticated } = await checkAuth();
    if (!authenticated) {
      throw redirect({ to: "/login" });
    }
  },

  component: CrmDashboard,
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLUMNS: { key: string; label: string }[] = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "qualified", label: "Qualified" },
  { key: "proposal", label: "Proposal" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

const SERVICE_LABELS: Record<string, string> = {
  post_arm_guards: "Post Arm",
  events: "Events",
  private_clients: "Private Client",
  executive_protection: "Exec Protection",
};

const STATUS_COLORS: Record<string, string> = {
  new: "border-neutral-600",
  contacted: "border-blue-600",
  qualified: "border-amber-500",
  proposal: "border-purple-500",
  won: "border-emerald-500",
  lost: "border-red-700",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function CrmDashboard() {
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      // Ensure tables exist (idempotent)
      await ensureTables();

      const [statsResult, leadsResult] = await Promise.all([
        getPipelineStats(),
        getLeads({ data: statusFilter !== "all" ? { status: statusFilter } : {} }),
      ]);
      setStats(statsResult);
      setLeads(leadsResult);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load data";
      // If no DB connected, show a clean message
      if (msg.includes("DATABASE_URL")) {
        setError("Database not connected. Connect a database to enable the CRM.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  function leadsByStatus(status: string): Lead[] {
    return leads.filter((l) => l.status === status);
  }

  // -----------------------------------------------------------------------
  // Empty state (no DB)
  // -----------------------------------------------------------------------
  if (error) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black">
        <div className="text-center">
          <div className="mb-4 text-5xl">📊</div>
          <h2 className="mb-2 text-xl font-bold text-white">CRM</h2>
          <p className="max-w-md text-neutral-400">{error}</p>
          <p className="mt-4 text-sm text-neutral-600">
            The schema and API are ready. Connect a Neon database to activate the CRM.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black">
        <p className="text-neutral-500">Loading pipeline...</p>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Dashboard
  // -----------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-neutral-900 px-6 py-6">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
            <p className="mt-1 text-sm text-neutral-500">
              {stats?.total ?? 0} lead{stats?.total !== 1 ? "s" : ""} in pipeline
            </p>
          </div>
          <Link
            to="/crm/new"
            className="border border-white bg-white px-5 py-2.5 text-sm font-semibold uppercase tracking-widest text-black transition-colors hover:bg-neutral-200"
          >
            + New Lead
          </Link>
        </div>
      </header>

      {/* Stats bar */}
      {stats && (
        <div className="border-b border-neutral-900 px-6 py-4">
          <div className="mx-auto flex max-w-[1600px] flex-wrap gap-4">
            {COLUMNS.map((col) => (
              <button
                key={col.key}
                onClick={() =>
                  setStatusFilter(statusFilter === col.key ? "all" : col.key)
                }
                className={`flex items-center gap-2 rounded border px-4 py-2 text-sm transition-colors ${
                  statusFilter === col.key
                    ? "border-white bg-white/10 text-white"
                    : "border-neutral-800 text-neutral-400 hover:border-neutral-600"
                }`}
              >
                <span>{col.label}</span>
                <span className="font-mono text-xs">
                  {stats[col.key as keyof PipelineStats]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Kanban board */}
      <div className="px-6 py-6">
        <div className="mx-auto max-w-[1600px]">
          {leads.length === 0 ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <div className="text-center">
                <p className="text-neutral-500">
                  {statusFilter !== "all"
                    ? `No leads in "${statusFilter}".`
                    : "No leads yet."}
                </p>
                <Link
                  to="/crm/new"
                  className="mt-4 inline-block text-sm text-amber-500 hover:text-amber-400"
                >
                  + Add your first lead
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {COLUMNS.map((col) => {
                const columnLeads = leadsByStatus(col.key);
                return (
                  <div key={col.key} className="flex flex-col">
                    <div
                      className={`mb-3 flex items-center gap-2 border-t-2 ${STATUS_COLORS[col.key]} pt-2`}
                    >
                      <span className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
                        {col.label}
                      </span>
                      <span className="text-xs text-neutral-600">
                        {columnLeads.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {columnLeads.map((lead) => (
                        <Link
                          key={lead.id}
                          to="/crm/leads/$id"
                          params={{ id: String(lead.id) }}
                          className="group block rounded border border-neutral-800 bg-neutral-950 p-3 transition-colors hover:border-neutral-600"
                        >
                          <p className="text-sm font-medium text-white group-hover:text-amber-400">
                            {lead.name}
                          </p>
                          {lead.company && (
                            <p className="mt-0.5 text-xs text-neutral-500">
                              {lead.company}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-2">
                            {lead.service_type && (
                              <span className="inline-block rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400">
                                {SERVICE_LABELS[lead.service_type] ??
                                  lead.service_type}
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-[11px] text-neutral-600">
                            Updated{" "}
                            {formatRelative(new Date(lead.updated_at))}
                          </p>
                        </Link>
                      ))}
                      {columnLeads.length === 0 && (
                        <p className="py-6 text-center text-xs text-neutral-700">
                          —
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelative(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
