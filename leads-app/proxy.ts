import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";

// TODO(api): drop the mock cookie once the UI talks to the real auth routes.
const MOCK_COOKIE = "leads_mock_session";

// Sends signed-out visitors to the login page before a protected page renders, keeping where
// they were going in `next`. This is a convenience for pages only: every API route handler checks
// the session itself, and the (app) layout re-checks role and phone verification.
export function proxy(request: NextRequest) {
  const signedIn = !!getCurrentUser(request) || !!request.cookies.get(MOCK_COOKIE)?.value;
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
  ],
};
