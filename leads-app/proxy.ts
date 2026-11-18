import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/server/auth/cookies";
import { verifyAccessToken } from "@/server/auth/tokens";

/**
 * Page gate for the signed-in app (Next.js proxy, Node runtime). It verifies the access JWT's
 * signature and expiry only; the (app) layout and every API route still load the session row,
 * so a revoked session is refused there.
 *
 * - valid token with time to spare: continue, passing the path on for the layout's `?next=`
 * - missing, invalid or about to expire: through /api/auth/refresh, which rotates the refresh
 *   token and comes back here, or sends the visitor to /login
 */
const REFRESH_AHEAD_SEC = 60;

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname + request.nextUrl.search;
  const claims = verifyAccessToken(request.cookies.get(ACCESS_COOKIE)?.value);
  if (!claims || claims.exp - Date.now() / 1000 < REFRESH_AHEAD_SEC) {
    const url = new URL("/api/auth/refresh", request.url);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  const headers = new Headers(request.headers);
  headers.set("x-leads-path", path);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // /admin/login is outside: it is where a signed-out admin lands
  matcher: ["/admin", "/admin/((?!login).*)", "/dashboard/:path*", "/leads/:path*", "/listings/:path*", "/packages/:path*", "/checkout/:path*", "/notifications/:path*", "/settings/:path*", "/signup/verify", "/verify-phone"],
};
