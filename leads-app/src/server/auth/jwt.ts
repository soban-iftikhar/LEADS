import "server-only";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "@/server/env";

export type UserRole = "BUYER" | "SELLER" | "ADMIN";

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export function signToken(payload: JwtPayload): string {
  const { JWT_SECRET, JWT_EXPIRES_IN } = env();
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, env().JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}
