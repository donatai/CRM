import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ensureTables,
  getPosts,
  getCalendarPosts,
  getSocialStats,
  createPost,
  updatePost,
  deletePost,
  type ScheduledPost,
  type SocialStats,
} from "~/lib/social-api";

export const Route = createFileRoute("/social")({
  component: SocialDashboard,
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VERTICAL_LABELS: Record<string, string> = {
  post_arm_guards: "Post Arm Guards",
  events: "Events",
  private_clients: "Private Clients",
  executive_protection: "Executive Protection",
};

const VERTICAL_COLORS: Record<string, string> = {
  post_arm_guards: "bg-green-900/50 text-green-400",
  events: "bg-blue-900/50 text-blue-400",
  private_clients: "bg-purple-900/50 text-purple-400",
  executive_protection: "bg-amber-900/50 text-amber-400",
};

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  all: "All Platforms",
};

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: "bg-pink-900/50 text-pink-400 border-pink-700",
  instagram: "bg-purple-900/50 text-purple-400 border-purple-700",
  youtube: "bg-red-900/50 text-red-400 border-red-700",
  all: "bg-neutral-800 text-neutral-400 border-neutral-600",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-neutral-800 text-neutral-400 border-neutral-600",
  scheduled: "bg-amber-900/50 text-amber-400 border-amber-700",
  posted: "bg-emerald-900/50 text-emerald-400 border-emerald-700",
  failed: "bg-red-900/50 text-red-400 border-red-700",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function SocialDashboard() {
  const [tab, setTab] = useState<"calendar" | "all">("calendar");
  const [stats, setStats] = useState<SocialStats | null>(null);
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [calendarPosts, setCalendarPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calendar navigation
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  // New/edit post form
  const [showForm, setShowForm] = useState(false);
  const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    vertical: "post_arm_guards",
    platform: "tiktok",
    script: "",
    hook: "",
    thumbnail_concept: "",
    scheduled_at: "",
    status: "draft",
  });
  const [saving, setSaving] = useState(false);

  // Expanded post for calendar
  const [expandedPostId, setExpandedPostId] = useState<number | null>(null);

  const calendarMonthStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (tab === "calendar") {
      loadCalendarPosts();
    } else {
      loadAllPosts();
    }
  }, [tab, calendarMonthStr]);
  // Handle the YouTube OAuth redirect (/?code=... or ?error=...) and then
  // refresh connection status whenever the page loads.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const oauthError = params.get("error");
    async function handleOAuthReturn() {
      if (code) {
        const res = await handleYouTubeCallbackAction({ data: code });
        if (!res.success) {
          setActionError(`YouTube connection failed: ${res.error ?? "unknown error"}`);
        }
      } else if (oauthError) {
        setActionError(`YouTube authorization was not completed (${oauthError}).`);
      }
      if (code || oauthError) {
        // Strip the OAuth params so a refresh never re-exchanges a one-time code.
        window.history.replaceState({}, "", "/social");
      }
      const status = await getSocialConnectionStatusAction();
      setConnections(status);
    }
    handleOAuthReturn();
  }, []);
  async function connectYouTube() {
    setConnecting(true);
    setActionError(null);
    try {
      const res = await getYouTubeAuthUrlAction();
      if ("url" in res) {
        window.location.href = res.url;
      } else {
        setActionError(res.error ?? "Could not start YouTube connection.");
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Could not start YouTube connection.");
    } finally {
      setConnecting(false);
    }
  }
  async function handlePublish(id: number) {
    setPublishingId(id);
    setActionError(null);
    try {
      const res = await publishPost({ data: id });
      if (!res.success) {
        setActionError(res.error ?? "Publishing failed.");
      }
      await loadData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Publishing failed.");
    } finally {
      setPublishingId(null);
    }
  }

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      await ensureTables();
      const [statsResult, postsResult] = await Promise.all([
        getSocialStats(),
        getPosts(),
      ]);
      setStats(statsResult);
      setPosts(postsResult);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load data";
      if (msg.includes("DATABASE_URL")) {
        setError("Database not connected. Connect a database to enable social media tools.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadCalendarPosts() {
    try {
      const result = await getCalendarPosts({ data: calendarMonthStr });
      setCalendarPosts(result);
    } catch (err: unknown) {
      console.error("Failed to load calendar posts:", err);
    }
  }

  async function loadAllPosts() {
    try {
      const result = await getPosts();
      setPosts(result);
    } catch (err: unknown) {
      console.error("Failed to load posts:", err);
    }
  }

  function openNewForm() {
    setEditingPost(null);
    setFormData({
      title: "",
      vertical: "post_arm_guards",
      platform: "tiktok",
      script: "",
      hook: "",
      thumbnail_concept: "",
      scheduled_at: "",
      status: "draft",
    });
    setShowForm(true);
  }

  function openEditForm(post: ScheduledPost) {
    setEditingPost(post);
    setFormData({
      title: post.title,
      vertical: post.vertical,
      platform: post.platform,
      script: post.script,
      hook: post.hook || "",
      thumbnail_concept: post.thumbnail_concept || "",
      scheduled_at: post.scheduled_at
        ? new Date(post.scheduled_at).toISOString().slice(0, 16)
        : "",
      status: post.status,
    });
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingPost) {
        await updatePost({
          data: {
            id: editingPost.id,
            ...formData,
            hook: formData.hook || undefined,
            thumbnail_concept: formData.thumbnail_concept || undefined,
            scheduled_at: formData.scheduled_at || undefined,
          },
        });
      } else {
        await createPost({
          data: {
            ...formData,
            hook: formData.hook || undefined,
            thumbnail_concept: formData.thumbnail_concept || undefined,
            scheduled_at: formData.scheduled_at || undefined,
          },
        });
      }
      setShowForm(false);
      setEditingPost(null);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save post";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this post?")) return;
    try {
      await deletePost({ data: id });
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete post";
      setError(msg);
    }
  }

  async function handleStatusChange(id: number, newStatus: string) {
    try {
      if (newStatus === "posted") {
        await updatePost({ data: { id, status: newStatus, posted_at: new Date().toISOString() } });
      } else {
        await updatePost({ data: { id, status: newStatus } });
      }
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update status";
      setError(msg);
    }
  }

  function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay();
  }

  function getPostsForDay(day: number) {
    return calendarPosts.filter((p) => {
      if (!p.scheduled_at) return false;
      const d = new Date(p.scheduled_at);
      return d.getFullYear() === calYear && d.getMonth() === calMonth && d.getDate() === day;
    });
  }

  function navigateMonth(delta: number) {
    let newMonth = calMonth + delta;
    let newYear = calYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }
    setCalMonth(newMonth);
    setCalYear(newYear);
  }

  if (error && !stats) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black">
        <div className="text-center">
          <div className="mb-4 text-5xl">📱</div>
          <h2 className="mb-2 text-xl font-bold text-white">Social Media</h2>
          <p className="max-w-md text-neutral-400">{error}</p>
          <p className="mt-4 text-sm text-neutral-600">
            The schema and API are ready. Connect a Neon database to activate the social scheduler.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black">
        <p className="text-neutral-500">Loading social dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-neutral-900 px-6 py-6">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Social Media</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Content calendar &amp; post scheduler
            </p>
          </div>
          <button
            onClick={openNewForm}
            className="border border-white bg-white px-5 py-2.5 text-sm font-semibold uppercase tracking-widest text-black transition-colors hover:bg-neutral-200"
          >
            + New Post
          </button>
        </div>
      </header>
      {actionError && (
        <div className="border-b border-red-900/50 bg-red-950/30 px-6 py-3">
          <div className="mx-auto flex max-w-[1600px] items-start gap-2">
            <span className="mt-0.5 text-red-400">⚠</span>
            <p className="text-sm text-red-300">{actionError}</p>
            <button
              onClick={() => setActionError(null)}
              className="ml-auto text-xs text-red-400/70 transition-colors hover:text-red-300"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <div className="border-b border-neutral-900 bg-neutral-950/50 px-6 py-4">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-8 gap-y-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Connections
          </span>
          <span className="flex items-center gap-2 text-sm text-neutral-300">
            <span
              className={`inline-block h-2 w-2 rounded-full ${connections?.x ? "bg-emerald-400" : "bg-neutral-700"}`}
            />
            X (Twitter)
            <span className="text-xs text-neutral-600">
              {connections?.x ? "Ready" : "Not configured"}
            </span>
          </span>
          <span className="flex items-center gap-2 text-sm text-neutral-300">
            <span
              className={`inline-block h-2 w-2 rounded-full ${connections?.instagram ? "bg-emerald-400" : "bg-neutral-700"}`}
            />
            Instagram
            <span className="text-xs text-neutral-600">
              {connections?.instagram ? "Ready" : "Not configured"}
            </span>
          </span>
          <span className="flex items-center gap-2 text-sm text-neutral-300">
            <span
              className={`inline-block h-2 w-2 rounded-full ${connections?.youtube ? "bg-emerald-400" : "bg-neutral-700"}`}
            />
            YouTube
            <span className="text-xs text-neutral-600">
              {connections?.youtube ? "Connected" : "Not connected"}
            </span>
            {connections?.youtube ? (
              <span className="rounded border border-emerald-800 bg-emerald-900/30 px-2 py-0.5 text-xs text-emerald-400">
                Connected
              </span>
            ) : (
              <button
                onClick={connectYouTube}
                disabled={connecting}
                className={`rounded border px-2 py-0.5 text-xs transition-colors ${
                  connecting
                    ? "border-neutral-700 text-neutral-600 cursor-not-allowed"
                    : "border-red-700 bg-red-900/30 text-red-400 hover:bg-red-900/50"
                }`}
              >
                {connecting ? "Starting..." : "Connect YouTube"}
              </button>
            )}
          </span>
        </div>
      </div>

      {stats && (
        <div className="border-b border-neutral-900 px-6 py-4">
          <div className="mx-auto flex max-w-[1600px] flex-wrap gap-6">
            <StatBox label="Upcoming This Week" value={stats.upcoming_this_week} />
            <StatBox label="Total Scheduled" value={stats.total_scheduled} />
            <StatBox label="Posted This Month" value={stats.posted_this_month} />
            <StatBox label="Drafts" value={stats.drafts} />
          </div>
        </div>
      )}

      <div className="border-b border-neutral-900 px-6">
        <div className="mx-auto flex max-w-[1600px] gap-0">
          <button
            onClick={() => setTab("calendar")}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              tab === "calendar"
                ? "border-b-2 border-amber-500 text-white"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            Calendar
          </button>
          <button
            onClick={() => setTab("all")}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              tab === "all"
                ? "border-b-2 border-amber-500 text-white"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            All Posts
          </button>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="mx-auto max-w-[1600px]">
          {tab === "calendar" ? (
            <CalendarTab
              calYear={calYear}
              calMonth={calMonth}
              navigateMonth={navigateMonth}
              getDaysInMonth={getDaysInMonth}
              getFirstDayOfMonth={getFirstDayOfMonth}
              getPostsForDay={getPostsForDay}
              expandedPostId={expandedPostId}
              setExpandedPostId={setExpandedPostId}
            />
          ) : (
            <AllPostsTab
              posts={posts}
              onEdit={openEditForm}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              onPublish={handlePublish}
              publishingId={publishingId}
            />
          )}
        </div>
      </div>

      {showForm && (
        <PostFormModal
          editingPost={editingPost}
          formData={formData}
          setFormData={setFormData}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false);
            setEditingPost(null);
          }}
          saving={saving}
        />
      )}
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

