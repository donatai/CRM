import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/contact")({
  component: Contact,
});

function Contact() {
  return (
    <div className="bg-black text-white">
      <section className="px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <span className="mb-8 inline-block border border-neutral-800 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-300">
            Contact
          </span>
          <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Get in touch.
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-base leading-relaxed text-neutral-400 sm:text-lg">
            Every conversation starts with a confidential assessment. Tell us
            what you need — we'll tell you how we'd protect it.
          </p>
        </div>
      </section>

      <section className="border-t border-neutral-900 px-6 py-24">
        <div className="mx-auto max-w-2xl">
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              alert("Thanks for reaching out. We'll be in touch within 24 hours.");
            }}
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-neutral-400">
                  Name
                </label>
                <input
                  type="text"
                  className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
                  placeholder="Your name"
                  required
                />
              </div>
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
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-neutral-400">
                What do you need protected?
              </label>
              <textarea
                rows={4}
                className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
                placeholder="Describe your security needs..."
                required
              />
            </div>
            <button
              type="submit"
              className="border border-white bg-white px-8 py-3.5 text-sm font-semibold uppercase tracking-widest text-black transition-colors hover:bg-neutral-200"
            >
              Send Message
            </button>
          </form>

          <div className="mt-16 grid gap-8 border-t border-neutral-900 pt-12 sm:grid-cols-3">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Phone
              </p>
              <p className="text-sm text-neutral-300">(800) 555-0602</p>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Email
              </p>
              <p className="text-sm text-neutral-300">ops@no602.com</p>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Location
              </p>
              <p className="text-sm text-neutral-300">United States</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
