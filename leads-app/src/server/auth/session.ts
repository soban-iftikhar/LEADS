import "server-only";
import type { Prisma, User } from "@prisma/client";
import { prisma } from "@/server/db";
import type { IssuedTokens } from "./cookies";
import { newRefreshToken, sha256, signAccessToken, verifyAccessToken } from "./tokens";

/**
 * Sessions (DR-45). One `app.sessions` row per signed-in device. The browser holds a 15-minute
 * access JWT and an opaque refresh token; the row holds the refresh token's hash and the limits.
 *
 * - Refresh rotates the refresh token every time. The replaced token is remembered: if it is ever
 *   presented again after a short grace period (two tabs refreshing at once), the session is
 *   revoked, because someone else holds a copy.
 * - Every request re-checks the row named by the access token, so revocation is immediate.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const LIMITS = { rememberIdleMs: 30 * DAY, shortIdleMs: 12 * HOUR, absoluteMs: 30 * DAY, adminAbsoluteMs: 24 * HOUR };
/** A replaced refresh token still works this long, for parallel refreshes from several tabs. */
const ROTATION_GRACE_MS = 30_000;

/** The allowed values of `sessions.revoked_reason` (a CHECK constraint in the database). */
export type RevokeReason = "logout" | "logout_all" | "password_changed" | "password_reset" | "suspended" | "deleted" | "admin" | "refresh_reuse";

export type SessionWithUser = Prisma.SessionGetPayload<{ include: { user: { include: { customer: true } } } }>;
export type Auth = { session: SessionWithUser; user: SessionWithUser["user"] };

function usable(s: SessionWithUser | null, now = Date.now()): s is SessionWithUser {
  if (!s || s.revokedAt) return false;
  if (s.expiresAt.getTime() <= now || s.absoluteExpiresAt.getTime() <= now) return false;
  if (s.user.status !== "ACTIVE") return false;
  // sessions that started before the last password change are dead
  if (s.user.passwordChangedAt && s.createdAt < s.user.passwordChangedAt) return false;
  return true;
}

function issue(s: { id: string; remember: boolean; absoluteExpiresAt: Date }, user: Pick<User, "id" | "role">, refreshToken: string | null): IssuedTokens {
  return {
    accessToken: signAccessToken({ sub: user.id, sid: s.id, role: user.role }),
    refreshToken,
    remember: s.remember,
    refreshMaxAgeSec: Math.max(0, Math.floor((s.absoluteExpiresAt.getTime() - Date.now()) / 1000)),
  };
}

export async function createSession(user: Pick<User, "id" | "role">, opts: { remember: boolean; userAgent?: string | null; ipHash?: string | null }): Promise<IssuedTokens> {
  const refreshToken = newRefreshToken();
  const now = Date.now();
  const s = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      remember: opts.remember,
      expiresAt: new Date(now + (opts.remember ? LIMITS.rememberIdleMs : LIMITS.shortIdleMs)),
      absoluteExpiresAt: new Date(now + (user.role === "ADMIN" ? LIMITS.adminAbsoluteMs : LIMITS.absoluteMs)),
      userAgent: opts.userAgent?.slice(0, 300) ?? null,
      ipHash: opts.ipHash ?? null,
      twoFactorPassed: user.role !== "ADMIN",
    },
  });
  return issue(s, user, refreshToken);
}

export type RefreshResult = { ok: true; tokens: IssuedTokens } | { ok: false };

/** Trades a refresh token for a new access token and a new refresh token. */
export async function refreshSession(refreshToken: string | undefined | null): Promise<RefreshResult> {
  if (!refreshToken || refreshToken.length > 100) return { ok: false };
  const hash = sha256(refreshToken);
  const now = Date.now();

  const s = await prisma.session.findUnique({ where: { tokenHash: hash }, include: { user: { include: { customer: true } } } });
  if (s) {
    if (!usable(s, now)) return { ok: false };
    const next = newRefreshToken();
    const idle = s.remember ? LIMITS.rememberIdleMs : LIMITS.shortIdleMs;
    // compare-and-swap on the current hash: of two parallel refreshes only one rotates
    const swapped = await prisma.session.updateMany({
      where: { id: s.id, tokenHash: hash, revokedAt: null },
      data: {
        tokenHash: sha256(next),
        previousTokenHash: hash,
        rotatedAt: new Date(now),
        lastSeenAt: new Date(now),
        expiresAt: new Date(Math.min(now + idle, s.absoluteExpiresAt.getTime())),
      },
    });
    if (swapped.count === 1) return { ok: true, tokens: issue(s, s.user, next) };
  }

  // not the current token: a just-replaced one (parallel tab) or a stolen copy being replayed
  const prev = await prisma.session.findUnique({ where: { previousTokenHash: hash }, include: { user: { include: { customer: true } } } });
  if (!prev) return { ok: false };
  if (usable(prev, now) && prev.rotatedAt && now - prev.rotatedAt.getTime() <= ROTATION_GRACE_MS) {
    // the other response already set the new refresh cookie; only a new access token is needed
    return { ok: true, tokens: issue(prev, prev.user, null) };
  }
  await revokeSession(prev.id, "refresh_reuse");
  return { ok: false };
}

/** The session and user behind an access token, or null when it is invalid, expired or revoked. */
export async function authFromAccessToken(token: string | undefined | null): Promise<Auth | null> {
  const claims = verifyAccessToken(token);
  if (!claims) return null;
  const s = await prisma.session.findUnique({ where: { id: claims.sid }, include: { user: { include: { customer: true } } } });
  if (!usable(s) || s.userId !== claims.sub) return null;
  return { session: s, user: s.user };
}

/** The session a refresh token belongs to (current or just replaced), for logout. */
export function sessionIdForRefreshToken(refreshToken: string): Promise<{ id: string } | null> {
  const hash = sha256(refreshToken);
  return prisma.session.findFirst({ where: { OR: [{ tokenHash: hash }, { previousTokenHash: hash }] }, select: { id: true } });
}

export async function revokeSession(id: string, reason: RevokeReason): Promise<void> {
  await prisma.session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: reason } });
}

export async function revokeAllSessions(userId: string, reason: RevokeReason, exceptId?: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
}
