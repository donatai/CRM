import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ensureTables,
  createCampaign,
  addRecipients,
} from "~/lib/marketing-api";
// Re-use CRM lead types for recipient selection
import { getLeads as getCrmLeads, ensureTables as ensureCrmTables, type Lead } from "~/lib/crm-api";

export const Route = createFileRoute("/marketing/campaigns/new")({
  component: CampaignBuilder,
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function CampaignBuilder() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [subjectLine, setSubjectLine] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState(
    "Hi {{name}},\n\nI hope this email finds you well. I'm reaching out from no602, a licensed protection services firm.\n\nWe noticed {{company}} may benefit from our security services.\n\nWould you be open to a 15-minute call this week?\n\nBest,\nThe no602 Team",
  );

  const [crmLeads, setCrmLeads] = useState<Lead[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<number>>(new Set());

  // Manual recipient entries
  const [manualRecipients, setManualRecipients] = useState<
    { email: string; name: string; company: string }[]
  >([]);
  const [manualEmail, setManualEmail] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualCompany, setManualCompany] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCrmLeads();
  }, []);

  async function loadCrmLeads() {
    setLoading(true);
    setError(null);
    try {
      await ensureCrmTables();
      const leads = await getCrmLeads();
      setCrmLeads(leads);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load leads";
      if (!msg.includes("DATABASE_URL")) {
        setError(msg);
      }
      // If no DB, that's OK — we just won't pre-fill from CRM
    } finally {
      setLoading(false);
    }
  }

  function toggleCrmLead(id: number) {
    const next = new Set(selectedLeadIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLeadIds(next);
  }

  function addManualRecipient() {
    if (!manualEmail.trim() || !manualName.trim()) return;
    setManualRecipients([
      ...manualRecipients,
      { email: manualEmail.trim(), name: manualName.trim(), company: manualCompany.trim() },
    ]);
    setManualEmail("");
    setManualName("");
    setManualCompany("");
  }

  function removeManualRecipient(idx: number) {
    setManualRecipients(manualRecipients.filter((_, i) => i !== idx));
  }

  async function handleSave(status: "draft" | "active") {
    if (!name.trim() || !subjectLine.trim() || !bodyTemplate.trim()) {
      setError("Campaign name, subject line, and body template are required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await ensureTables();

      // Build recipients list from CRM + manual
      const recipients: { email: string; name: string; company?: string; lead_id?: number }[] = [];

      // Selected CRM leads
      for (const leadId of selectedLeadIds) {
        const lead = crmLeads.find((l) => l.id === leadId);
        if (lead && lead.email) {
          recipients.push({
            email: lead.email,
            name: lead.name,
            company: lead.company ?? undefined,
            lead_id: lead.id,
          });
        }
      }

      // Manual recipients
      for (const mr of manualRecipients) {
        recipients.push({
          email: mr.email,
          name: mr.name,
          company: mr.company || undefined,
        });
      }

      // Create campaign
      const campaign = await createCampaign({
        data: {
          name: name.trim(),
          subject_line: subjectLine.trim(),
          body_template: bodyTemplate.trim(),
          target_count: recipients.length,
        },
      });

      // Add recipients
      if (recipients.length > 0) {
        await addRecipients({
          data: {
            campaign_id: campaign.id,
            recipients,
          },
        });
      }

      // If launching, send immediately
      if (status === "active") {
        const { sendCampaign } = await import("~/lib/marketing-api");
        await sendCampaign({ data: campaign.id });
      }

      navigate({ to: "/marketing/campaigns/$id", params: { id: String(campaign.id) } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save campaign";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  const totalRecipients = selectedLeadIds.size + manualRecipients.length;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-neutral-900 px-6 py-6">
        <div className="mx-auto flex max-w-[1000px] items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">New Campaign</h1>
            <p className="mt-1 text-sm text-neutral-500">Create a cold email outreach campaign</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSave("draft")}
              disabled={saving}
              className="border border-neutral-700 px-5 py-2.5 text-sm font-semibold uppercase tracking-widest text-neutral-300 transition-colors hover:border-neutral-500 disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              onClick={() => handleSave("active")}
              disabled={saving}
              className="border border-amber-500 bg-amber-500 px-5 py-2.5 text-sm font-semibold uppercase tracking-widest text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
            >
              {saving ? "Launching..." : "Launch Campaign"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1000px] px-6 py-8">
        {error && (
          <div className="mb-6 rounded border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Campaign details */}
        <div className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-400">
              Campaign Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q1 Security Outreach"
              className="w-full rounded border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-400">
              Subject Line
            </label>
            <input
              type="text"
              value={subjectLine}
              onChange={(e) => setSubjectLine(e.target.value)}
              placeholder="e.g. Security Services for {{company}} — Let's Talk"
              className="w-full rounded border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-amber-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-neutral-600">
              Use {"{{"}name{"}}"} and {"{{"}company{"}}"} placeholders.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-400">
              Body Template
            </label>
            <textarea
              value={bodyTemplate}
              onChange={(e) => setBodyTemplate(e.target.value)}
              rows={10}
              className="w-full rounded border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-amber-500 focus:outline-none font-mono"
            />
            <p className="mt-1 text-xs text-neutral-600">
              Use {"{{"}name{"}}"} and {"{{"}company{"}}"} placeholders. These will be replaced per recipient.
            </p>
          </div>

          {/* Recipients */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-neutral-400">
                  Recipients
                </label>
                <p className="mt-0.5 text-xs text-neutral-600">
                  {totalRecipients} recipient{totalRecipients !== 1 ? "s" : ""} selected
                </p>
              </div>
            </div>

            {/* CRM leads */}
            {!loading && crmLeads.length > 0 && (
              <div className="mb-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  From CRM
                </p>
                <div className="max-h-48 overflow-y-auto rounded border border-neutral-800">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-neutral-950 text-xs uppercase tracking-wider text-neutral-500">
                        <th className="p-3 font-medium w-10"></th>
                        <th className="p-3 font-medium">Name</th>
                        <th className="p-3 font-medium">Company</th>
                        <th className="p-3 font-medium">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crmLeads
                        .filter((l) => l.email)
                        .map((l) => (
                          <tr
                            key={l.id}
                            className={`border-b border-neutral-900 transition-colors hover:bg-neutral-950 ${
                              selectedLeadIds.has(l.id) ? "bg-amber-500/5" : ""
                            }`}
                          >
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={selectedLeadIds.has(l.id)}
                                onChange={() => toggleCrmLead(l.id)}
                                className="rounded border-neutral-600 bg-neutral-900 accent-amber-500"
                              />
                            </td>
                            <td className="p-3 text-white">{l.name}</td>
                            <td className="p-3 text-neutral-400">{l.company || "—"}</td>
                            <td className="p-3 text-neutral-400">{l.email}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Manual recipients */}
            <div className="mb-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Add Manually
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                <input
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="Email"
                  className="flex-1 min-w-[200px] rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-amber-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Name"
                  className="flex-1 min-w-[150px] rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-amber-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={manualCompany}
                  onChange={(e) => setManualCompany(e.target.value)}
                  placeholder="Company (optional)"
                  className="flex-1 min-w-[150px] rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-amber-500 focus:outline-none"
                />
                <button
                  onClick={addManualRecipient}
                  disabled={!manualEmail.trim() || !manualName.trim()}
                  className="rounded border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-500 disabled:opacity-40 transition-colors"
                >
                  Add
                </button>
              </div>

              {manualRecipients.length > 0 && (
                <div className="rounded border border-neutral-800">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-neutral-950 text-xs uppercase tracking-wider text-neutral-500">
                        <th className="p-3 font-medium">Email</th>
                        <th className="p-3 font-medium">Name</th>
                        <th className="p-3 font-medium">Company</th>
                        <th className="p-3 font-medium w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {manualRecipients.map((r, i) => (
                        <tr key={i} className="border-b border-neutral-900">
                          <td className="p-3 text-white">{r.email}</td>
                          <td className="p-3 text-white">{r.name}</td>
                          <td className="p-3 text-neutral-400">{r.company || "—"}</td>
                          <td className="p-3">
                            <button
                              onClick={() => removeManualRecipient(i)}
                              className="text-neutral-600 hover:text-red-400 transition-colors text-xs"
                            >
                              ✕
                            </button>
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
      </div>
    </div>
  );
}
