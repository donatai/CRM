import { neon } from "@neondatabase/serverless";

/**
 * Server-only handle to the team's database (Neon serverless Postgres).
 *
 * Usage inside createServerFn() handlers:
 *   const s = sql();
 *   const rows = await s`SELECT id, title FROM leads`;
 */
export function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set — connect a database (via the database card) before running queries.",
    );
  }
  return neon(url);
}
