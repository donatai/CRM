import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { createLead } from "~/lib/crm-api";

export const Route = createFileRoute("/crm/new")({
  component: NewLead,
});

const SERVICE_TYPES = [
  { value: "", label: "Select service type..." },
  { value: "post_arm_guards", label: "Post Arm Guards" },
  { value: "events", label: "Event Security" },
  { value: "private_clients", label: "Private Clients & Residences" },
  { value: "executive_protection", label: "Executive Protection" },
];

function NewLead() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    service_type: "",
    notes: "",
  });

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const lead = await createLead({
        data: {
          name: form.name.trim(),
          company: form.company.trim() || undefined,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          service_type: form.service_type || undefined,
          notes: form.notes.trim() || undefined,
        },
      });
      navigate({ to: "/crm/leads/$id", params: { id: String(lead.id) } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create lead";
      setError(msg.includes("DATABASE_URL") ? "Database not connected." : msg);
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";
  const labelClass =
    "mb-2 block text-xs font-semibold uppercase tracking-widest text-neutral-400";

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-neutral-900 px-6 py-6">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight">New Lead</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Add a lead to the pipeline.
          </p>
        </div>
      </header>

      <section className="px-6 py-12">
        <div className="mx-auto max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name — required */}
            <div>
              <label htmlFor="name" className={labelClass}>
                Name <span className="text-amber-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                className={inputClass}
                placeholder="Contact or company name"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
              />
            </div>

            {/* Company */}
            <div>
              <label htmlFor="company" className={labelClass}>
                Company
              </label>
              <input
                id="company"
                type="text"
                className={inputClass}
                placeholder="Company name"
                value={form.company}
                onChange={(e) => updateField("company", e.target.value)}
              />
            </div>

            {/* Email & Phone */}
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className={labelClass}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  className={inputClass}
                  placeholder="email@company.com"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="phone" className={labelClass}>
                  Phone
                </label>
                <input
                  id="phone"
                  type="tel"
                  className={inputClass}
                  placeholder="(555) 000-0000"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                />
              </div>
            </div>

            {/* Service type */}
            <div>
              <label htmlFor="service_type" className={labelClass}>
                Service Type
              </label>
              <select
                id="service_type"
                className={`${inputClass} appearance-none`}
                value={form.service_type}
                onChange={(e) => updateField("service_type", e.target.value)}
              >
                {SERVICE_TYPES.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className={labelClass}>
                Notes
              </label>
              <textarea
                id="notes"
                rows={4}
                className={inputClass}
                placeholder="Any initial notes about this lead..."
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center gap-4 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="border border-white bg-white px-8 py-3 text-sm font-semibold uppercase tracking-widest text-black transition-colors hover:bg-neutral-200 disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create Lead"}
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: "/crm" })}
                className="text-sm text-neutral-400 transition-colors hover:text-white"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
