import { NextResponse, type NextRequest } from "next/server";
import { finishAuth, PENDING_COOKIE, sign, STATE_COOKIE, unsign, type OAuthState } from "@/server/auth/google";
import { setSessionCookie } from "@/server/auth/sessions";
import { env } from "@/server/env";
import { clientIp } from "@/server/http/client-ip";
import { findGoogleUser, googleSignIn } from "@/server/modules/auth/service";

// GET /api/auth/google/callback?code&state -> signed in (redirect next) or /signup/google to pick a type
export async function GET(request: NextRequest) {
  const base = env().NEXT_PUBLIC_APP_URL;
  const fail = (reason: string) => {
    if (reason) console.warn("[auth] Google sign-in failed:", reason);
    const res = NextResponse.redirect(new URL("/login?error=google", base));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/auth/google" });
    return res;
  };
  const sp = request.nextUrl.searchParams;
  if (sp.get("error")) return fail(""); // the person cancelled on Google's screen
  const st = unsign<OAuthState>(request.cookies.get(STATE_COOKIE)?.value);
  const code = sp.get("code");
  if (!st || !code || sp.get("state") !== st.state) return fail("state mismatch or missing code");
  try {
    const g = await finishAuth(code, st.verifier);
    const user = await findGoogleUser(g);
    if (user) {
      const session = await googleSignIn(user, { userAgent: request.headers.get("user-agent"), ip: clientIp(request) });
      const res = NextResponse.redirect(new URL(st.next || "/dashboard", base));
      setSessionCookie(res, session);
      res.cookies.delete({ name: STATE_COOKIE, path: "/api/auth/google" });
      return res;
    }
    // first time: they choose Owner or Agency before the account exists
    const res = NextResponse.redirect(new URL(`/signup/google${st.type ? `?type=${st.type}` : ""}`, base));
    res.cookies.set(PENDING_COOKIE, sign({ ...g, exp: Date.now() + 15 * 60_000 }), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 900 });
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/auth/google" });
    return res;
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}
