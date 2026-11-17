import "server-only";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { env } from "@/server/env";

/**
 * Access tokens (DR-45): a signed JWT (HS256) that lives 15 minutes in an httpOnly cookie.
 * It names the session (`sid`), so every request can still be checked against `app.sessions`
 * and logout, suspension or a password change take effect at once. The long-lived credential is
 * the opaque refresh token, stored only as a SHA-256 hash (see session.ts).
 */

export const ACCESS_TTL_SEC = 15 * 60;
const ISSUER = "leads";
const AUDIENCE = "leads-web";

export type AccessClaims = { sub: string; sid: string; role: Role };

export function signAccessToken(claims: AccessClaims): string {
  return jwt.sign({ sid: claims.sid, role: claims.role }, env().JWT_SECRET, {
    algorithm: "HS256",
    subject: claims.sub,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: ACCESS_TTL_SEC,
  });
}

export type VerifiedAccess = AccessClaims & { exp: number };

/** The claims of a valid, unexpired access token, or null. Only HS256 is accepted. */
export function verifyAccessToken(token: string | undefined | null): VerifiedAccess | null {
  if (!token || token.length > 2048) return null;
  try {
    const p = jwt.verify(token, env().JWT_SECRET, { algorithms: ["HS256"], issuer: ISSUER, audience: AUDIENCE });
    if (typeof p === "string" || typeof p.sub !== "string" || typeof p.sid !== "string" || typeof p.role !== "string" || typeof p.exp !== "number") return null;
    return { sub: p.sub, sid: p.sid, role: p.role as Role, exp: p.exp };
  } catch {
    return null;
  }
}

/** Opaque refresh token: 32 random bytes in the cookie, only its SHA-256 in the database. */
export function newRefreshToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
