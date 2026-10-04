import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { signToken, verifyToken, type JwtPayload } from "@/server/auth/jwt";

/** The only place that knows the session cookie's name and attributes. */
export const SESSION_COOKIE = "leads_token";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true, // never readable from page scripts
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge,
    path: "/",
  };
}

/** The signed-in user, or null when the cookie is missing, invalid or expired. */
export function getCurrentUser(request: NextRequest): JwtPayload | null {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return token ? verifyToken(token) : null;
}

/** Signs the user in: the token goes in an httpOnly cookie and nowhere else. */
export function startSession(response: NextResponse, user: JwtPayload): void {
  response.cookies.set(SESSION_COOKIE, signToken(user), cookieOptions(SESSION_MAX_AGE_SECONDS));
}

export function endSession(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
}
