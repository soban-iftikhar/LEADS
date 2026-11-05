import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { prisma } from "@/server/db";

/**
 * Server-side sessions (DR-37, SPEC_02 5.3). The browser holds a random 32-byte token in an
 * httpOnly cookie; the database holds only its SHA-256. Revoking the row ends the session on
 * the very next request.
 */

const DAY = 86_400_000;
const REMEMBER_MS = 30 * DAY; // "Keep me logged in"
const SHORT_MS = 12 * 3_600_000; // browser session
const ABSOLUTE_MS = 30 * DAY;
const SLIDE_AFTER_MS = 5 * 60_000;

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-leads_session" : "leads_session";

export const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

export type SessionUser = Awaited<ReturnType<typeof loadSession>> extends infer T ? NonNullable<T> : never;

export async function createSession(userId: string, opts: { remember: boolean; userAgent?: string | null; ipHash?: string | null }) {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt: new Date(now + (opts.remember ? REMEMBER_MS : SHORT_MS)),
      absoluteExpiresAt: new Date(now + ABSOLUTE_MS),
      userAgent: opts.userAgent?.slice(0, 300) ?? null,
      ipHash: opts.ipHash ?? null,
      twoFactorPassed: true, // customers have no 2FA; admin sign-in is not offered through these routes
    },
  });
  return { token, remember: opts.remember };
}

export function setSessionCookie(res: NextResponse, s: { token: string; remember: boolean }) {
  res.cookies.set(SESSION_COOKIE, s.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // without maxAge the cookie dies with the browser; the row still expires on its own
    ...(s.remember ? { maxAge: REMEMBER_MS / 1000 } : {}),
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
}

/** Valid session + its user, or null (unknown, revoked, expired, user not active, password changed since). */
export async function loadSession(token: string | undefined | null) {
  if (!token || token.length > 100) return null;
  const s = await prisma.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: { include: { customer: true } } } });
  if (!s || s.revokedAt) return null;
  const now = Date.now();
  if (s.expiresAt.getTime() <= now || s.absoluteExpiresAt.getTime() <= now) return null;
  if (s.user.status !== "ACTIVE") return null;
  if (s.user.passwordChangedAt && s.createdAt < s.user.passwordChangedAt) return null;
  if (now - s.lastSeenAt.getTime() > SLIDE_AFTER_MS) {
    // slide the idle expiry, at most once every 5 minutes; long sessions keep their length
    const span = s.expiresAt.getTime() - s.lastSeenAt.getTime();
    const next = Math.min(now + span, s.absoluteExpiresAt.getTime());
    await prisma.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date(now), expiresAt: new Date(next) } }).catch(() => {});
  }
  return { session: s, user: s.user };
}

/** Session for the current request (server components, server actions, route handlers). */
export async function currentSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return loadSession(token);
}

export async function revokeSession(id: string, reason: string) {
  await prisma.session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: reason } });
}

export async function revokeAllSessions(userId: string, reason: string, exceptId?: string) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
}
