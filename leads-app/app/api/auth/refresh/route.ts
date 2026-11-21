import { NextResponse, type NextRequest } from "next/server";
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from "@/server/auth/cookies";
import { refreshSession } from "@/server/auth/session";
import { clientIp } from "@/server/http/client-ip";
import { limit } from "@/server/http/rate-limit";
import { fail, noContent } from "@/server/http/response";
import { route, toErrorResponse } from "@/server/http/route";
import { safeNext } from "@/lib/redirects";

const LIMIT = { max: 60, windowSec: 300 };

// POST /api/auth/refresh -> 204 with a new access token (and a rotated refresh token); 401 when the
// session is over. The browser client calls it when an API call answers 401.
export const POST = route({
  auth: "public",
  limits: [{ key: "refresh", limit: LIMIT.max, windowSeconds: LIMIT.windowSec }],
  handler: async ({ request }) => {
    const r = await refreshSession(request.cookies.get(REFRESH_COOKIE)?.value);
    const res = r.ok ? noContent() : fail("Please log in.", 401);
    if (r.ok) setAuthCookies(res, r.tokens);
    else clearAuthCookies(res);
    return res;
  },
});

// GET /api/auth/refresh?next=/path -> back to `next` with fresh cookies, or to /login.
// proxy.ts sends page navigations here when the access token is missing or about to expire.
export async function GET(request: NextRequest) {
  try {
    await limit(`refresh:ip:${clientIp(request)}`, LIMIT.max, LIMIT.windowSec);
  } catch (e) {
    return toErrorResponse(e);
  }
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  // same-origin redirects: `next` is a path (safeNext), the origin is this request's own
  const base = request.url;
  const r = await refreshSession(request.cookies.get(REFRESH_COOKIE)?.value);
  if (r.ok) {
    const res = NextResponse.redirect(new URL(next, base));
    setAuthCookies(res, r.tokens);
    return res;
  }
  const res = NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, base));
  clearAuthCookies(res);
  return res;
}
