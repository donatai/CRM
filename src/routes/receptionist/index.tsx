import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { checkAuth } from "~/lib/auth";
import { useEffect, useState, useCallback } from "react";
import {
  ensureTables,
  getCalls,
  getReceptionistStats,
  getThreadPreviews,
  getSettings,
  updateSettings,
  type Call,
  type ReceptionistStats,
  type ThreadPreview,
  type ReceptionistSetting,
} from "~/lib/receptionist-api";

export const Route = createFileRoute("/receptionist/")({
  beforeLoad: async () => {
    const { authenticated } = await checkAuth();
    if (!authenticated) {
      throw redirect({ to: "/login" });
    }
  },

  component: ReceptionistDashboard,
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  answered: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  missed: "bg-red-500/10 text-red-400 border-red-500/30",
  voicemail: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  completed: "bg-blue-500/10 text-blue-400 border-blue-500/30",
};

const DIRECTION_LABELS: Record<string, string> = {
  inbound: "In",
  outbound: "Out",
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ReceptionistDashboard() {
  const [tab, setTab] = useState<"calls" | "messages" | "settings">("calls");
  const [stats, setStats] = useState<ReceptionistStats | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [threads, setThreads] = useState<ThreadPreview[]>([]);
  const [settings, setSettings] = useState<ReceptionistSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await ensureTables();
      const [statsRes, callsRes, threadsRes, settingsRes] = await Promise.all([
        getReceptionistStats(),
        getCalls({ data: {} }),
        getThreadPreviews(),
        getSettings(),
      ]);
      setStats(statsRes);
      setCalls(callsRes);
      setThreads(threadsRes);
      setSettings(settingsRes);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load data";
      if (msg.includes("DATABASE_URL")) {
        setError("Database not connected. Connect a database to enable the Receptionist.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // -----------------------------------------------------------------------
  // Empty / error state
  // -----------------------------------------------------------------------
  if (error) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black">
        <div className="text-center">
          <div className="mb-4 text-5xl">📞</div>
          <h2 className="mb-2 text-xl font-bold text-white">AI Receptionist</h2>
          <p className="max-w-md text-neutral-400">{error}</p>
          <p className="mt-4 text-sm text-neutral-600">
            The schema and API are ready. Connect a Neon database to activate the receptionist.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black">
        <p className="text-neutral-500">Loading receptionist...</p>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Dashboard
  // -----------------------------------------------------------------------
  const tabClass = (t: string) =>
    `pb-3 text-sm font-semibold uppercase tracking-widest transition-colors ${
      tab === t
        ? "border-b-2 border-amber-500 text-amber-400"
        : "text-neutral-500 hover:text-neutral-300"
    }`;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-neutral-900 px-6 py-6">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              AI Receptionist
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              24/7 virtual receptionist — calls, SMS, and email
            </p>
          </div>
        </div>
      </header>

      {/* Stats bar */}
      {stats && (
        <div className="border-b border-neutral-900 px-6 py-5">
          <div className="mx-auto flex max-w-[1600px] flex-wrap gap-6">
            <StatCard
              label="Calls Today"
              value={stats.calls_today}
              icon="📞"
            />
            <StatCard
              label="Missed"
              value={stats.missed_calls}
              icon="⚠️"
              accent={stats.missed_calls > 0 ? "text-red-400" : undefined}
            />
            <StatCard
              label="Messages Sent"
              value={stats.messages_sent}
              icon="💬"
            />
            <StatCard
              label="Active Conversations"
              value={stats.active_conversations}
              icon="🔄"
            />
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="border-b border-neutral-900 px-6">
        <div className="mx-auto max-w-[1600px] flex gap-8">
          <button onClick={() => setTab("calls")} className={tabClass("calls")}>
            Calls
          </button>
          <button
            onClick={() => setTab("messages")}
            className={tabClass("messages")}
          >
            Messages
          </button>
          <button
            onClick={() => setTab("settings")}
            className={tabClass("settings")}
          >
            Settings
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="px-6 py-6">
        <div className="mx-auto max-w-[1600px]">
          {tab === "calls" && <CallsTab calls={calls} />}
          {tab === "messages" && <MessagesTab threads={threads} />}
          {tab === "settings" && (
            <SettingsTab settings={settings} onSaved={loadData} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className={`text-2xl font-bold ${accent ?? "text-white"}`}>
          {value}
        </p>
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          {label}
        </p>
      </div>
    </div>
  );
}

function CallsTab({ calls }: { calls: Call[] }) {
  if (calls.length === 0) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <p className="text-neutral-500">No calls yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-neutral-900">
            <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Caller
            </th>
            <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Number
            </th>
            <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Direction
            </th>
            <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Duration
            </th>
            <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Status
            </th>
            <th className="pb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Time
            </th>
          </tr>
        </thead>
        <tbody>
          {calls.map((call) => (
            <tr
              key={call.id}
              className="border-b border-neutral-900/50 transition-colors hover:bg-neutral-950"
            >
              <td className="py-3 pr-4">
                <Link
                  to="/receptionist/calls/$id"
                  params={{ id: String(call.id) }}
                  className="text-sm font-medium text-white hover:text-amber-400"
                >
                  {call.caller_name ?? "Unknown"}
                </Link>
              </td>
              <td className="py-3 pr-4">
                <span className="text-sm text-neutral-400">
                  {call.caller_number ?? "—"}
                </span>
              </td>
              <td className="py-3 pr-4">
                <span className="text-xs uppercase tracking-wide text-neutral-500">
                  {DIRECTION_LABELS[call.direction] ?? call.direction}
                </span>
              </td>
              <td className="py-3 pr-4">
                <span className="font-mono text-sm text-neutral-400">
                  {formatDuration(call.duration_seconds)}
                </span>
              </td>
              <td className="py-3 pr-4">
                <span
                  className={`inline-block rounded border px-2 py-0.5 text-xs font-medium capitalize ${
                    STATUS_COLORS[call.status] ??
                    "border-neutral-700 text-neutral-400"
                  }`}
                >
                  {call.status}
                </span>
              </td>
              <td className="py-3">
                <span className="text-sm text-neutral-500">
                  {formatRelative(new Date(call.created_at))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MessagesTab({ threads }: { threads: ThreadPreview[] }) {
  if (threads.length === 0) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <p className="text-neutral-500">No message threads yet.</p>
      </div>
    );
  }

  const channelIcon = (ch: string) => (ch === "email" ? "📧" : "📱");

  return (
    <div className="space-y-1">
      {threads.map((t) => (
        <Link
          key={t.thread_id}
          to="/receptionist/messages/$threadId"
          params={{ threadId: t.thread_id }}
          className="flex items-start gap-4 rounded border border-neutral-900 bg-neutral-950 p-4 transition-colors hover:border-neutral-700"
        >
          <span className="mt-0.5 text-xl">
            {channelIcon(t.channel)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white">
                {t.contact_name ??
                  t.contact_number ??
                  t.contact_email ??
                  "Unknown"}
              </p>
              <span className="text-xs text-neutral-600">
                {formatTime(t.latest_time)}
              </span>
            </div>
            <p className="mt-1 truncate text-sm text-neutral-400">
              {t.latest_message}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide text-neutral-600">
                {t.channel}
              </span>
              <span className="text-[10px] text-neutral-700">
                {t.message_count} message{t.message_count !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function SettingsTab({
  settings,
  onSaved,
}: {
  settings: ReceptionistSetting[];
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const defaults: Record<string, string> = {
    business_hours_start: "08:00",
    business_hours_end: "18:00",
    auto_reply_sms:
      "Thanks for contacting no602. We received your message and will get back to you shortly.",
    auto_reply_email:
      "Thank you for reaching out to no602 Security. We have received your email and a team member will respond within one business day.",
    forwarding_number: "",
  };

  function getValue(key: string): string {
    const s = settings.find((s) => s.key === key);
    if (s && typeof s.value === "object" && s.value !== null) {
      return String(
        (s.value as Record<string, unknown>).v ?? defaults[key] ?? "",
      );
    }
    return defaults[key] ?? "";
  }

  async function handleSave(key: string, value: string) {
    setSaving(key);
    setSaveError(null);
    try {
      await updateSettings({ data: { key, value: { v: value } } });
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      setSaveError(msg);
    } finally {
      setSaving(null);
    }
  }

  const inputClass =
    "w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";
  const labelClass =
    "mb-2 block text-xs font-semibold uppercase tracking-widest text-neutral-400";

  return (
    <div className="max-w-2xl space-y-8">
      {/* Business Hours */}
      <div>
        <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-neutral-300">
          Business Hours
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingsField
            label="Start Time"
            value={getValue("business_hours_start")}
            saving={saving === "business_hours_start"}
            onSave={(v) => handleSave("business_hours_start", v)}
            inputClass={inputClass}
            labelClass={labelClass}
            type="time"
          />
          <SettingsField
            label="End Time"
            value={getValue("business_hours_end")}
            saving={saving === "business_hours_end"}
            onSave={(v) => handleSave("business_hours_end", v)}
            inputClass={inputClass}
            labelClass={labelClass}
            type="time"
          />
        </div>
        <p className="mt-2 text-xs text-neutral-600">
          Calls outside business hours go to voicemail with AI handling.
        </p>
      </div>

      {/* Forwarding Number */}
      <div>
        <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-neutral-300">
          Forwarding
        </h3>
        <SettingsField
          label="Forwarding Number"
          value={getValue("forwarding_number")}
          saving={saving === "forwarding_number"}
          onSave={(v) => handleSave("forwarding_number", v)}
          inputClass={inputClass}
          labelClass={labelClass}
          placeholder="(555) 000-0000"
        />
        <p className="mt-2 text-xs text-neutral-600">
          Calls forwarded to this number when the AI cannot resolve the request.
        </p>
      </div>

      {/* Auto-reply Templates */}
      <div>
        <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-neutral-300">
          Auto-Reply Templates
        </h3>
        <SettingsField
          label="SMS Auto-Reply"
          value={getValue("auto_reply_sms")}
          saving={saving === "auto_reply_sms"}
          onSave={(v) => handleSave("auto_reply_sms", v)}
          inputClass={inputClass}
          labelClass={labelClass}
          textarea
        />
        <div className="mt-4">
          <SettingsField
            label="Email Auto-Reply"
            value={getValue("auto_reply_email")}
            saving={saving === "auto_reply_email"}
            onSave={(v) => handleSave("auto_reply_email", v)}
            inputClass={inputClass}
            labelClass={labelClass}
            textarea
          />
        </div>
      </div>

      {saveError && (
        <div className="border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {saveError}
        </div>
      )}
    </div>
  );
}

function SettingsField({
  label,
  value,
  saving,
  onSave,
  inputClass,
  labelClass,
  type,
  placeholder,
  textarea,
}: {
  label: string;
  value: string;
  saving: boolean;
  onSave: (v: string) => void;
  inputClass: string;
  labelClass: string;
  type?: string;
  placeholder?: string;
  textarea?: boolean;
}) {
  const [draft, setDraft] = useState(value);

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex gap-2">
        {textarea ? (
          <textarea
            className={`${inputClass} resize-none`}
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
          />
        ) : (
          <input
            type={type ?? "text"}
            className={inputClass}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
          />
        )}
        <button
          onClick={() => onSave(draft)}
          disabled={saving || draft === value}
          className="border border-amber-500 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-amber-400 transition-colors hover:bg-amber-500/10 disabled:opacity-40"
        >
          {saving ? "..." : "Save"}
        </button>
      </div>
    </div>
  );
}
