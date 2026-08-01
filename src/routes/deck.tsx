import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/deck")({
  component: Deck,
});

function Deck() {
  return (
    <div className="bg-black text-white">
      {/* ── Hero ── */}
      <section className="px-6 pb-16 pt-24 sm:pb-24 sm:pt-32">
        <div className="mx-auto max-w-4xl text-center">
          <span className="mb-8 inline-block border border-neutral-800 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-300">
            Platform Overview
          </span>
          <h1 className="mb-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Stop losing revenue to
            <br />
            missed calls & lost leads.
          </h1>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-neutral-400 sm:text-lg">
            Security companies lose thousands every month to after-hours calls
            that go unanswered and leads that fall through the cracks. no602
            fixes that.
          </p>
        </div>
      </section>

      {/* ── Pain Points ── */}
      <section className="border-t border-neutral-900 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">
              The Problem
            </p>
            <h2 className="max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
              These aren't annoyances — they're revenue leaks.
            </h2>
          </div>
          <div className="grid gap-px bg-neutral-900 sm:grid-cols-2 lg:grid-cols-4">
            {painPoints.map((p, i) => (
              <PainCard key={p.title} index={i + 1} {...p} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Solutions ── */}
      <section className="border-t border-neutral-900 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">
              The Solution
            </p>
            <h2 className="max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
              One platform. Four pillars. Zero gaps.
            </h2>
          </div>
          <div className="space-y-16">
            {solutions.map((s, i) => (
              <SolutionRow key={s.title} {...s} reverse={i % 2 === 1} index={i + 1} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Service Breakdown ── */}
      <section className="border-t border-neutral-900 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">
              Full Breakdown
            </p>
            <h2 className="max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
              Everything included. Nothing held back.
            </h2>
          </div>
          <div className="overflow-hidden border border-neutral-900">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-900 bg-neutral-950">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-widest text-neutral-400">
                    Service
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-widest text-neutral-400">
                    What It Does
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-widest text-neutral-400">
                    Vertical
                  </th>
                </tr>
              </thead>
              <tbody>
                {serviceRows.map((r) => (
                  <tr
                    key={r.service}
                    className="border-b border-neutral-900 last:border-0 transition-colors hover:bg-neutral-950"
                  >
                    <td className="px-6 py-4 font-medium text-white">
                      {r.service}
                    </td>
                    <td className="px-6 py-4 text-neutral-400">{r.what}</td>
                    <td className="px-6 py-4">
                      <span className="border border-neutral-800 px-2.5 py-0.5 text-xs text-neutral-400">
                        {r.vertical}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── ROI ── */}
      <section className="border-t border-neutral-900 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-16 text-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">
              By the Numbers
            </p>
            <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
              The numbers don't lie.
            </h2>
          </div>
          <div className="grid gap-px bg-neutral-900 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((s) => (
              <div
                key={s.label}
                className="bg-black p-8 text-center"
              >
                <p className="mb-2 text-4xl font-bold text-white">
                  {s.value}
                </p>
                <p className="text-xs uppercase tracking-widest text-neutral-500">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-neutral-900 px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">
            Next Steps
          </p>
          <h2 className="mb-4 text-3xl font-bold leading-tight sm:text-4xl">
            Give your security firm the platform it deserves.
          </h2>
          <p className="mb-10 text-base leading-relaxed text-neutral-400">
            White-labeled. Fully managed. Ready to deploy. Let's talk.
          </p>
          <form
            className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              alert("Thanks. We'll reach out to schedule a demo.");
            }}
          >
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 border border-neutral-800 bg-neutral-950 px-4 py-3.5 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
              required
            />
            <button
              type="submit"
              className="border border-white bg-white px-6 py-3.5 text-sm font-semibold uppercase tracking-widest text-black transition-colors hover:bg-neutral-200"
            >
              Request Demo
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

/* ── Data ── */

const painPoints = [
  {
    title: "Missed Calls",
    desc: "After-hours and weekend calls go to voicemail. By the time someone responds, the prospect has already called a competitor.",
  },
  {
    title: "Lost Leads",
    desc: "No centralized system to capture, track, and follow up. Names and numbers get scribbled on sticky notes and forgotten.",
  },
  {
    title: "Zero Pipeline Visibility",
    desc: "Owners have no idea how many leads are in play, what stage they're at, or who's following up. Decisions are made blind.",
  },
  {
    title: "Admin Overload",
    desc: "Owners and managers spend hours on scheduling, follow-ups, and paperwork instead of growing the business.",
  },
];

const solutions = [
  {
    title: "24/7 AI Receptionist",
    subtitle: "Never miss another call",
    desc: "Our AI answers every call instantly — 3am on a Saturday, Christmas morning, doesn't matter. It screens, provides information, collects details, and sends SMS and email follow-ups. Your prospects get an immediate response. You get a warm lead delivered to your inbox.",
    stats: "100% call answer rate, 24/7/365",
  },
  {
    title: "Marketing Engine",
    subtitle: "Pipeline always full",
    desc: "Built-in cold email outreach and lead scraping keep your pipeline fed. Target property managers, event planners, HNW families, and corporate security directors. Automated sequences with tracking and analytics so you know what's working.",
    stats: "Automated outreach + lead intelligence",
  },
  {
    title: "Custom CRM",
    subtitle: "Every lead accounted for",
    desc: "Full pipeline management built for security services. Track leads from first contact to signed contract. Qualify, assign, follow up, and close — all in one place. No more spreadsheets, no more forgotten follow-ups.",
    stats: "End-to-end pipeline visibility",
  },
  {
    title: "Analytics Dashboard",
    subtitle: "Data-driven decisions",
    desc: "Real-time metrics on lead volume, conversion rates, revenue, and team performance. Know exactly which channels are producing and which aren't. Spot bottlenecks before they cost you money.",
    stats: "Real-time production & growth metrics",
  },
];

const serviceRows = [
  {
    service: "AI Receptionist",
    what: "24/7 call answering, SMS & email follow-up, lead capture",
    vertical: "All Verticals",
  },
  {
    service: "Cold Email Outreach",
    what: "Automated campaigns, lead scraping, sequence management",
    vertical: "All Verticals",
  },
  {
    service: "CRM & Pipeline",
    what: "Lead tracking, qualification, contact management, deal flow",
    vertical: "All Verticals",
  },
  {
    service: "Analytics",
    what: "Production metrics, growth dashboards, conversion tracking",
    vertical: "All Verticals",
  },
  {
    service: "Sales Deck Page",
    what: "Pain-point-driven presentation for closing deals",
    vertical: "All Verticals",
  },
  {
    service: "Post Arm Module",
    what: "Guard scheduling, site management, patrol tracking",
    vertical: "Post Arm Guards",
  },
  {
    service: "Events Module",
    what: "Event staffing, access control, incident reporting",
    vertical: "Events",
  },
  {
    service: "Private Client Module",
    what: "Estate security, personal protection, risk assessment",
    vertical: "Private Clients",
  },
  {
    service: "EP Module",
    what: "Close protection ops, travel security, advance work",
    vertical: "Executive Protection",
  },
];

const stats = [
  { value: "100%", label: "Call Answer Rate" },
  { value: "24/7", label: "Always-On Operation" },
  { value: "0", label: "Missed Follow-Ups" },
  { value: "4x", label: "More Qualified Leads" },
  { value: "60%", label: "Less Admin Time" },
  { value: "1", label: "Platform. Every Vertical." },
];

/* ── Components ── */

function PainCard({
  index,
  title,
  desc,
}: {
  index: number;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col bg-black p-8 transition-colors hover:bg-neutral-950">
      <span className="mb-6 text-4xl font-bold text-neutral-800">
        {String(index).padStart(2, "0")}
      </span>
      <h3 className="mb-3 text-lg font-bold text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-neutral-400">{desc}</p>
    </div>
  );
}

function SolutionRow({
  index,
  title,
  subtitle,
  desc,
  stats,
  reverse,
}: {
  index: number;
  title: string;
  subtitle: string;
  desc: string;
  stats: string;
  reverse: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-8 sm:flex-row sm:items-center ${
        reverse ? "sm:flex-row-reverse" : ""
      }`}
    >
      <div className="flex h-48 flex-1 items-center justify-center border border-neutral-900 bg-neutral-950">
        <span className="text-4xl font-bold text-neutral-800">
          {String(index).padStart(2, "0")}
        </span>
      </div>
      <div className="flex-1">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
          {subtitle}
        </p>
        <h3 className="mb-4 text-2xl font-bold">{title}</h3>
        <p className="mb-4 text-sm leading-relaxed text-neutral-400">{desc}</p>
        <span className="inline-block border border-neutral-800 px-3 py-1 text-xs text-neutral-400">
          {stats}
        </span>
      </div>
    </div>
  );
}
