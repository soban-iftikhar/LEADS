import "server-only";
import crypto from "crypto";
import type { Prisma, User } from "@prisma/client";
import { checkCode, issueCode, issueLinkToken, liveToken, consumeLinkToken } from "@/server/auth/codes";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, revokeAllSessions, revokeSession } from "@/server/auth/sessions";
import { decryptPhone, encryptPhone, hashPhone } from "@/server/crypto/phone";
import { prisma } from "@/server/db";
import { env } from "@/server/env";
import { AppError, conflict } from "@/server/http/errors";
import { sendAccountLockedEmail, sendEmailCode, sendPasswordChangedEmail, sendPasswordResetEmail } from "@/server/integrations/email";
import { sendWhatsAppCode, WhatsAppSendError } from "@/server/modules/messaging/whatsapp/client";
import type { Me, NotificationSettings } from "@/types/api";
import type { RegisterInput } from "./schema";

const TERMS_VERSION = "2026-11";
const LOCK_AFTER = 10; // contract: 423 after 10 failures
const LOCK_MS = 15 * 60_000;
const RESET_TTL_MS = 30 * 60_000;
// compared against when the email is unknown, so response time doesn't reveal which emails exist
let dummyHash: Promise<string> | undefined;
const dummy = () => (dummyHash ??= hashPassword(crypto.randomBytes(16).toString("hex")));

export const DEFAULT_PREFS: NotificationSettings = { newLeadWhatsapp: true, dailySummary: true, listingUpdates: true, emailCopies: false, packageEnding: true };

type Ctx = { userAgent?: string | null; ip?: string };
type UserWithProfile = User & { customer: { kind: "SELLER" | "AGENCY"; displayName: string; contactPerson: string | null; notificationPrefs: Prisma.JsonValue } | null };

function keys() {
  const { PHONE_HASH_PEPPER, PHONE_ENC_KEY } = env();
  if (!PHONE_HASH_PEPPER || !PHONE_ENC_KEY) throw new Error("PHONE_HASH_PEPPER and PHONE_ENC_KEY must be set");
  return { pepper: PHONE_HASH_PEPPER, key: PHONE_ENC_KEY };
}

const ipHash = (ip?: string) => (ip ? crypto.createHash("sha256").update(`${env().OTP_PEPPER}:${ip}`).digest("hex").slice(0, 32) : null);

/** A random bcrypt hash nobody knows the input of: the account has no usable password. */
async function unusableHash() {
  return hashPassword(crypto.randomBytes(32).toString("base64"));
}

/**
 * Sends a code. If the provider fails: in development the code is printed to the server log so
 * the flow can still be tested; in production the person sees a "couldn't send" error.
 */
async function deliver(what: string, to: string, code: string, fn: () => Promise<unknown>) {
  if (env().AUTH_DELIVERY === "log" && process.env.NODE_ENV !== "production") {
    console.info(`[auth] ${what} to ${to} not sent (AUTH_DELIVERY=log). The code is: ${code}`);
    return;
  }
  try {
    await fn();
  } catch (e) {
    const detail = e instanceof WhatsAppSendError ? `${e.message} ${e.detail ?? ""}` : String(e);
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[auth] ${what} to ${to} failed (${detail.slice(0, 300)}). Development fallback, the code is: ${code}`);
      return;
    }
    console.error(`[auth] ${what} failed:`, detail);
    throw new AppError(502, `We couldn't send the code right now. Try again in a minute.`);
  }
}

/** Notices (password changed, login paused): best effort, never block the request, silent in log mode. */
function quiet(fn: () => Promise<unknown>): Promise<unknown> {
  if (env().AUTH_DELIVERY === "log" && process.env.NODE_ENV !== "production") return Promise.resolve();
  return fn();
}