function CalendarTab({
  calYear,
  calMonth,
  navigateMonth,
  getDaysInMonth,
  getFirstDayOfMonth,
  getPostsForDay,
  expandedPostId,
  setExpandedPostId,
}: {
  calYear: number;
  calMonth: number;
  navigateMonth: (delta: number) => void;
  getDaysInMonth: (year: number, month: number) => number;
  getFirstDayOfMonth: (year: number, month: number) => number;
  getPostsForDay: (day: number) => ScheduledPost[];
  expandedPostId: number | null;
  setExpandedPostId: (id: number | null) => void;
}) {
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);
  const totalCells = firstDay + daysInMonth;
  const rows = Math.ceil(totalCells / 7);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => navigateMonth(-1)}
          className="rounded border border-neutral-800 px-3 py-1.5 text-sm text-neutral-400 transition-colors hover:border-neutral-600 hover:text-white"
        >
          ← Prev
        </button>
        <h2 className="text-lg font-bold text-white">
          {MONTH_NAMES[calMonth]} {calYear}
        </h2>
        <button
          onClick={() => navigateMonth(1)}
          className="rounded border border-neutral-800 px-3 py-1.5 text-sm text-neutral-400 transition-colors hover:border-neutral-600 hover:text-white"
        >
          Next →
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-900">
        <div className="grid grid-cols-7 border-b border-neutral-900 bg-neutral-950">
          {DAYS_OF_WEEK.map((d) => (
            <div
              key={d}
              className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-neutral-500"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: rows * 7 }, (_, i) => {
            const day = i - firstDay + 1;
            const isValidDay = day >= 1 && day <= daysInMonth;
            const postsForDay = isValidDay ? getPostsForDay(day) : [];
            const isToday =
              isValidDay &&
              new Date().getFullYear() === calYear &&
              new Date().getMonth() === calMonth &&
              new Date().getDate() === day;

            return (
              <div
                key={i}
                className={`min-h-[100px] border-b border-r border-neutral-900 p-1.5 ${
                  isValidDay ? "bg-black" : "bg-neutral-950/30"
                } ${isToday ? "ring-1 ring-amber-500/50 ring-inset" : ""}`}
              >
                {isValidDay && (
                  <>
                    <div className={`mb-1 text-xs font-medium ${isToday ? "text-amber-400" : "text-neutral-400"}`}>
                      {day}
                    </div>
                    <div className="space-y-1">
                      {postsForDay.slice(0, 3).map((p) => (
                        <button
                          key={p.id}
                          onClick={() =>
                            setExpandedPostId(expandedPostId === p.id ? null : p.id)
                          }
                          className="block w-full truncate rounded px-1.5 py-0.5 text-left text-xs transition-colors hover:bg-neutral-800"
                          title={p.title}
                        >
                          <span className={`inline-block mr-1 rounded-sm px-1 py-px text-[10px] font-semibold uppercase ${PLATFORM_COLORS[p.platform] ?? "bg-neutral-800 text-neutral-400"}`}>
                            {PLATFORM_LABELS[p.platform]?.slice(0, 4) ?? p.platform}
                          </span>
                          <span className="text-neutral-300">{p.title}</span>
                        </button>
                      ))}
                      {postsForDay.length > 3 && (
                        <p className="px-1.5 text-[10px] text-neutral-600">
                          +{postsForDay.length - 3} more
                        </p>
                      )}
                    </div>
                    {expandedPostId && postsForDay.some((p) => p.id === expandedPostId) && (
                      <div className="mt-2 rounded border border-neutral-800 bg-neutral-950 p-2">
                        {postsForDay
                          .filter((p) => p.id === expandedPostId)
                          .map((p) => (
                            <div key={p.id}>
                              <p className="mb-1 text-xs font-bold text-white">{p.title}</p>
                              <div className="mb-1 flex flex-wrap gap-1">
                                <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${VERTICAL_COLORS[p.vertical] ?? "bg-neutral-800 text-neutral-400"}`}>
                                  {VERTICAL_LABELS[p.vertical] ?? p.vertical}
                                </span>
                                <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[p.status] ?? ""}`}>
                                  {p.status}
                                </span>
                              </div>
                              {p.hook && (
                                <p className="mb-1 text-[11px] text-amber-400/80">
                                  <span className="text-neutral-600">Hook: </span>
                                  {p.hook}
                                </p>
                              )}
                              <p className="text-[11px] leading-relaxed text-neutral-400 whitespace-pre-wrap line-clamp-4">
                                {p.script}
                              </p>
                            </div>
                          ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AllPostsTab({
  posts,
  onEdit,
  onDelete,
  onStatusChange,
  onPublish,
  publishingId,
}: {
  posts: ScheduledPost[];
  onEdit: (post: ScheduledPost) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, status: string) => void;
  onPublish: (id: number) => void;
  publishingId: number | null;
}) {
  if (posts.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-500">No posts yet.</p>
          <p className="mt-2 text-sm text-neutral-600">
            Click "+ New Post" to schedule your first piece of content.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-800 text-xs uppercase tracking-wider text-neutral-500">
            <th className="pb-3 pr-4 font-medium">Title</th>
            <th className="pb-3 pr-4 font-medium">Vertical</th>
            <th className="pb-3 pr-4 font-medium">Platform</th>
            <th className="pb-3 pr-4 font-medium">Status</th>
            <th className="pb-3 pr-4 font-medium">Scheduled For</th>
            <th className="pb-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((p) => (
            <tr
              key={p.id}
              className="border-b border-neutral-900 transition-colors hover:bg-neutral-950"
            >
              <td className="py-4 pr-4">
                <p className="font-medium text-white">{p.title}</p>
                {p.hook && (
                  <p className="mt-0.5 max-w-xs truncate text-xs text-neutral-500">
                    {p.hook}
                  </p>
                )}
                {p.status === "failed" && p.last_error && (
                  <p
                    className="mt-1 max-w-md truncate text-xs text-red-400/80"
                    title={p.last_error}
                  >
                    {p.last_error}
                  </p>
                )}
              </td>
              <td className="py-4 pr-4">
                <span
                  className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${VERTICAL_COLORS[p.vertical] ?? "bg-neutral-800 text-neutral-400"}`}
                >
                  {VERTICAL_LABELS[p.vertical] ?? p.vertical}
                </span>
              </td>
              <td className="py-4 pr-4">
                <span
                  className={`inline-block rounded border px-2 py-0.5 text-xs font-medium uppercase ${PLATFORM_COLORS[p.platform] ?? "bg-neutral-800 text-neutral-400 border-neutral-600"}`}
                >
                  {PLATFORM_LABELS[p.platform] ?? p.platform}
                </span>
              </td>
              <td className="py-4 pr-4">
                <select
                  value={p.status}
                  onChange={(e) => onStatusChange(p.id, e.target.value)}
                  className={`rounded border px-2 py-0.5 text-xs font-medium uppercase bg-transparent cursor-pointer ${STATUS_COLORS[p.status] ?? ""}`}
                >
                  <option value="draft" className="bg-neutral-900">Draft</option>
                  <option value="scheduled" className="bg-neutral-900">Scheduled</option>
                  <option value="posted" className="bg-neutral-900">Posted</option>
                  <option value="failed" className="bg-neutral-900">Failed</option>
                </select>
              </td>
              <td className="py-4 pr-4 font-mono text-xs text-neutral-400">
                {p.scheduled_at
                  ? new Date(p.scheduled_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "—"}
              </td>
              <td className="py-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onPublish(p.id)}
                    disabled={publishingId === p.id || p.status === "posted"}
                    className={`text-xs font-semibold uppercase tracking-wider transition-colors ${
                      p.status === "posted"
                        ? "text-emerald-600 cursor-default"
                        : publishingId === p.id
                          ? "text-neutral-600 cursor-wait"
                          : "text-amber-400 hover:text-amber-300"
                    }`}
                  >
                    {publishingId === p.id
                      ? "Publishing..."
                      : p.status === "posted"
                        ? "Posted"
                        : "Publish"}
                  </button>
                  <button
                    onClick={() => onEdit(p)}
                    className="text-xs text-neutral-400 transition-colors hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(p.id)}
                    className="text-xs text-neutral-500 transition-colors hover:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PostFormModal({
  editingPost,
  formData,
  setFormData,
  onSave,
  onClose,
  saving,
}: {
  editingPost: ScheduledPost | null;
  formData: {
    title: string;
    vertical: string;
    platform: string;
    script: string;
    hook: string;
    thumbnail_concept: string;
    scheduled_at: string;
    status: string;
  };
  setFormData: (data: typeof formData) => void;
  onSave: (e: React.FormEvent) => void;
  onClose: () => void;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 pt-10 pb-10">
      <div className="mx-4 w-full max-w-lg rounded-lg border border-neutral-800 bg-neutral-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
          <h2 className="text-lg font-bold text-white">
            {editingPost ? "Edit Post" : "New Post"}
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-500 transition-colors hover:text-white"
          >
            ✕
          </button>
        </div>

        <form onSubmit={onSave} className="space-y-4 px-6 py-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Title
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-amber-500 focus:outline-none"
              placeholder="e.g., Why Armed Guards Matter for Retail"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Vertical
            </label>
            <select
              value={formData.vertical}
              onChange={(e) => setFormData({ ...formData, vertical: e.target.value })}
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
            >
              <option value="post_arm_guards">Post Arm Guards</option>
              <option value="events">Events</option>
              <option value="private_clients">Private Clients</option>
              <option value="executive_protection">Executive Protection</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Platform
            </label>
            <select
              value={formData.platform}
              onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
            >
              <option value="x">X (Twitter)</option>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
              <option value="youtube">YouTube</option>
              <option value="all">All Platforms</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Hook (optional)
            </label>
            <input
              type="text"
              value={formData.hook}
              onChange={(e) => setFormData({ ...formData, hook: e.target.value })}
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-amber-500 focus:outline-none"
              placeholder="e.g., What security companies don't want you to know..."
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Thumbnail Concept (optional)
            </label>
            <input
              type="text"
              value={formData.thumbnail_concept}
              onChange={(e) => setFormData({ ...formData, thumbnail_concept: e.target.value })}
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-amber-500 focus:outline-none"
              placeholder="e.g., Agent in suit against city skyline"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Script
            </label>
            <textarea
              required
              rows={5}
              value={formData.script}
              onChange={(e) => setFormData({ ...formData, script: e.target.value })}
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-amber-500 focus:outline-none"
              placeholder="Write the full video script here..."
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Scheduled Date &amp; Time
            </label>
            <input
              type="datetime-local"
              value={formData.scheduled_at}
              onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none [color-scheme:dark]"
            />
          </div>

          {editingPost && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="posted">Posted</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-neutral-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-neutral-700 px-4 py-2 text-sm text-neutral-400 transition-colors hover:border-neutral-500 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`rounded px-4 py-2 text-sm font-semibold transition-colors ${
                saving
                  ? "border border-neutral-700 text-neutral-600 cursor-not-allowed"
                  : "border border-amber-500 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
              }`}
            >
              {saving ? "Saving..." : editingPost ? "Update Post" : "Create Post"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
