import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  getLead,
  updateLead,
  addActivity,
  addContact,
  type Lead,
  type Contact,
  type Activity,
} from "~/lib/crm-api";

export const Route = createFileRoute("/crm/leads/$id")({
  component: LeadDetail,
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUSES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

const SERVICE_LABELS: Record<string, string> = {
  post_arm_guards: "Post Arm Guards",
  events: "Event Security",
  private_clients: "Private Clients & Residences",
  executive_protection: "Executive Protection",
};

const ACTIVITY_ICONS: Record<string, string> = {
  call: "📞",
  email: "✉️",
  meeting: "🤝",
  note: "📝",
};

const STATUS_COLOR: Record<string, string> = {
  new: "border-neutral-500 text-neutral-400",
  contacted: "border-blue-500 text-blue-400",
  qualified: "border-amber-500 text-amber-400",
  proposal: "border-purple-500 text-purple-400",
  won: "border-emerald-500 text-emerald-400",
  lost: "border-red-600 text-red-400",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function LeadDetail() {
  const { id } = Route.useParams();
  const leadId = Number(id);

  const [lead, setLead] = useState<Lead | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editName, setEditName] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editServiceType, setEditServiceType] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // New activity
  const [newActivityType, setNewActivityType] = useState("note");
  const [newActivityDesc, setNewActivityDesc] = useState("");

  // New contact
  const [showContactForm, setShowContactForm] = useState(false);
  const [newContact, setNewContact] = useState({
    name: "",
    email: "",
    phone: "",
    role: "",
    notes: "",
  });

  // Dirty tracking for auto-save
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    loadLead();
  }, [leadId]);

  async function loadLead() {
    setLoading(true);
    setError(null);
    try {
      const result = await getLead({ data: leadId });
      if (!result.lead) {
        setError("Lead not found.");
        setLoading(false);
        return;
      }
      setLead(result.lead);
      setContacts(result.contacts);
      setActivities(result.activities);

      // Populate edit fields
      setEditName(result.lead.name);
      setEditCompany(result.lead.company ?? "");
      setEditEmail(result.lead.email ?? "");
      setEditPhone(result.lead.phone ?? "");
      setEditServiceType(result.lead.service_type ?? "");
      setEditNotes(result.lead.notes ?? "");
      setDirty(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load lead";
      setError(msg.includes("DATABASE_URL") ? "Database not connected." : msg);
    } finally {
      setLoading(false);
    }
  }

  function markDirty() {
    setDirty(true);
  }

  async function saveLead() {
    if (!dirty || !lead) return;
    setSaving(true);
    try {
      const updated = await updateLead({
        data: {
          id: lead.id,
          name: editName,
          company: editCompany || undefined,
          email: editEmail || undefined,
          phone: editPhone || undefined,
          service_type: editServiceType || undefined,
          notes: editNotes || undefined,
        },
      });
      if (updated) {
        setLead(updated);
        setDirty(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(newStatus: string) {
    if (!lead) return;
    setSaving(true);
    try {
      const updated = await updateLead({
        data: { id: lead.id, status: newStatus },
      });
      if (updated) {
        setLead(updated);

        // Log status change as activity
        const activity = await addActivity({
          data: {
            lead_id: lead.id,
            type: "note",
            description: `Status changed to "${newStatus}".`,
          },
        });
        setActivities((prev) => [activity, ...prev]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Status change failed";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!newActivityDesc.trim() || !lead) return;
    try {
      const activity = await addActivity({
        data: {
          lead_id: lead.id,
          type: newActivityType,
          description: newActivityDesc.trim(),
        },
      });
      setActivities((prev) => [activity, ...prev]);
      setNewActivityDesc("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add activity";
      setError(msg);
    }
  }

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    if (!newContact.name.trim() || !lead) return;
    try {
      const contact = await addContact({
        data: {
          lead_id: lead.id,
          name: newContact.name.trim(),
          email: newContact.email.trim() || undefined,
          phone: newContact.phone.trim() || undefined,
          role: newContact.role.trim() || undefined,
          notes: newContact.notes.trim() || undefined,
        },
      });
      setContacts((prev) => [contact, ...prev]);
      setNewContact({ name: "", email: "", phone: "", role: "", notes: "" });
      setShowContactForm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add contact";
      setError(msg);
    }
  }

  // -----------------------------------------------------------------------
  // States
  // -----------------------------------------------------------------------

  if (error && !lead) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black">
        <div className="text-center">
          <p className="text-neutral-400">{error}</p>
          <Link to="/crm" className="mt-4 inline-block text-sm text-amber-500 hover:text-amber-400">
            &larr; Back to pipeline
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black">
        <p className="text-neutral-500">Loading lead...</p>
      </div>
    );
  }

  if (!lead) return null;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const inputClass =
    "w-full border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";
  const labelClass =
    "mb-1 block text-[11px] font-semibold uppercase tracking-widest text-neutral-500";

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-neutral-900 px-6 py-5">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <Link
              to="/crm"
              className="mb-2 inline-block text-xs text-neutral-500 transition-colors hover:text-neutral-300"
            >
              &larr; Pipeline
            </Link>
            <h1 className="text-xl font-bold tracking-tight">{lead.name}</h1>
            {lead.company && (
              <p className="text-sm text-neutral-500">{lead.company}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${STATUS_COLOR[lead.status] ?? "border-neutral-600 text-neutral-400"}`}
            >
              {lead.status}
            </span>
            {dirty && (
              <button
                onClick={saveLead}
                disabled={saving}
                className="border border-amber-500 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {error && (
          <div className="mb-6 border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-3">
          {/* ---- Main column: lead fields ---- */}
          <div className="lg:col-span-2 space-y-8">
            {/* Status change buttons */}
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
                Move to Stage
              </h2>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => changeStatus(s.value)}
                    disabled={s.value === lead.status || saving}
                    className={`rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
                      s.value === lead.status
                        ? "border-white bg-white/10 text-white"
                        : "border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
                    } disabled:cursor-not-allowed`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Editable fields */}
            <section>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-400">
                Lead Information
              </h2>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Name</label>
                    <input
                      className={inputClass}
                      value={editName}
                      onChange={(e) => {
                        setEditName(e.target.value);
                        markDirty();
                      }}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Company</label>
                    <input
                      className={inputClass}
                      value={editCompany}
                      onChange={(e) => {
                        setEditCompany(e.target.value);
                        markDirty();
                      }}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Email</label>
                    <input
                      type="email"
                      className={inputClass}
                      value={editEmail}
                      onChange={(e) => {
                        setEditEmail(e.target.value);
                        markDirty();
                      }}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Phone</label>
                    <input
                      type="tel"
                      className={inputClass}
                      value={editPhone}
                      onChange={(e) => {
                        setEditPhone(e.target.value);
                        markDirty();
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Service Type</label>
                  <select
                    className={`${inputClass} appearance-none`}
                    value={editServiceType}
                    onChange={(e) => {
                      setEditServiceType(e.target.value);
                      markDirty();
                    }}
                  >
                    <option value="">—</option>
                    {Object.entries(SERVICE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Notes</label>
                  <textarea
                    rows={4}
                    className={inputClass}
                    value={editNotes}
                    onChange={(e) => {
                      setEditNotes(e.target.value);
                      markDirty();
                    }}
                  />
                </div>
                {dirty && (
                  <button
                    onClick={saveLead}
                    disabled={saving}
                    className="border border-amber-500 px-6 py-2 text-xs font-semibold uppercase tracking-widest text-amber-400 transition-colors hover:bg-amber-500/10 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                )}
              </div>
            </section>

            {/* Activity timeline */}
            <section>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-400">
                Activity Timeline
              </h2>

              {/* Add activity form */}
              <form
                onSubmit={handleAddActivity}
                className="mb-6 flex gap-2"
              >
                <select
                  value={newActivityType}
                  onChange={(e) => setNewActivityType(e.target.value)}
                  className="border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white focus:border-neutral-600 focus:outline-none"
                >
                  <option value="call">📞 Call</option>
                  <option value="email">✉️ Email</option>
                  <option value="meeting">🤝 Meeting</option>
                  <option value="note">📝 Note</option>
                </select>
                <input
                  type="text"
                  className="flex-1 border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
                  placeholder="What happened?"
                  value={newActivityDesc}
                  onChange={(e) => setNewActivityDesc(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={!newActivityDesc.trim()}
                  className="border border-neutral-700 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-300 transition-colors hover:border-neutral-500 disabled:opacity-40"
                >
                  Log
                </button>
              </form>

              {/* Activity list */}
              {activities.length === 0 ? (
                <p className="py-6 text-center text-xs text-neutral-700">
                  No activities yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {activities.map((a) => (
                    <div
                      key={a.id}
                      className="flex gap-3 border-l-2 border-neutral-900 pl-4"
                    >
                      <span className="mt-0.5 text-sm">
                        {ACTIVITY_ICONS[a.type] ?? "•"}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm text-neutral-300">
                          {a.description}
                        </p>
                        <p className="mt-0.5 text-[11px] text-neutral-600">
                          {formatDate(a.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* ---- Sidebar: contacts ---- */}
          <div className="space-y-6">
            {/* Meta */}
            <div className="border border-neutral-900 bg-neutral-950/50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                Timeline
              </p>
              <div className="mt-2 space-y-1 text-xs text-neutral-400">
                <p>
                  Created: {formatDate(lead.created_at)}
                </p>
                <p>
                  Updated: {formatDate(lead.updated_at)}
                </p>
              </div>
            </div>

            {/* Contacts */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
                  Contacts
                </h2>
                <button
                  onClick={() => setShowContactForm(!showContactForm)}
                  className="text-xs text-amber-500 hover:text-amber-400"
                >
                  {showContactForm ? "Cancel" : "+ Add"}
                </button>
              </div>

              {showContactForm && (
                <form
                  onSubmit={handleAddContact}
                  className="mb-4 space-y-2 border border-neutral-800 bg-neutral-950 p-3"
                >
                  <input
                    className={inputClass}
                    placeholder="Name *"
                    value={newContact.name}
                    onChange={(e) =>
                      setNewContact((p) => ({ ...p, name: e.target.value }))
                    }
                    required
                  />
                  <input
                    className={inputClass}
                    placeholder="Email"
                    value={newContact.email}
                    onChange={(e) =>
                      setNewContact((p) => ({ ...p, email: e.target.value }))
                    }
                  />
                  <input
                    className={inputClass}
                    placeholder="Phone"
                    value={newContact.phone}
                    onChange={(e) =>
                      setNewContact((p) => ({ ...p, phone: e.target.value }))
                    }
                  />
                  <input
                    className={inputClass}
                    placeholder="Role"
                    value={newContact.role}
                    onChange={(e) =>
                      setNewContact((p) => ({ ...p, role: e.target.value }))
                    }
                  />
                  <textarea
                    className={`${inputClass} resize-none`}
                    rows={2}
                    placeholder="Notes"
                    value={newContact.notes}
                    onChange={(e) =>
                      setNewContact((p) => ({ ...p, notes: e.target.value }))
                    }
                  />
                  <button
                    type="submit"
                    disabled={!newContact.name.trim()}
                    className="border border-amber-500 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400 transition-colors hover:bg-amber-500/10 disabled:opacity-40"
                  >
                    Add Contact
                  </button>
                </form>
              )}

              {contacts.length === 0 && !showContactForm ? (
                <p className="py-4 text-center text-xs text-neutral-700">
                  No contacts added.
                </p>
              ) : (
                <div className="space-y-2">
                  {contacts.map((c) => (
                    <div
                      key={c.id}
                      className="border border-neutral-900 bg-neutral-950/50 p-3"
                    >
                      <p className="text-sm font-medium text-white">
                        {c.name}
                      </p>
                      {c.role && (
                        <p className="text-xs text-neutral-400">{c.role}</p>
                      )}
                      {c.email && (
                        <p className="mt-1 text-xs text-neutral-500">
                          {c.email}
                        </p>
                      )}
                      {c.phone && (
                        <p className="text-xs text-neutral-500">{c.phone}</p>
                      )}
                      {c.notes && (
                        <p className="mt-1 text-xs italic text-neutral-600">
                          {c.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
