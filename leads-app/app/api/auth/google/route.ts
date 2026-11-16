import { NextResponse, type NextRequest } from "next/server";
import { googleEnabled, startAuth, STATE_COOKIE } from "@/server/auth/google";
import { limit, toResponse } from "@/server/http/handler";
import { clientIp } from "@/server/http/client-ip";
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
    res.cookies.set(STATE_COOKIE, cookie, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/auth/google", maxAge: 600 });
    return res;
  } catch (e) {
    return toResponse(e);
  }
}
