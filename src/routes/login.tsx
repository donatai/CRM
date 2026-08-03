import {
  createFileRoute,
  redirect,
} from "@tanstack/react-router";
import { useState } from "react";
import { checkAuth, login } from "~/lib/auth";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const { authenticated } = await checkAuth();
    if (authenticated) {
      throw redirect({ to: "/crm" });
    }
  },
  component: Login,
});

function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await login({ data: password });
      if (result.success) {
        // Full page load so the fresh session is server-rendered with the
        // nav in its authenticated state.
        window.location.href = "/crm";
        return;
      }
      setError(result.error ?? "Invalid password");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-black px-6 py-24">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-2xl font-bold tracking-tight text-white">
            no<span className="text-amber-500">602</span>
          </p>
          <h1 className="mt-3 text-sm font-semibold uppercase tracking-[0.25em] text-neutral-300">
            Admin Login
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 border border-neutral-900 bg-neutral-950/50 p-8"
        >
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Password
            </label>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              placeholder="Admin password"
              className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full border border-white bg-white px-8 py-3.5 text-sm font-semibold uppercase tracking-widest text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
