import "server-only";
import crypto from "crypto";
import type { TokenType } from "@prisma/client";
import { prisma } from "@/server/db";
import { env } from "@/server/env";
import { AppError, tooMany } from "@/server/http/errors";

/**
 * Six-digit codes for email and WhatsApp (SPEC_02 4.3, 5.5). Stored as
 * HMAC-SHA256(OTP_PEPPER, type:user:code); a plain hash of 6 digits would be trivial to reverse.
 * One live code per user and type; 5 wrong tries burns it.
 */

export const RESEND_COOLDOWN_SEC = 30;

function pepper(): Buffer {
  const p = env().OTP_PEPPER;
  if (!p) throw new Error("OTP_PEPPER is not set");
  return Buffer.from(p, "base64");
}

export function codeHash(type: TokenType, userId: string, code: string): string {
  return crypto.createHmac("sha256", pepper()).update(`${type}:${userId}:${code}`).digest("hex");
}

export function newCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Issues a fresh code, replacing any earlier one of the same type. Throws 429 if the last one
 * went out less than 30 seconds ago (unless `force`, used right after signup).
 */
export async function issueCode(userId: string, type: TokenType, opts: { channel: "EMAIL" | "WHATSAPP"; pendingEnc?: string | null; force?: boolean }) {
  const last = await prisma.verificationToken.findFirst({ where: { userId, type, usedAt: null }, orderBy: { lastSentAt: "desc" } });
  if (last && !opts.force) {
    const wait = RESEND_COOLDOWN_SEC - Math.floor((Date.now() - last.lastSentAt.getTime()) / 1000);
    if (wait > 0) throw tooMany(wait, `Please wait ${wait} seconds before asking for a new code.`);
  }
  const code = newCode();
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { userId, type, usedAt: null } }),
    prisma.verificationToken.create({
      data: {
        userId,
        type,
        channel: opts.channel,
        tokenHash: codeHash(type, userId, code),
        expiresAt: new Date(Date.now() + env().OTP_EXPIRY_MINUTES * 60_000),
        pendingEnc: opts.pendingEnc ?? last?.pendingEnc ?? null,
      },
    }),
  ]);
  return { code, retryAfterSec: RESEND_COOLDOWN_SEC };
}

/** The live token of this type (to re-send to the same pending number), or null. */
export function liveToken(userId: string, type: TokenType) {
  return prisma.verificationToken.findFirst({ where: { userId, type, usedAt: null }, orderBy: { lastSentAt: "desc" } });
}

/** Checks a code. On success the token is used up and returned (with its pending value). */
export async function checkCode(userId: string, types: TokenType[], code: string) {
  const t = await prisma.verificationToken.findFirst({ where: { userId, type: { in: types }, usedAt: null }, orderBy: { lastSentAt: "desc" } });
  if (!t) throw new AppError(410, "That code has expired. Send a new one.");
  if (t.expiresAt.getTime() <= Date.now()) throw new AppError(410, "That code has expired. Send a new one.");
  const max = env().OTP_MAX_ATTEMPTS;
  if (t.attempts >= max) throw tooMany(RESEND_COOLDOWN_SEC, "Too many tries. Send a new code.");
  const expected = Buffer.from(t.tokenHash, "hex");
  const got = Buffer.from(codeHash(t.type, userId, code), "hex");
  if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) {
    const attempts = t.attempts + 1;
    await prisma.verificationToken.update({ where: { id: t.id }, data: { attempts } });
    if (attempts >= max) throw tooMany(RESEND_COOLDOWN_SEC, "Too many tries. Send a new code.");
    throw new AppError(422, "That code didn't match.", { code: "That code didn't match." });
  }
  await prisma.verificationToken.update({ where: { id: t.id }, data: { usedAt: new Date() } });
  return t;
}

/** Password-reset link token: 32 random bytes in the URL, SHA-256 in the database. */
export async function issueLinkToken(userId: string, type: TokenType, ttlMs: number) {
  const raw = crypto.randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { userId, type, usedAt: null } }),
    prisma.verificationToken.create({ data: { userId, type, channel: "EMAIL", tokenHash: crypto.createHash("sha256").update(raw).digest("hex"), expiresAt: new Date(Date.now() + ttlMs) } }),
  ]);
  return raw;
}

export async function consumeLinkToken(raw: string, type: TokenType) {
  const t = await prisma.verificationToken.findUnique({ where: { tokenHash: crypto.createHash("sha256").update(raw).digest("hex") } });
  if (!t || t.type !== type || t.usedAt || t.expiresAt.getTime() <= Date.now()) throw new AppError(410, "This link has expired.");
  await prisma.verificationToken.update({ where: { id: t.id }, data: { usedAt: new Date() } });
  return t;
}
