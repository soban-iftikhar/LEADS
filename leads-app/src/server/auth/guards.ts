import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import type { JwtPayload, UserRole } from "@/server/auth/jwt";

type Guard = { ok: true; user: JwtPayload } | { ok: false; response: NextResponse };

/**
 * Route handlers call a guard first and return its response on failure:
 *
 *   const auth = requireRole(request, "ADMIN");
 *   if (!auth.ok) return auth.response;
 *
 * proxy.ts only redirects pages; every handler still checks for itself.
 */
export function requireUser(request: NextRequest): Guard {
  const user = getCurrentUser(request);
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true, user };
}

export function requireRole(request: NextRequest, ...roles: UserRole[]): Guard {
  const auth = requireUser(request);
  if (!auth.ok) return auth;
  if (!roles.includes(auth.user.role)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return auth;
}
