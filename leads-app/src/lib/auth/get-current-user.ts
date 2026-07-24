import { NextRequest } from "next/server";
import { verifyToken, JwtPayload } from "@/lib/auth/jwt";

/**
 * Extracts and verifies the JWT from the request's "token" cookie.
 * Returns the decoded payload, or null if missing/invalid.
 *
 * Centralizing this avoids repeating cookie-read + verify logic
 * in every protected route handler.
 */
export function getCurrentUser(request: NextRequest): JwtPayload | null {
  const token = request.cookies.get("token")?.value;
  if (!token) return null;

  return verifyToken(token);
}