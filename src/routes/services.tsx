import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/services")({
  component: Services,
});

function Services() {
  return (
    <div className="bg-black text-white">
      <section className="px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <span className="mb-8 inline-block border border-neutral-800 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-300">
            Our Services
          </span>
          <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Four disciplines.
            <br />
            One standard of execution.
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-base leading-relaxed text-neutral-400 sm:text-lg">
            no602 delivers licensed, trained security personnel across every
            sector that matters. Each vertical operates under the same
            discipline, the same standards, and the same command structure.
          </p>
          <Link
            to="/request-quote"
            className="inline-block border border-white bg-white px-8 py-3.5 text-sm font-semibold uppercase tracking-widest text-black transition-colors hover:bg-neutral-200"
          >
            Request a Quote
          </Link>
        </div>
      </section>

      <section className="border-t border-neutral-900 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-px bg-neutral-900 sm:grid-cols-2">
            {verticals.map((v, i) => (
              <div key={v.title} className="bg-black p-10">
                <span className="mb-6 block text-4xl font-bold text-neutral-800">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                  {v.label}
                </p>
                <h3 className="mb-3 text-xl font-bold">{v.title}</h3>
                <p className="mb-6 text-sm leading-relaxed text-neutral-400">
                  {v.desc}
                </p>
                <ul className="space-y-2 text-sm text-neutral-500">
                  {v.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <span className="mt-1 block h-1 w-1 shrink-0 bg-neutral-600" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

const verticals = [
  {
    label: "Post Arm Guards",
    title: "Static & Patrol Security",
    desc: "On-site guards, mobile patrols, and access control for commercial and industrial properties.",
    bullets: [
      "On-site guard deployment & rotation",
      "Mobile patrol routes & reporting",
      "Access control & visitor management",
      "Incident documentation & escalation",
      "24/7 command center oversight",
    ],
  },
  {
    label: "Events",
    title: "Event Security",
    desc: "Crowd management, perimeter control, and security staffing for events of any scale.",
    bullets: [
      "Crowd management & flow control",
      "Perimeter & access point security",
      "Bag checks & screening protocols",
      "Emergency response planning",
      "Post-event security debrief",
    ],
  },
  {
    label: "Private Clients",
    title: "Residential Protection",
    desc: "Estate security, family protection, and personal safety for high-net-worth households.",
    bullets: [
      "Estate security assessments",
      "Residential guard placement",
      "Family protection protocols",
      "Visitor screening & management",
      "Crisis intervention planning",
    ],
  },
  {
    label: "Executive Protection",
    title: "Close Protection",
    desc: "Discreet executive security, travel risk management, and advance planning.",
    bullets: [
      "Close protection operatives",
      "Travel route risk assessment",
      "Advance team coordination",
      "Secure transportation logistics",
      "Threat monitoring & response",
    ],
  },
];
