import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { checkAuth } from "~/lib/auth";
import { useEffect, useState } from "react";
import { getMessageThread, sendMessage, type Message } from "~/lib/receptionist-api";

export const Route = createFileRoute("/receptionist/messages/$threadId")({
  beforeLoad: async () => {
    const { authenticated } = await checkAuth();
    if (!authenticated) {
      throw redirect({ to: "/login" });
    }
  },

  component: MessageThread,
});

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function MessageThread() {
  const { threadId } = Route.useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    loadThread();
  }, [threadId]);

  async function loadThread() {
    setLoading(true);
    setError(null);
    try {
      const result = await getMessageThread({ data: threadId });
      setMessages(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load thread";
      if (msg.includes("DATABASE_URL")) {
        setError("Database not connected.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim()) return;

    setSending(true);
    setSendError(null);
    try {
      const firstMsg = messages[0];
      await sendMessage({
        data: {
          channel: firstMsg?.channel ?? "sms",
          body: replyText.trim(),
          thread_id: threadId,
          contact_number: firstMsg?.contact_number ?? undefined,
          contact_email: firstMsg?.contact_email ?? undefined,
          lead_id: firstMsg?.lead_id ?? undefined,
        },
      });
      setReplyText("");
      await loadThread();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send";
      setSendError(msg);
    } finally {
      setSending(false);
    }
  }

  // --- Loading / error ---
  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black">
        <p className="text-neutral-500">Loading conversation...</p>
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

  if (messages.length === 0) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black">
        <div className="text-center">
          <p className="text-neutral-400">Thread not found.</p>
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

  // Derive contact info from first message
  const firstMsg = messages[0];
  const contactName =
    firstMsg.contact_number ?? firstMsg.contact_email ?? "Unknown";
  const channel = firstMsg.channel;

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      {/* Header */}
      <header className="border-b border-neutral-900 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/receptionist"
              className="text-sm text-neutral-400 transition-colors hover:text-white"
            >
              ← Receptionist
            </Link>
            <span className="text-neutral-700">/</span>
            <div>
              <h1 className="text-sm font-bold tracking-tight">{contactName}</h1>
              <p className="text-xs text-neutral-500">
                {channel === "email" ? "Email" : "SMS"} · {messages.length}{" "}
                message{messages.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <span className="text-xs uppercase tracking-wide text-neutral-500">
            {channel === "email" ? "📧" : "📱"} {channel}
          </span>
        </div>
      </header>

      {/* Messages area */}
      <div className="flex-1 px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((msg, i) => {
            const isOutbound = msg.direction === "outbound";
            const showDate =
              i === 0 ||
              new Date(msg.created_at).toDateString() !==
                new Date(messages[i - 1].created_at).toDateString();

            return (
              <div key={msg.id}>
                {showDate && (
                  <div className="mb-4 mt-6 text-center">
                    <span className="inline-block rounded-full border border-neutral-800 px-3 py-1 text-xs text-neutral-600">
                      {formatDate(msg.created_at)}
                    </span>
                  </div>
                )}
                <div
                  className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-3 ${
                      isOutbound
                        ? "bg-amber-500/10 border border-amber-500/20"
                        : "bg-neutral-900 border border-neutral-800"
                    }`}
                  >
                    {msg.subject && (
                      <p className="mb-1 text-xs font-semibold text-neutral-400">
                        {msg.subject}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">
                      {msg.body}
                    </p>
                    <p
                      className={`mt-1 text-[10px] ${
                        isOutbound ? "text-amber-500/60" : "text-neutral-600"
                      }`}
                    >
                      {formatTime(msg.created_at)}
                      {msg.status !== "sent" && (
                        <span className="ml-2 capitalize">· {msg.status}</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Compose reply */}
      <div className="border-t border-neutral-900 px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <form onSubmit={handleSend} className="flex gap-3">
            <input
              type="text"
              className="flex-1 border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
              placeholder={
                channel === "email" ? "Type your reply..." : "Type an SMS reply..."
              }
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
            />
            <button
              type="submit"
              disabled={sending || !replyText.trim()}
              className="border border-amber-500 bg-amber-500/10 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-amber-400 transition-colors hover:bg-amber-500/20 disabled:opacity-40"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </form>
          {sendError && (
            <p className="mt-2 text-xs text-red-400">{sendError}</p>
          )}
        </div>
      </div>

      {/* Sidebar info */}
      {firstMsg.lead_id && (
        <div className="border-t border-neutral-900 px-6 py-3">
          <div className="mx-auto max-w-3xl">
            <Link
              to="/crm/leads/$id"
              params={{ id: String(firstMsg.lead_id) }}
              className="inline-flex items-center gap-2 text-xs text-amber-400 transition-colors hover:text-amber-300"
            >
              <span>🔗</span> View associated lead
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
