import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  useLocation,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { checkAuth, logout } from "~/lib/auth";
import appCss from "~/styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "no602 — Licensed Protection Services" },
      {
        name: "description",
        content:
          "Licensed protection services. Post arm guards, event security, private client protection, and executive protection — built on discipline.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: () => (
    <div className="flex min-h-[60vh] items-center justify-center text-neutral-500">
      Page not found
    </div>
  ),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Nav />
      <Outlet />
      <Footer />
    </RootDocument>
  );
}

function Nav() {
  const linkClass =
    "text-sm uppercase tracking-widest text-neutral-400 transition-colors hover:text-white [&.active]:text-white";
  const location = useLocation();
  const [authenticated, setAuthenticated] = useState(false);

  // Check auth state on mount and whenever the route changes, so admin links
  // appear/disappear immediately after login, logout, or session expiry.
  useEffect(() => {
    let active = true;
    checkAuth().then((res) => {
      if (active) setAuthenticated(res.authenticated);
    });
    return () => {
      active = false;
    };
  }, [location.pathname]);

  async function handleLogout() {
    await logout();
    setAuthenticated(false);
    window.location.href = "/";
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-neutral-900 bg-black/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link
          to="/"
          className="text-lg font-bold tracking-tight text-white"
        >
          no<span className="text-amber-500">602</span>
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          <Link to="/" className={linkClass}>
            Home
          </Link>
          <Link to="/services" className={linkClass}>
            Services
          </Link>
          <Link to="/about" className={linkClass}>
            About
          </Link>
          <Link to="/contact" className={linkClass}>
            Contact
          </Link>
          {authenticated && (
            <>
              <Link to="/crm" className={linkClass}>
                CRM
              </Link>
              <Link to="/receptionist" className={linkClass}>
                Receptionist
              </Link>
              <Link to="/marketing" className={linkClass}>
                Marketing
              </Link>
              <Link to="/analytics" className={linkClass}>
                Analytics
              </Link>
            </>
          )}
          {authenticated && (
            <button
              onClick={handleLogout}
              className="text-sm uppercase tracking-widest text-neutral-500 transition-colors hover:text-amber-500"
            >
              Logout
            </button>
          )}
          <Link
            to="/request-quote"
            className="border border-neutral-700 px-5 py-2 text-sm uppercase tracking-widest text-white transition-colors hover:border-neutral-500 hover:bg-neutral-900"
          >
            Request Quote
          </Link>
        </div>
        {/* Mobile nav toggle — simple version */}
        <button className="text-neutral-400 md:hidden" aria-label="Menu">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="border-t border-neutral-900 bg-black">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-3">
          {/* Company */}
          <div>
            <p className="mb-3 text-lg font-bold tracking-tight text-white">
              no<span className="text-amber-500">602</span>
            </p>
            <p className="max-w-xs text-sm leading-relaxed text-neutral-500">
              Licensed protection services for commercial, event, residential,
              and executive security. Built on discipline. Delivered with
              precision.
            </p>
          </div>
          {/* Services */}
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Services
            </p>
            <ul className="space-y-2 text-sm text-neutral-500">
              <li>
                <Link to="/services" className="transition-colors hover:text-white">
                  Post Arm Guards
                </Link>
              </li>
              <li>
                <Link to="/services" className="transition-colors hover:text-white">
                  Event Security
                </Link>
              </li>
              <li>
                <Link to="/services" className="transition-colors hover:text-white">
                  Private Clients
                </Link>
              </li>
              <li>
                <Link to="/services" className="transition-colors hover:text-white">
                  Executive Protection
                </Link>
              </li>
            </ul>
          </div>
          {/* Contact */}
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Contact
            </p>
            <ul className="space-y-2 text-sm text-neutral-500">
              <li>
                <Link to="/contact" className="transition-colors hover:text-white">
                  Get in Touch
                </Link>
              </li>
              <li>
                <Link to="/request-quote" className="transition-colors hover:text-white">
                  Request a Quote
                </Link>
              </li>
              <li>
                <Link to="/about" className="transition-colors hover:text-white">
                  About no602
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-neutral-900 pt-8">
          <p className="text-xs text-neutral-600">
            &copy; {new Date().getFullYear()} no602. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth bg-black text-white">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-dvh bg-black">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
