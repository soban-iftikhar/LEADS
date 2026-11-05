import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Session cookie names (src/server/auth/sessions.ts). The proxy only checks that one is present,
// to redirect signed-out visitors before a page renders; it never trusts it. Every API route and
// the (app) layout load and validate the session themselves.
const COOKIES = ["__Host-leads_session", "leads_session"];

export function proxy(request: NextRequest) {
  const signedIn = COOKIES.some((c) => !!request.cookies.get(c)?.value);
  if (!signedIn) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  // the (app) layout reads this to build its own ?next= when it has to send someone away
  const headers = new Headers(request.headers);
  headers.set("x-leads-path", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/leads/:path*",
    "/listings/:path*",
    "/packages/:path*",
    "/checkout/:path*",
    "/notifications/:path*",
    "/settings/:path*",
    "/signup/verify",
    "/verify-phone",
  ],
};
