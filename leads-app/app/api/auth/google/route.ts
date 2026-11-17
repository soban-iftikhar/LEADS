import { NextResponse, type NextRequest } from "next/server";
import { googleEnabled, OAUTH_COOKIE_OPTIONS, startAuth, STATE_COOKIE } from "@/server/auth/google";
import { clientIp } from "@/server/http/client-ip";
import { limit } from "@/server/http/rate-limit";
import { toErrorResponse } from "@/server/http/route";
import { safeNext } from "@/lib/redirects";

// GET /api/auth/google?type=seller|agency&next=/path -> redirect to Google
export async function GET(request: NextRequest) {
  try {
    await limit(`google:ip:${clientIp(request)}`, 30, 900);
    if (!googleEnabled()) return NextResponse.redirect(new URL("/login?error=google", request.url));
    const sp = request.nextUrl.searchParams;
    const type = sp.get("type") === "agency" ? "agency" : sp.get("type") === "seller" ? "seller" : null;
    const { url, cookie } = startAuth(type, safeNext(sp.get("next")));
    const res = NextResponse.redirect(url);
    res.cookies.set(STATE_COOKIE, cookie, { ...OAUTH_COOKIE_OPTIONS, path: "/api/auth/google", maxAge: 600 });
    return res;
  } catch (e) {
    return toErrorResponse(e);
  }
}
