import { NextResponse, type NextRequest } from "next/server";
import { setAuthCookies } from "@/server/auth/cookies";
import { finishAuth, OAUTH_COOKIE_OPTIONS, PENDING_COOKIE, sign, STATE_COOKIE, unsign, type OAuthState } from "@/server/auth/google";
import { env } from "@/server/env";
import { clientIp } from "@/server/http/client-ip";
import { findGoogleUser, googleSignIn } from "@/server/modules/auth/service";

// GET /api/auth/google/callback?code&state -> signed in (redirect to next), or /signup/google to pick a type
export async function GET(request: NextRequest) {
  const base = env().NEXT_PUBLIC_APP_URL;
  const done = (res: NextResponse) => {
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/auth/google" });
    return res;
  };
  const fail = (reason: string) => {
    if (reason) console.warn("[auth] Google sign-in failed:", reason);
    return done(NextResponse.redirect(new URL("/login?error=google", base)));
  };
  const sp = request.nextUrl.searchParams;
  if (sp.get("error")) return fail(""); // the person cancelled on Google's screen
  const state = unsign<OAuthState>(request.cookies.get(STATE_COOKIE)?.value);
  const code = sp.get("code");
  if (!state || !code || sp.get("state") !== state.state) return fail("state mismatch or missing code");
  try {
    const profile = await finishAuth(code, state.verifier);
    const user = await findGoogleUser(profile);
    if (user) {
      const res = NextResponse.redirect(new URL(state.next || "/dashboard", base));
      setAuthCookies(res, await googleSignIn(user, { userAgent: request.headers.get("user-agent"), ip: clientIp(request) }));
      return done(res);
    }
    // first time: they choose Owner or Agency before the account exists
    const res = NextResponse.redirect(new URL(`/signup/google${state.type ? `?type=${state.type}` : ""}`, base));
    res.cookies.set(PENDING_COOKIE, sign({ ...profile, exp: Date.now() + 15 * 60_000 }), { ...OAUTH_COOKIE_OPTIONS, path: "/", maxAge: 900 });
    return done(res);
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}
