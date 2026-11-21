import "server-only";
import type { NextResponse } from "next/server";
import { ACCESS_TTL_SEC } from "./tokens";

/**
 * The two auth cookies. Both are httpOnly: page scripts never see a token, and nothing is kept
 * in localStorage or sessionStorage.
 *
 * - access: the JWT, sent on every request (Path=/). `__Host-` in production.
 * - refresh: the opaque token, sent only to /api/auth (refresh and logout). `__Secure-` in
 *   production, because `__Host-` cookies must use Path=/.
 */

const prod = process.env.NODE_ENV === "production";
export const ACCESS_COOKIE = prod ? "__Host-leads_at" : "leads_at";
export const REFRESH_COOKIE = prod ? "__Secure-leads_rt" : "leads_rt";
const REFRESH_PATH = "/api/auth";

const base = { httpOnly: true, secure: prod, sameSite: "lax" as const };

export type IssuedTokens = { accessToken: string; refreshToken: string | null; remember: boolean; refreshMaxAgeSec: number };

/** Sets the access cookie, and the refresh cookie when a new refresh token was issued. */
export function setAuthCookies(res: NextResponse, t: IssuedTokens): void {
  res.cookies.set(ACCESS_COOKIE, t.accessToken, { ...base, path: "/", maxAge: ACCESS_TTL_SEC });
  if (t.refreshToken) {
    // without maxAge the cookie ends with the browser session; the session row expires on its own
    res.cookies.set(REFRESH_COOKIE, t.refreshToken, { ...base, path: REFRESH_PATH, ...(t.remember ? { maxAge: t.refreshMaxAgeSec } : {}) });
  }
}

export function clearAuthCookies(res: NextResponse): void {
  res.cookies.set(ACCESS_COOKIE, "", { ...base, path: "/", maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { ...base, path: REFRESH_PATH, maxAge: 0 });
}
