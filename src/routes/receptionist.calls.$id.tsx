import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { checkAuth } from "~/lib/auth";
import { useEffect, useState } from "react";
import { getCall, type Call } from "~/lib/receptionist-api";

export const Route = createFileRoute("/receptionist/calls/$id")({
  beforeLoad: async () => {
    const { authenticated } = await checkAuth();
    if (!authenticated) {
      throw redirect({ to: "/login" });
    }
  },

  component: CallDetail,
});

const STATUS_COLORS: Record<string, string> = {
  answered: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  missed: "bg-red-500/10 text-red-400 border-red-500/30",
  voicemail: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  completed: "bg-blue-500/10 text-blue-400 border-blue-500/30",
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function CallDetail() {
  const { id } = Route.useParams();
  const [call, setCall] = useState<Call | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCall();
  }, [id]);

  async function loadCall() {
    setLoading(true);
    setError(null);
    try {
      const result = await getCall({ data: Number(id) });
      setCall(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load call";
      if (msg.includes("DATABASE_URL")) {
        setError("Database not connected.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black">
        <p className="text-neutral-500">Loading call...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black">
        <div className="text-center">
          <p className="text-neutral-400">{error}</p>
          <Link
            to="/receptionist"
            className="mt-4 inline-block text-sm text-amber-500 hover:text-amber-400"
          >
            ← Back to Receptionist
          </Link>
        </div>
      </div>
    );
  }

  if (!call) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black">
        <div className="text-center">
          <p className="text-neutral-400">Call not found.</p>
          <Link
            to="/receptionist"
            className="mt-4 inline-block text-sm text-amber-500 hover:text-amber-400"
          >
            ← Back to Receptionist
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-neutral-900 px-6 py-5">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/receptionist"
              className="text-sm text-neutral-400 transition-colors hover:text-white"
            >
              ← Receptionist
            </Link>
            <span className="text-neutral-700">/</span>
            <h1 className="text-lg font-bold tracking-tight">Call #{id}</h1>
          </div>
          <span
            className={`inline-block rounded border px-3 py-1 text-xs font-medium capitalize ${
              STATUS_COLORS[call.status] ??
              "border-neutral-700 text-neutral-400"
            }`}
          >
            {call.status}
          </span>
        </div>
      </header>

      <div className="px-6 py-8">
        <div className="mx-auto max-w-4xl">
          {/* Caller info card */}
          <div className="mb-8 rounded border border-neutral-900 bg-neutral-950 p-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-neutral-500">
                  Caller
                </p>
                <p className="text-lg font-medium text-white">
                  {call.caller_name ?? "Unknown"}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-neutral-500">
                  Number
                </p>
                <p className="text-lg font-medium text-white">
                  {call.caller_number ?? "—"}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-neutral-500">
                  Duration
                </p>
                <p className="text-lg font-medium text-white">
                  {call.duration_seconds > 0
                    ? formatDuration(call.duration_seconds)
                    : "—"}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-neutral-500">
                  Direction
                </p>
                <p className="text-lg font-medium capitalize text-white">
                  {call.direction}
                </p>
              </div>
            </div>
            <div className="mt-4 border-t border-neutral-900 pt-4">
              <p className="text-xs text-neutral-600">
                {formatDate(call.created_at)}
              </p>
            </div>
          </div>

          {/* Lead link */}
          {call.lead_id && (
            <div className="mb-8">
              <Link
                to="/crm/leads/$id"
                params={{ id: String(call.lead_id) }}
                className="inline-flex items-center gap-2 text-sm text-amber-400 transition-colors hover:text-amber-300"
              >
                <span>🔗</span> View associated lead
              </Link>
            </div>
          )}

          {/* AI Summary */}
          {call.summary && (
            <div className="mb-8">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
                AI Summary
              </h2>
              <div className="rounded border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-sm leading-relaxed text-neutral-300">
                  {call.summary}
                </p>
              </div>
            </div>
          )}

          {/* Transcript */}
          {call.transcript ? (
            <div className="mb-8">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Transcript
              </h2>
              <div className="rounded border border-neutral-800 bg-neutral-950 p-5">
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-neutral-400">
                  {call.transcript}
                </pre>
              </div>
            </div>
          ) : (
            <div className="mb-8">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Transcript
              </h2>
              <div className="rounded border border-neutral-900 bg-neutral-950 p-8 text-center">
                <p className="text-sm text-neutral-600">
                  {call.status === "missed"
                    ? "No transcript — call was missed."
                    : "No transcript available."}
                </p>
              </div>
            </div>
          )}

          {/* Notes */}
          {call.notes && (
            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Notes
              </h2>
              <div className="rounded border border-neutral-900 bg-neutral-950 p-4">
                <p className="text-sm leading-relaxed text-neutral-400">
                  {call.notes}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
