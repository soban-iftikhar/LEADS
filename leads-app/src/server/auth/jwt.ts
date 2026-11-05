import "server-only";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "@/server/env";

export type UserRole = "BUYER" | "SELLER" | "ADMIN";

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

// Legacy: only the listing/admin routes that SPEC_02 has not migrated yet still use this.
function secret(): string {
  const s = env().JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET must be at least 32 characters");
  return s;
}

export function signToken(payload: JwtPayload): string {
  const { JWT_EXPIRES_IN } = env();
  return jwt.sign(payload, secret(), {
    expiresIn: JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, secret()) as JwtPayload;
  } catch {
    return null;
  }
}
