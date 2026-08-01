import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <div className="bg-black text-white">
      {/* ── Hero ── */}
      <section className="relative px-6 pb-20 pt-24 sm:pb-28 sm:pt-32">
        <div className="mx-auto max-w-4xl text-center">
          {/* Tagline badge */}
          <span className="mb-8 inline-block border border-neutral-800 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-300">
            Licensed Protection Services
          </span>

          <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Protection built on
            <br />
            discipline.
          </h1>

          <p className="mx-auto mb-10 max-w-xl text-base leading-relaxed text-neutral-400 sm:text-lg">
            no602 provides licensed, trained security personnel for commercial
            facilities, private events, residential estates, and executive
            protection details. Every operative. Every assignment. One standard.
          </p>

          {/* CTAs */}
          <div className="mb-14 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/request-quote"
              className="border border-white bg-white px-8 py-3.5 text-sm font-semibold uppercase tracking-widest text-black transition-colors hover:bg-neutral-200"
            >
              Request a Quote
            </Link>
            <Link
              to="/services"
              className="border border-neutral-700 px-8 py-3.5 text-sm font-semibold uppercase tracking-widest text-white transition-colors hover:border-neutral-500"
            >
              Our Services
            </Link>
          </div>

          {/* Credibility badges */}
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
            <CredBadge label="Licensed" />
            <CredBadge label="Knowledgeable" />
            <CredBadge label="Tactical" />
          </div>
        </div>
      </section>

      {/* ── Services ── */}
      <section className="border-t border-neutral-900 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">
              What We Do
            </p>
            <h2 className="max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
              Four disciplines. One standard of execution.
            </h2>
          </div>

          <div className="grid gap-px bg-neutral-900 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s, i) => (
              <ServiceCard key={s.label} index={i + 1} {...s} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Why no602 ── */}
      <section className="border-t border-neutral-900 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">
              Why no602
            </p>
            <h2 className="max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
              What separates us from every other firm.
            </h2>
          </div>

          <div className="grid gap-1 sm:grid-cols-3">
            {reasons.map((r, i) => (
              <ReasonCard key={r.title} index={i + 1} {...r} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Environments ── */}
      <section className="border-t border-neutral-900 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">
              Who We Work With
            </p>
            <h2 className="max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
              Environments we secure.
            </h2>
          </div>

          <div className="grid gap-px bg-neutral-900 sm:grid-cols-2 lg:grid-cols-4">
            {environments.map((env) => (
              <div
                key={env}
                className="flex items-center bg-black px-6 py-5"
              >
                <span className="text-sm font-medium text-neutral-300">
                  {env}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-neutral-900 px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">
            Talk to Us
          </p>
          <h2 className="mb-4 text-3xl font-bold leading-tight sm:text-4xl">
            Tell us what you need protected.
          </h2>
          <p className="mb-10 text-base leading-relaxed text-neutral-400">
            Every engagement starts with a confidential assessment. No
            obligation. No sales pitch. Just clarity on what it takes to secure
            what matters.
          </p>
          <Link
            to="/request-quote"
            className="inline-block border border-white bg-white px-10 py-4 text-sm font-semibold uppercase tracking-widest text-black transition-colors hover:bg-neutral-200"
          >
            Request a Quote
          </Link>
        </div>
      </section>
    </div>
  );
}

/* ── Components ── */

function CredBadge({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-800 text-xs font-bold text-neutral-300">
        {label === "Licensed" ? "L" : label === "Knowledgeable" ? "K" : "T"}
      </span>
      <span className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
        {label}
      </span>
    </div>
  );
}

function ServiceCard({
  index,
  label,
  title,
  desc,
}: {
  index: number;
  label: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col bg-black p-8 transition-colors hover:bg-neutral-950">
      <span className="mb-6 text-5xl font-bold text-neutral-800">
        {String(index).padStart(2, "0")}
      </span>
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
        {label}
      </p>
      <h3 className="mb-3 text-xl font-bold">{title}</h3>
      <p className="text-sm leading-relaxed text-neutral-400">{desc}</p>
    </div>
  );
}

function ReasonCard({
  index,
  title,
  desc,
}: {
  index: number;
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-black p-8 sm:p-10">
      <span className="mb-6 block text-4xl font-bold text-neutral-800">
        {String(index).padStart(2, "0")}
      </span>
      <h3 className="mb-3 text-lg font-bold">{title}</h3>
      <p className="text-sm leading-relaxed text-neutral-400">{desc}</p>
    </div>
  );
}

/* ── Data ── */

const services = [
  {
    label: "Post Arm Guards",
    title: "Static & Patrol Security",
    desc: "On-site guards, mobile patrols, and access control for commercial and industrial properties.",
  },
  {
    label: "Events",
    title: "Event Security",
    desc: "Crowd management, perimeter control, and security staffing for events of any scale.",
  },
  {
    label: "Private Clients",
    title: "Residential Protection",
    desc: "Estate security, family protection, and personal safety for high-net-worth households.",
  },
  {
    label: "Executive Protection",
    title: "Close Protection",
    desc: "Discreet executive security, travel risk management, and advance planning.",
  },
];

const reasons = [
  {
    title: "Vetted Personnel",
    desc: "Every operative undergoes rigorous background checks, psychological screening, and ongoing performance evaluation. We don't staff bodies — we deploy professionals.",
  },
  {
    title: "Tactical Planning",
    desc: "Every assignment begins with a threat assessment and operational plan. No two sites are the same, and our protocols reflect that reality.",
  },
  {
    title: "Discreet Execution",
    desc: "Security that protects without disrupting. Our presence is felt where it matters and invisible where it doesn't. Professional, composed, and under the radar.",
  },
];

const environments = [
  "Commercial Office Buildings",
  "Industrial Facilities",
  "Construction Sites",
  "Corporate Campuses",
  "Private Estates & Residences",
  "High-Net-Worth Households",
  "Corporate Events & Galas",
  "Music Festivals & Concerts",
  "Sporting Events",
  "Retail & Shopping Centers",
  "Healthcare Facilities",
  "Executive Travel & Transport",
];
