import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";

// Sends signed-out visitors to the login page before a protected page renders.
// This is a convenience for pages only: every API route handler checks the
// session itself with the guards in src/server/auth/guards.ts.
export function proxy(request: NextRequest) {
  if (!getCurrentUser(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/listings/:path*", "/leads/:path*"],
};
