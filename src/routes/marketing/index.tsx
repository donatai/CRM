import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ensureTables,
  getCampaigns,
  getScrapedLeads,
  getMarketingStats,
  importToCRM,
  type Campaign,
  type ScrapedLead,
  type MarketingStats,
} from "~/lib/marketing-api";

export const Route = createFileRoute("/marketing/")({
  component: MarketingDashboard,
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  draft: "border-neutral-500 text-neutral-400",
  active: "border-emerald-500 text-emerald-400",
  paused: "border-amber-500 text-amber-400",
  completed: "border-blue-500 text-blue-400",
};

const RECIPIENT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-neutral-800 text-neutral-400",
  sent: "bg-blue-900/50 text-blue-400",
  opened: "bg-emerald-900/50 text-emerald-400",
  replied: "bg-purple-900/50 text-purple-400",
  bounced: "bg-red-900/50 text-red-400",
  unsubscribed: "bg-red-900/50 text-red-400",
};

const SOURCE_LABELS: Record<string, string> = {
  google_maps: "Google Maps",
  linkedin: "LinkedIn",
  website: "Website",
  directory: "Directory",
};

const SOURCE_COLORS: Record<string, string> = {
  google_maps: "bg-green-900/50 text-green-400",
  linkedin: "bg-blue-900/50 text-blue-400",
  website: "bg-purple-900/50 text-purple-400",
  directory: "bg-amber-900/50 text-amber-400",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function MarketingDashboard() {
  const [tab, setTab] = useState<"campaigns" | "scraping">("campaigns");
  const [stats, setStats] = useState<MarketingStats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [scrapedLeads, setScrapedLeads] = useState<ScrapedLead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      await ensureTables();

      const [statsResult, campaignsResult, scrapedResult] = await Promise.all([
        getMarketingStats(),
        getCampaigns(),
        getScrapedLeads(),
      ]);
      setStats(statsResult);
      setCampaigns(campaignsResult);
      setScrapedLeads(scrapedResult);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load data";
      if (msg.includes("DATABASE_URL")) {
        setError("Database not connected. Connect a database to enable marketing tools.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleImportSelected() {
    if (selectedLeads.size === 0) return;
    setImporting(true);
    try {
      await importToCRM({ data: Array.from(selectedLeads) });
      setSelectedLeads(new Set());
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import failed";
      setError(msg);
    } finally {
      setImporting(false);
    }
  }

  function toggleLead(id: number) {
    const next = new Set(selectedLeads);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLeads(next);
  }

  function toggleAll() {
    if (selectedLeads.size === scrapedLeads.filter((l) => !l.imported_to_crm).length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(scrapedLeads.filter((l) => !l.imported_to_crm).map((l) => l.id)));
    }
  }

  // -----------------------------------------------------------------------
  // Empty state (no DB)
  // -----------------------------------------------------------------------
  if (error) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black">
        <div className="text-center">
          <div className="mb-4 text-5xl">📧</div>
          <h2 className="mb-2 text-xl font-bold text-white">Marketing Engine</h2>
          <p className="max-w-md text-neutral-400">{error}</p>
          <p className="mt-4 text-sm text-neutral-600">
            The schema and API are ready. Connect a Neon database to activate the marketing engine.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black">
        <p className="text-neutral-500">Loading marketing dashboard...</p>
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
            <h1 className="text-2xl font-bold tracking-tight">Marketing</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Campaigns and lead generation
            </p>
          </div>
          <div className="flex items-center gap-3">
            {tab === "campaigns" ? (
              <Link
                to="/marketing/campaigns/new"
                className="border border-white bg-white px-5 py-2.5 text-sm font-semibold uppercase tracking-widest text-black transition-colors hover:bg-neutral-200"
              >
                + New Campaign
              </Link>
            ) : (
              <Link
                to="/marketing/scrape"
                className="border border-white bg-white px-5 py-2.5 text-sm font-semibold uppercase tracking-widest text-black transition-colors hover:bg-neutral-200"
              >
                + New Scrape
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Stats bar */}
      {stats && (
        <div className="border-b border-neutral-900 px-6 py-4">
          <div className="mx-auto flex max-w-[1600px] flex-wrap gap-6">
            <StatBox label="Active Campaigns" value={stats.active_campaigns} />
            <StatBox label="Emails Sent" value={stats.total_sent} />
            <StatBox label="Open Rate" value={`${stats.open_rate}%`} />
            <StatBox label="Reply Rate" value={`${stats.reply_rate}%`} />
            <StatBox label="Scraped Leads" value={stats.scraped_leads} />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-neutral-900 px-6">
        <div className="mx-auto flex max-w-[1600px] gap-0">
          <button
            onClick={() => setTab("campaigns")}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              tab === "campaigns"
                ? "border-b-2 border-amber-500 text-white"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            Campaigns
          </button>
          <button
            onClick={() => setTab("scraping")}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              tab === "scraping"
                ? "border-b-2 border-amber-500 text-white"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            Lead Scraping
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-6 py-6">
        <div className="mx-auto max-w-[1600px]">
          {tab === "campaigns" ? (
            <CampaignsTab campaigns={campaigns} />
          ) : (
            <ScrapingTab
              leads={scrapedLeads}
              selectedLeads={selectedLeads}
              onToggle={toggleLead}
              onToggleAll={toggleAll}
              onImport={handleImportSelected}
              importing={importing}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wider text-neutral-500">{label}</p>
    </div>
  );
}

function CampaignsTab({ campaigns }: { campaigns: Campaign[] }) {
  if (campaigns.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-500">No campaigns yet.</p>
          <Link
            to="/marketing/campaigns/new"
            className="mt-4 inline-block text-sm text-amber-500 hover:text-amber-400"
          >
            + Create your first campaign
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-800 text-xs uppercase tracking-wider text-neutral-500">
            <th className="pb-3 pr-4 font-medium">Campaign</th>
            <th className="pb-3 pr-4 font-medium">Status</th>
            <th className="pb-3 pr-4 font-medium">Progress</th>
            <th className="pb-3 pr-4 font-medium">Sent</th>
            <th className="pb-3 pr-4 font-medium">Opened</th>
            <th className="pb-3 pr-4 font-medium">Replied</th>
            <th className="pb-3 pr-4 font-medium">Open Rate</th>
            <th className="pb-3 font-medium">Reply Rate</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => {
            const openRate = c.sent_count > 0 ? Math.round((c.opened_count / c.sent_count) * 100) : 0;
            const replyRate = c.sent_count > 0 ? Math.round((c.replied_count / c.sent_count) * 100) : 0;
            const progress = c.target_count > 0 ? Math.round((c.sent_count / c.target_count) * 100) : 0;

            return (
              <tr
                key={c.id}
                className="border-b border-neutral-900 transition-colors hover:bg-neutral-950"
              >
                <td className="py-4 pr-4">
                  <Link
                    to="/marketing/campaigns/$id"
                    params={{ id: String(c.id) }}
                    className="font-medium text-white hover:text-amber-400"
                  >
                    {c.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-neutral-500">{c.subject_line}</p>
                </td>
                <td className="py-4 pr-4">
                  <span
                    className={`inline-block rounded border px-2 py-0.5 text-xs font-medium uppercase ${
                      STATUS_COLORS[c.status] ?? "border-neutral-600 text-neutral-400"
                    }`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="py-4 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-800">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-neutral-500">
                      {c.sent_count}/{c.target_count}
                    </span>
                  </div>
                </td>
                <td className="py-4 pr-4 font-mono text-sm">{c.sent_count}</td>
                <td className="py-4 pr-4 font-mono text-sm text-emerald-400">{c.opened_count}</td>
                <td className="py-4 pr-4 font-mono text-sm text-purple-400">{c.replied_count}</td>
                <td className="py-4 pr-4 font-mono text-sm">{openRate}%</td>
                <td className="py-4 font-mono text-sm">{replyRate}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ScrapingTab({
  leads,
  selectedLeads,
  onToggle,
  onToggleAll,
  onImport,
  importing,
}: {
  leads: ScrapedLead[];
  selectedLeads: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  onImport: () => void;
  importing: boolean;
}) {
  const importable = leads.filter((l) => !l.imported_to_crm);

  if (leads.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-500">No scraped leads yet.</p>
          <Link
            to="/marketing/scrape"
            className="mt-4 inline-block text-sm text-amber-500 hover:text-amber-400"
          >
            + Scrape your first leads
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {importable.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={onToggleAll}
            className="text-sm text-neutral-400 hover:text-white transition-colors"
          >
            {selectedLeads.size === importable.length ? "Deselect All" : "Select All"}
          </button>
          <button
            onClick={onImport}
            disabled={selectedLeads.size === 0 || importing}
            className={`rounded px-4 py-2 text-sm font-medium transition-colors ${
              selectedLeads.size === 0 || importing
                ? "border border-neutral-700 text-neutral-600 cursor-not-allowed"
                : "border border-amber-500 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
            }`}
          >
            {importing ? "Importing..." : `Import to CRM (${selectedLeads.size})`}
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-xs uppercase tracking-wider text-neutral-500">
              <th className="pb-3 pr-2 font-medium w-8">
                <input
                  type="checkbox"
                  checked={
                    importable.length > 0 &&
                    selectedLeads.size === importable.length &&
                    selectedLeads.size > 0
                  }
                  onChange={onToggleAll}
                  className="rounded border-neutral-600 bg-neutral-900 accent-amber-500"
                />
              </th>
              <th className="pb-3 pr-4 font-medium">Name</th>
              <th className="pb-3 pr-4 font-medium">Company</th>
              <th className="pb-3 pr-4 font-medium">Email</th>
              <th className="pb-3 pr-4 font-medium">Source</th>
              <th className="pb-3 pr-4 font-medium">Industry</th>
              <th className="pb-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr
                key={l.id}
                className={`border-b border-neutral-900 transition-colors ${
                  l.imported_to_crm ? "opacity-50" : "hover:bg-neutral-950"
                }`}
              >
                <td className="py-4 pr-2">
                  {!l.imported_to_crm && (
                    <input
                      type="checkbox"
                      checked={selectedLeads.has(l.id)}
                      onChange={() => onToggle(l.id)}
                      className="rounded border-neutral-600 bg-neutral-900 accent-amber-500"
                    />
                  )}
                </td>
                <td className="py-4 pr-4 font-medium text-white">{l.name}</td>
                <td className="py-4 pr-4 text-neutral-400">{l.company || "—"}</td>
                <td className="py-4 pr-4 text-neutral-400">{l.email || "—"}</td>
                <td className="py-4 pr-4">
                  {l.source_type ? (
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                        SOURCE_COLORS[l.source_type] ?? "bg-neutral-800 text-neutral-400"
                      }`}
                    >
                      {SOURCE_LABELS[l.source_type] ?? l.source_type}
                    </span>
                  ) : (
                    <span className="text-neutral-600">—</span>
                  )}
                </td>
                <td className="py-4 pr-4 text-neutral-400">{l.industry || "—"}</td>
                <td className="py-4">
                  {l.imported_to_crm ? (
                    <span className="inline-block rounded bg-emerald-900/50 px-2 py-0.5 text-xs font-medium text-emerald-400">
                      In CRM
                    </span>
                  ) : (
                    <span className="inline-block rounded bg-neutral-800 px-2 py-0.5 text-xs font-medium text-neutral-500">
                      New
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
