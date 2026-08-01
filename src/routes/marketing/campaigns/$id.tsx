import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ensureTables,
  getCampaign,
  sendCampaign,
  updateCampaign,
  type Campaign,
  type CampaignRecipient,
} from "~/lib/marketing-api";

export const Route = createFileRoute("/marketing/campaigns/$id")({
  component: CampaignDetail,
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RECIPIENT_STATUS_COLORS: Record<string, string> = {
  pending: "border-neutral-600 text-neutral-400",
  sent: "border-blue-600 text-blue-400",
  opened: "border-emerald-600 text-emerald-400",
  replied: "border-purple-600 text-purple-400",
  bounced: "border-red-600 text-red-400",
  unsubscribed: "border-red-600 text-red-400",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "border-neutral-500 text-neutral-400",
  active: "border-emerald-500 text-emerald-400",
  paused: "border-amber-500 text-amber-400",
  completed: "border-blue-500 text-blue-400",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function CampaignDetail() {
  const { id } = Route.useParams();
  const campaignId = Number(id);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [campaignId]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      await ensureTables();
      const result = await getCampaign({ data: campaignId });
      if (result.campaign) {
        setCampaign(result.campaign);
        setRecipients(result.recipients);
      } else {
        setError("Campaign not found.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load campaign";
      if (msg.includes("DATABASE_URL")) {
        setError("Database not connected. Connect a database to view campaigns.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    setActionLoading(true);
    try {
      const updated = await sendCampaign({ data: campaignId });
      if (updated) setCampaign(updated);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send";
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    setActionLoading(true);
    try {
      const updated = await updateCampaign({
        data: { id: campaignId, status: newStatus },
      });
      if (updated) setCampaign(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update status";
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  }

  // -----------------------------------------------------------------------
  // Loading / Error / Empty
  // -----------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black">
        <p className="text-neutral-500">Loading campaign...</p>
      </div>
    );
  }

  if (error && !campaign) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black">
        <div className="text-center">
          <div className="mb-4 text-5xl">📧</div>
          <h2 className="mb-2 text-xl font-bold text-white">Campaign</h2>
          <p className="max-w-md text-neutral-400">{error}</p>
          <Link
            to="/marketing"
            className="mt-4 inline-block text-sm text-amber-500 hover:text-amber-400"
          >
            &larr; Back to Marketing
          </Link>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black">
        <div className="text-center">
          <p className="text-neutral-500">Campaign not found.</p>
          <Link
            to="/marketing"
            className="mt-4 inline-block text-sm text-amber-500 hover:text-amber-400"
          >
            &larr; Back to Marketing
          </Link>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Stats computed
  // -----------------------------------------------------------------------
  const openRate = campaign.sent_count > 0 ? Math.round((campaign.opened_count / campaign.sent_count) * 100) : 0;
  const replyRate = campaign.sent_count > 0 ? Math.round((campaign.replied_count / campaign.sent_count) * 100) : 0;
  const progress = campaign.target_count > 0 ? Math.round((campaign.sent_count / campaign.target_count) * 100) : 0;

  const bounced = recipients.filter((r) => r.status === "bounced").length;
  const unsubscribed = recipients.filter((r) => r.status === "unsubscribed").length;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-neutral-900 px-6 py-6">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <div>
            <Link
              to="/marketing"
              className="mb-2 inline-block text-sm text-neutral-500 hover:text-neutral-300"
            >
              &larr; Marketing
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">{campaign.name}</h1>
            <p className="mt-1 text-sm text-neutral-500">{campaign.subject_line}</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-block rounded border px-3 py-1 text-xs font-medium uppercase ${
                STATUS_COLORS[campaign.status] ?? "border-neutral-600 text-neutral-400"
              }`}
            >
              {campaign.status}
            </span>
            {campaign.status === "draft" && (
              <button
                onClick={handleSend}
                disabled={actionLoading}
                className="border border-amber-500 bg-amber-500 px-5 py-2 text-sm font-semibold uppercase tracking-widest text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
              >
                {actionLoading ? "Sending..." : "Send Now"}
              </button>
            )}
            {campaign.status === "active" && (
              <button
                onClick={() => handleStatusChange("paused")}
                disabled={actionLoading}
                className="border border-amber-500 px-5 py-2 text-sm font-semibold uppercase tracking-widest text-amber-400 transition-colors hover:bg-amber-500/10 disabled:opacity-50"
              >
                Pause
              </button>
            )}
            {campaign.status === "paused" && (
              <button
                onClick={() => handleStatusChange("active")}
                disabled={actionLoading}
                className="border border-emerald-500 px-5 py-2 text-sm font-semibold uppercase tracking-widest text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
              >
                Resume
              </button>
            )}
            {(campaign.status === "active" || campaign.status === "paused") && (
              <button
                onClick={() => handleStatusChange("completed")}
                disabled={actionLoading}
                className="border border-neutral-700 px-5 py-2 text-sm font-semibold uppercase tracking-widest text-neutral-300 transition-colors hover:border-neutral-500 disabled:opacity-50"
              >
                Complete
              </button>
            )}
            <button
              onClick={() => {
                const csv = [
                  "Name,Email,Company,Status,Sent At,Opened At",
                  ...recipients.map(
                    (r) =>
                      `${r.name},${r.email},${r.company ?? ""},${r.status},${r.sent_at ?? ""},${r.opened_at ?? ""}`,
                  ),
                ].join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `campaign-${campaign.id}-export.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="border border-neutral-700 px-5 py-2 text-sm font-semibold uppercase tracking-widest text-neutral-300 transition-colors hover:border-neutral-500"
            >
              Export
            </button>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="border-b border-neutral-900 px-6 py-6">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-4 flex items-center gap-3">
            <span className="text-sm text-neutral-500">Progress:</span>
            <div className="h-2 flex-1 max-w-xs overflow-hidden rounded-full bg-neutral-800">
              <div
                className="h-full rounded-full bg-amber-500 transition-all"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <span className="text-xs text-neutral-400">
              {campaign.sent_count}/{campaign.target_count}
            </span>
          </div>

          <div className="grid grid-cols-5 gap-6">
            <StatBox label="Sent" value={campaign.sent_count} color="text-blue-400" />
            <StatBox label="Opened" value={campaign.opened_count} color="text-emerald-400" />
            <StatBox label="Replied" value={campaign.replied_count} color="text-purple-400" />
            <StatBox label="Bounced" value={bounced} color="text-red-400" />
            <StatBox label="Unsubscribed" value={unsubscribed} color="text-red-400" />
          </div>
          <div className="mt-4 flex gap-8">
            <span className="text-sm text-neutral-500">
              Open rate: <span className="text-emerald-400 font-mono">{openRate}%</span>
            </span>
            <span className="text-sm text-neutral-500">
              Reply rate: <span className="text-purple-400 font-mono">{replyRate}%</span>
            </span>
          </div>
        </div>
      </div>

      {/* Body template preview */}
      <div className="border-b border-neutral-900 px-6 py-6">
        <div className="mx-auto max-w-[1600px]">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Email Template
          </h3>
          <pre className="whitespace-pre-wrap rounded border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400 font-mono">
            {campaign.body_template}
          </pre>
        </div>
      </div>

      {/* Recipients */}
      <div className="px-6 py-6">
        <div className="mx-auto max-w-[1600px]">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Recipients ({recipients.length})
          </h3>

          {recipients.length === 0 ? (
            <p className="text-neutral-600">No recipients added to this campaign.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 text-xs uppercase tracking-wider text-neutral-500">
                    <th className="pb-3 pr-4 font-medium">Name</th>
                    <th className="pb-3 pr-4 font-medium">Email</th>
                    <th className="pb-3 pr-4 font-medium">Company</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 pr-4 font-medium">Sent At</th>
                    <th className="pb-3 font-medium">Opened At</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-neutral-900 transition-colors hover:bg-neutral-950"
                    >
                      <td className="py-4 pr-4 font-medium text-white">{r.name}</td>
                      <td className="py-4 pr-4 text-neutral-400">{r.email}</td>
                      <td className="py-4 pr-4 text-neutral-400">{r.company || "—"}</td>
                      <td className="py-4 pr-4">
                        <span
                          className={`inline-block rounded border px-2 py-0.5 text-xs font-medium uppercase ${
                            RECIPIENT_STATUS_COLORS[r.status] ?? "border-neutral-600 text-neutral-400"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-neutral-500">
                        {r.sent_at ? formatTimestamp(r.sent_at) : "—"}
                      </td>
                      <td className="py-4 text-neutral-500">
                        {r.opened_at ? formatTimestamp(r.opened_at) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
  color = "text-white",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="rounded border border-neutral-800 bg-neutral-950 p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wider text-neutral-500">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