function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\s-]/gu, " ").trim().split(/[\s-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase() || "?";
}

export function maskPhone(local: string): string {
  const d = local.replace(/\D/g, "").replace(/^0/, "");
  return `+92 ${d.slice(0, 3)} •••${d.slice(-4)}`;
}

export function displayPhone(local: string): string {
  const d = local.replace(/\D/g, "").replace(/^0/, "");
  return `+92 ${d.slice(0, 3)} ${d.slice(3)}`;
}

function phoneOf(u: User): string | null {
  if (!u.phoneEnc) return null;
  try {
    return decryptPhone(u.phoneEnc, keys().key);
  } catch {
    return null;
  }
}

export async function userWithProfile(id: string): Promise<UserWithProfile | null> {
  return prisma.user.findUnique({ where: { id }, include: { customer: true } }) as Promise<UserWithProfile | null>;
}

/** The contract's Me shape; counts come from the modules that own them. */
export function toMe(u: UserWithProfile, counts: Me["counts"]): Me {
  if (!u.customer || (u.role !== "CUSTOMER_SELLER" && u.role !== "CUSTOMER_AGENCY")) throw new AppError(403, "This account can't use the customer app.");
  const phone = phoneOf(u);
  return {
    user: {
      id: u.id,
      email: u.email,
      role: u.role,
      phoneMasked: phone ? maskPhone(phone) : null,
      emailVerified: !!u.emailVerifiedAt,
      phoneVerified: !!u.phoneVerifiedAt,
    },
    customer: { kind: u.customer.kind, displayName: u.customer.displayName, contactPerson: u.customer.contactPerson, initials: initials(u.customer.displayName) },
    counts,
  };
}

// ---------------------------------------------------------------- signup and email

export async function register(input: RegisterInput, ctx: Ctx) {
  const exists = await prisma.user.findUnique({ where: { email: input.email } });
  if (exists) throw conflict("This email already has an account.", { email: "This email already has an account. Log in?" });
  const agency = input.kind === "AGENCY";
  const user = await prisma.user.create({
    data: {
      email: input.email,
      fullName: agency ? (input.contactPerson as string) : input.displayName,
      passwordHash: await hashPassword(input.password),
      role: agency ? "CUSTOMER_AGENCY" : "CUSTOMER_SELLER",
      termsAcceptedAt: new Date(),
      termsVersion: TERMS_VERSION,
      customer: { create: { kind: input.kind, displayName: input.displayName, contactPerson: agency ? input.contactPerson : null, areas: [], propertyTypes: [] } },
    },
  });
  await sendVerifyEmail(user, true);
  const session = await createSession(user.id, { remember: false, userAgent: ctx.userAgent, ipHash: ipHash(ctx.ip) });
  return { userId: user.id, session };
}

async function sendVerifyEmail(user: User, force = false) {
  const { code, retryAfterSec } = await issueCode(user.id, "EMAIL_VERIFY", { channel: "EMAIL", force });
  await deliver("Email code", user.email, code, () => sendEmailCode(user.email, user.fullName.split(" ")[0] ?? user.fullName, code, env().OTP_EXPIRY_MINUTES));
  return { retryAfterSec };
}

export async function resendEmailCode(user: User) {
  if (user.emailVerifiedAt) throw conflict("Your email is already confirmed.");
  return sendVerifyEmail(user);
}

export async function verifyEmail(user: User, code: string) {
  if (user.emailVerifiedAt) return { emailVerified: true as const };
  await checkCode(user.id, ["EMAIL_VERIFY"], code);
  await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  return { emailVerified: true as const };
}

// ---------------------------------------------------------------- login

export async function login(email: string, password: string, remember: boolean, ctx: Ctx) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await verifyPassword(password, await dummy());
    throw new AppError(401, "That email and password do not match.");
  }
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    throw new AppError(423, "Too many tries.", { lockedUntil: user.lockedUntil.toISOString() });
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok || user.status !== "ACTIVE") {
    if (user.status === "ACTIVE") {
      const failed = user.failedLoginCount + 1;
      const locked = failed >= LOCK_AFTER ? new Date(Date.now() + LOCK_MS) : null;
      await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: locked ? 0 : failed, lockedUntil: locked } });
      if (locked) {
        const until = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", hour: "numeric", minute: "2-digit", hour12: true }).format(locked);
        quiet(() => sendAccountLockedEmail(user.email, user.fullName, until)).catch((e) => console.error("[auth] lock email failed:", String(e)));
        throw new AppError(423, "Too many tries.", { lockedUntil: locked.toISOString() });
      }
    }
    throw new AppError(401, "That email and password do not match.");
  }
  if (user.role === "ADMIN") throw new AppError(403, "Admins sign in on the admin console.");
  await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
  const session = await createSession(user.id, { remember, userAgent: ctx.userAgent, ipHash: ipHash(ctx.ip) });
  // email not confirmed yet: still signed in (so the code screen works), and a fresh code goes out
  if (!user.emailVerifiedAt) {
    await sendVerifyEmail(user).catch(() => {});
    return { user, session, requiresEmailVerification: true };
  }
  return { user, session, requiresEmailVerification: false };
}

export async function logout(sessionId: string) {
  await revokeSession(sessionId, "logout");
}

// ---------------------------------------------------------------- passwords

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  // same answer whether or not the email exists
  if (!user || user.status !== "ACTIVE" || user.role === "ADMIN") return;
  const raw = await issueLinkToken(user.id, "PASSWORD_RESET", RESET_TTL_MS);
  const url = `${env().NEXT_PUBLIC_APP_URL}/reset-password?token=${raw}`;
  if (env().AUTH_DELIVERY === "log" && process.env.NODE_ENV !== "production") {
    console.info(`[auth] Reset email to ${user.email} not sent (AUTH_DELIVERY=log). The link is: ${url}`);
    return;
  }
  await sendPasswordResetEmail(user.email, user.fullName.split(" ")[0] ?? user.fullName, url, RESET_TTL_MS / 60_000).catch((e) => {
    if (process.env.NODE_ENV !== "production") console.warn(`[auth] Reset email failed (${String(e).slice(0, 200)}). Development fallback, the link is: ${url}`);
    else console.error("[auth] reset email failed:", String(e));
  });
}

