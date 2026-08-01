import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  component: About,
});

function About() {
  return (
    <div className="bg-black text-white">
      <section className="px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <span className="mb-8 inline-block border border-neutral-800 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-300">
            About no602
          </span>
          <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Protection built on
            <br />
            discipline.
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-base leading-relaxed text-neutral-400 sm:text-lg">
            no602 was founded on a single principle: security is a discipline,
            not a commodity. Every operative we deploy, every plan we write, and
            every site we protect is held to one standard — ours.
          </p>
        </div>
      </section>

      <section className="border-t border-neutral-900 px-6 py-24">
        <div className="mx-auto max-w-3xl space-y-16">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">
              Our Mission
            </p>
            <p className="text-lg leading-relaxed text-neutral-300">
              To provide licensed, vetted, and professionally managed security
              services that protect people, property, and peace of mind —
              without compromise.
            </p>
          </div>

          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">
              Who We Are
            </p>
            <p className="text-lg leading-relaxed text-neutral-400">
              We are a team of security professionals, operations specialists,
              and technology builders. Our leadership brings decades of combined
              experience across military, law enforcement, and private security
              sectors. We know what works because we've done it.
            </p>
          </div>

          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">
              How We Operate
            </p>
            <p className="text-lg leading-relaxed text-neutral-400">
              Every engagement begins with an assessment. We study the
              environment, identify vulnerabilities, and build a tailored plan.
              Then we execute — with precision, discretion, and accountability
              at every step.
            </p>
          </div>

          <div className="pt-4">
            <Link
              to="/request-quote"
              className="inline-block border border-white bg-white px-8 py-3.5 text-sm font-semibold uppercase tracking-widest text-black transition-colors hover:bg-neutral-200"
            >
              Request a Quote
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
