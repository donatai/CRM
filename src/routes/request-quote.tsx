import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/request-quote")({
  component: RequestQuote,
});

function RequestQuote() {
  return (
    <div className="bg-black text-white">
      <section className="px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <span className="mb-8 inline-block border border-neutral-800 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-300">
            Request a Quote
          </span>
          <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Tell us what you need
            <br />
            protected.
          </h1>
          <p className="mx-auto mb-4 max-w-xl text-base leading-relaxed text-neutral-400 sm:text-lg">
            Every engagement starts with a confidential assessment. Fill out the
            form below and we'll respond within 24 hours with a tailored plan
            and pricing.
          </p>
        </div>
      </section>

      <section className="border-t border-neutral-900 px-6 py-24">
        <div className="mx-auto max-w-2xl">
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              alert("Quote request received. We'll be in touch within 24 hours.");
            }}
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-neutral-400">
                  First Name
                </label>
                <input
                  type="text"
                  className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
                  placeholder="First name"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-neutral-400">
                  Last Name
                </label>
                <input
                  type="text"
                  className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
                  placeholder="Last name"
                  required
                />
              </div>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-neutral-400">
                  Email
                </label>
                <input
                  type="email"
                  className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
                  placeholder="you@company.com"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-neutral-400">
                  Phone
                </label>
                <input
                  type="tel"
                  className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
                  placeholder="(555) 000-0000"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-neutral-400">
                Service Type
              </label>
              <select className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white focus:border-neutral-600 focus:outline-none">
                <option value="">Select a service...</option>
                <option value="post-arm">Post Arm Guards</option>
                <option value="events">Event Security</option>
                <option value="private">Private Client Protection</option>
                <option value="executive">Executive Protection</option>
                <option value="other">Other / Multiple</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-neutral-400">
                Tell us about your security needs
              </label>
              <textarea
                rows={5}
                className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
                placeholder="Describe the property, event, or situation you need protected. Include any relevant details like location, duration, and special concerns."
                required
              />
            </div>
            <button
              type="submit"
              className="border border-white bg-white px-10 py-4 text-sm font-semibold uppercase tracking-widest text-black transition-colors hover:bg-neutral-200"
            >
              Submit Quote Request
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