export async function resetPassword(raw: string, password: string) {
  const t = await consumeLinkToken(raw, "PASSWORD_RESET");
  const user = await prisma.user.update({
    where: { id: t.userId },
    // following the emailed link also proves the inbox
    data: { passwordHash: await hashPassword(password), passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null, emailVerifiedAt: undefined },
  });
  if (!user.emailVerifiedAt) await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  await revokeAllSessions(user.id, "password_reset");
  quiet(() => sendPasswordChangedEmail(user.email, user.fullName)).catch(() => {});
}

export async function changePassword(user: User, sessionId: string, current: string, next: string) {
  if (!(await verifyPassword(current, user.passwordHash))) {
    throw new AppError(422, "Your current password is wrong.", { currentPassword: "That isn't your current password. Signed up with Google? Use “Forgot password?” to set one." });
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next), passwordChangedAt: new Date(Date.now() - 1000) } });
  // keep this device signed in: its session row predates passwordChangedAt, so re-stamp it
  await prisma.session.update({ where: { id: sessionId }, data: { createdAt: new Date() } });
  await revokeAllSessions(user.id, "password_changed", sessionId);
  quiet(() => sendPasswordChangedEmail(user.email, user.fullName)).catch(() => {});
}

// ---------------------------------------------------------------- WhatsApp number

export async function startPhone(user: User, localPhone: string) {
  const { pepper, key } = keys();
  const hash = hashPhone(localPhone, pepper);
  if (user.phoneHash === hash && user.phoneVerifiedAt) throw conflict("This number is already verified on your account.", { phone: "This number is already verified on your account." });
  const owner = await prisma.user.findUnique({ where: { phoneHash: hash } });
  if (owner && owner.id !== user.id) throw conflict("This number is already on another account.", { phone: "This number is already on another LEADS account. One number, one account." });
  const type = user.phoneVerifiedAt ? "PHONE_CHANGE" : "PHONE_OTP";
  const { code, retryAfterSec } = await issueCode(user.id, type, { channel: "WHATSAPP", pendingEnc: encryptPhone(localPhone, key), force: true });
  await deliver("WhatsApp code", maskPhone(localPhone), code, () => sendWhatsAppCode(localPhone, code));
  return { phoneMasked: maskPhone(localPhone), retryAfterSec };
}

export async function resendPhoneCode(user: User) {
  const t = (await liveToken(user.id, "PHONE_CHANGE")) ?? (await liveToken(user.id, "PHONE_OTP"));
  if (!t?.pendingEnc) throw new AppError(410, "Enter your number again.");
  const local = decryptPhone(t.pendingEnc, keys().key);
  const { code, retryAfterSec } = await issueCode(user.id, t.type, { channel: "WHATSAPP" });
  await deliver("WhatsApp code", maskPhone(local), code, () => sendWhatsAppCode(local, code));
  return { retryAfterSec };
}

/** The number waiting for its code, shown on the code screen. */
export async function pendingPhone(user: User): Promise<string | null> {
  const t = (await liveToken(user.id, "PHONE_CHANGE")) ?? (await liveToken(user.id, "PHONE_OTP"));
  if (!t?.pendingEnc || t.expiresAt.getTime() <= Date.now()) return null;
  return displayPhone(decryptPhone(t.pendingEnc, keys().key));
}

export async function verifyPhone(user: User, otp: string) {
  const t = await checkCode(user.id, ["PHONE_OTP", "PHONE_CHANGE"], otp);
  if (!t.pendingEnc) throw new AppError(410, "Enter your number again.");
  const { pepper, key } = keys();
  const local = decryptPhone(t.pendingEnc, key);
  const hash = hashPhone(local, pepper);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { phoneHash: hash, phoneEnc: encryptPhone(local, key), phoneVerifiedAt: new Date() } });
      // if we already know this number (e.g. from a portal ad), it now belongs to a customer: never auto-purge it
      await tx.contact.updateMany({ where: { phoneHash: hash }, data: { purgeAt: null } });
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw conflict("This number is already on another account.", { otp: "This number was just verified on another account." });
    throw e;
  }
  return { phoneVerified: true as const };
}

// ---------------------------------------------------------------- profile

