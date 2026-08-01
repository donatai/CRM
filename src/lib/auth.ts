import { createServerFn } from "@tanstack/react-start";
import {
  deleteCookie,
  getCookie,
  setCookie,
} from "@tanstack/react-start/server";

// ---------------------------------------------------------------------------
// Admin auth — single-password, signed-cookie sessions.
//
// No database, no session store. The admin password comes from the
// ADMIN_PASSWORD environment variable (set by the owner). On successful login
// we issue an httpOnly cookie (`no602_auth`) containing a payload signed with
// HMAC-SHA256 using the admin password as the secret. checkAuth() verifies the
// signature, so a forged cookie is rejected.
//
// NOTE: all node:crypto usage lives inside the server functions / helpers
// below (never at module top level), so the client bundle — which imports this
// module for login/checkAuth/logout stubs — never needs a browser crypto
// implementation. The helpers are only ever invoked from server-side handlers.
// ---------------------------------------------------------------------------

export const AUTH_COOKIE = "no602_auth";
export const AUTH_MAX_AGE = 60 * 60 * 24; // 24 hours
export const AUTH_USER_ID = "admin";

// Sign a payload with HMAC-SHA256 using the ADMIN_PASSWORD as the secret.
// Format: `<payload>.<hex signature>`.
export async function getAuthToken(payload: string): Promise<string> {
  const { createHmac } = await import("node:crypto");
  const secret = process.env.ADMIN_PASSWORD ?? "";
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

async function verifyAuthToken(token: string | undefined): Promise<boolean> {
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || !token) return false;

  const idx = token.lastIndexOf(".");
  if (idx <= 0 || idx === token.length - 1) return false;

  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = createHmac("sha256", pw).update(payload).digest("hex");

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

export const login = createServerFn()
  .validator((password: string) => password)
  .handler(async ({ data: password }) => {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return { success: false, error: "ADMIN_PASSWORD not configured" };
    }

    if (password !== adminPassword) {
      return { success: false, error: "Invalid password" };
    }

    setCookie(AUTH_COOKIE, await getAuthToken(AUTH_USER_ID), {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: AUTH_MAX_AGE,
    });

    return { success: true };
  });

export const logout = createServerFn().handler(async () => {
  deleteCookie(AUTH_COOKIE, { path: "/" });
  return { success: true };
});

export const checkAuth = createServerFn().handler(async () => {
  const token = getCookie(AUTH_COOKIE);
  return { authenticated: await verifyAuthToken(token) };
});