export async function updateProfile(user: UserWithProfile, patch: { displayName?: string; contactPerson?: string; email?: string }) {
  const agency = user.customer?.kind === "AGENCY";
  if (patch.email && patch.email !== user.email) {
    const taken = await prisma.user.findUnique({ where: { email: patch.email } });
    if (taken) throw conflict("This email already has an account.", { email: "This email already has an account." });
  }
  const emailChanged = !!patch.email && patch.email !== user.email;
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(emailChanged ? { email: patch.email, emailVerifiedAt: null } : {}),
      ...(agency && patch.contactPerson ? { fullName: patch.contactPerson } : {}),
      ...(!agency && patch.displayName ? { fullName: patch.displayName } : {}),
      customer: { update: { ...(patch.displayName ? { displayName: patch.displayName } : {}), ...(agency && patch.contactPerson ? { contactPerson: patch.contactPerson } : {}) } },
    },
  });
  if (emailChanged) await sendVerifyEmail(updated, true);
  return { emailChanged };
}

export function prefsOf(u: UserWithProfile): NotificationSettings {
  const stored = (u.customer?.notificationPrefs ?? {}) as Partial<NotificationSettings>;
  return { ...DEFAULT_PREFS, ...stored };
}

export async function setPrefs(u: UserWithProfile, patch: Partial<NotificationSettings>) {
  const next = { ...prefsOf(u), ...patch };
  await prisma.customerProfile.update({ where: { userId: u.id }, data: { notificationPrefs: next } });
  return next;
}

/** SPEC_02 5.10: anonymise, revoke every session, archive listings. Orders and leads stay. */
export async function deleteAccount(user: User, password: string, hasActivePackage: boolean) {
  if (!(await verifyPassword(password, user.passwordHash))) throw new AppError(422, "That password is wrong.", { password: "That password is wrong." });
  if (hasActivePackage) throw conflict("You have an active package.");
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        status: "DELETED",
        deletedAt: new Date(),
        email: `deleted+${user.id}@invalid.leads`,
        fullName: "Deleted user",
        phoneHash: null,
        phoneEnc: null,
        phoneVerifiedAt: null,
        passwordHash: await unusableHash(),
        totpSecretEnc: null,
      },
    }),
    prisma.oAuthAccount.deleteMany({ where: { userId: user.id } }),
    prisma.listing.updateMany({ where: { customerId: user.id }, data: { status: "ARCHIVED" } }),
  ]);
  await revokeAllSessions(user.id, "deleted");
}

// ---------------------------------------------------------------- Google (DR-43)

export type GoogleProfile = { sub: string; email: string; name: string };

/** Existing link, or an existing account with the same (Google-verified) email. */
export async function findGoogleUser(p: GoogleProfile) {
  const link = await prisma.oAuthAccount.findUnique({ where: { provider_providerUserId: { provider: "google", providerUserId: p.sub } }, include: { user: true } });
  if (link) {
    await prisma.oAuthAccount.update({ where: { id: link.id }, data: { lastUsedAt: new Date(), email: p.email } });
    return link.user;
  }
  const byEmail = await prisma.user.findUnique({ where: { email: p.email } });
  if (!byEmail) return null;
  if (byEmail.role === "ADMIN") throw new AppError(403, "Admins sign in on the admin console.");
  await prisma.oAuthAccount.create({ data: { userId: byEmail.id, provider: "google", providerUserId: p.sub, email: p.email } });
  if (!byEmail.emailVerifiedAt) await prisma.user.update({ where: { id: byEmail.id }, data: { emailVerifiedAt: new Date() } });
  return byEmail;
}

export async function googleSignIn(user: User, ctx: Ctx) {
  if (user.status !== "ACTIVE") throw new AppError(401, "This account can't sign in.");
  if (user.role === "ADMIN") throw new AppError(403, "Admins sign in on the admin console.");
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null } });
  return createSession(user.id, { remember: true, userAgent: ctx.userAgent, ipHash: ipHash(ctx.ip) });
}

export async function createGoogleUser(p: GoogleProfile, kind: "SELLER" | "AGENCY", agencyName: string | undefined, ctx: Ctx) {
  if (await prisma.user.findUnique({ where: { email: p.email } })) throw conflict("This email already has an account. Log in instead.");
  const agency = kind === "AGENCY";
  const user = await prisma.user.create({
    data: {
      email: p.email,
      fullName: p.name,
      passwordHash: await unusableHash(),
      role: agency ? "CUSTOMER_AGENCY" : "CUSTOMER_SELLER",
      emailVerifiedAt: new Date(),
      termsAcceptedAt: new Date(),
      termsVersion: TERMS_VERSION,
      customer: { create: { kind, displayName: agency ? (agencyName as string) : p.name, contactPerson: agency ? p.name : null, areas: [], propertyTypes: [] } },
      oauthAccounts: { create: { provider: "google", providerUserId: p.sub, email: p.email } },
    },
  });
  const session = await createSession(user.id, { remember: true, userAgent: ctx.userAgent, ipHash: ipHash(ctx.ip) });
  return { user, session };
}

