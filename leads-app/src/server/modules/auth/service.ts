import "server-only";
import crypto from "node:crypto";
import type { User } from "@prisma/client";
import { checkCode, consumeLinkToken, issueCode, issueLinkToken } from "@/server/auth/codes";
import type { IssuedTokens } from "@/server/auth/cookies";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, revokeAllSessions, revokeSession } from "@/server/auth/session";
import { checkTotp } from "@/server/auth/totp";
import { prisma } from "@/server/db";
import { deliveryIsLogged, env, isProduction } from "@/server/env";
import { hashIp } from "@/server/http/client-ip";
import { AppError, conflict } from "@/server/http/errors";
import { sendAccountLockedEmail, sendEmailCode, sendPasswordChangedEmail, sendPasswordResetEmail } from "@/server/integrations/email";
import { audit } from "@/server/modules/audit/service";
import { deliverSecret, notify } from "./delivery";
import type { RegisterInput } from "./schema";

const TERMS_VERSION = "2026-11";
const LOCK_AFTER = 10;
const LOCK_MS = 15 * 60_000;
const RESET_TTL_MS = 30 * 60_000;
const ADMIN_ONLY = "Admins sign in on the admin console.";

export type ClientCtx = { userAgent?: string | null; ip?: string };

// compared against when the email is unknown, so response time doesn't reveal which emails exist
let dummyHash: Promise<string> | undefined;
const dummy = () => (dummyHash ??= hashPassword(crypto.randomBytes(16).toString("hex")));

/** A random bcrypt hash nobody knows the input of: the account has no usable password. */
export const unusableHash = () => hashPassword(crypto.randomBytes(32).toString("base64"));

const firstName = (u: Pick<User, "fullName">) => u.fullName.split(" ")[0] || u.fullName;

const startSession = (user: User, remember: boolean, ctx: ClientCtx) => createSession(user, { remember, userAgent: ctx.userAgent, ipHash: hashIp(ctx.ip) });

// ---------------------------------------------------------------- signup and email

export async function register(input: RegisterInput, ctx: ClientCtx): Promise<{ userId: string; tokens: IssuedTokens }> {
  if (await prisma.user.findUnique({ where: { email: input.email } })) {
    throw conflict("This email already has an account.", { email: "This email already has an account. Log in?" });
  }
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
  return { userId: user.id, tokens: await startSession(user, false, ctx) };
}

export async function sendVerifyEmail(user: User, force = false): Promise<{ retryAfterSec: number }> {
  const { code, retryAfterSec } = await issueCode(user.id, "EMAIL_VERIFY", { channel: "EMAIL", force });
  await deliverSecret("Email code", user.email, code, () => sendEmailCode(user.email, firstName(user), code, env().OTP_EXPIRY_MINUTES));
  return { retryAfterSec };
}

export async function resendEmailCode(user: User) {
  if (user.emailVerifiedAt) throw conflict("Your email is already confirmed.");
  return sendVerifyEmail(user);
}

export async function verifyEmail(user: User, code: string) {
  if (!user.emailVerifiedAt) {
    await checkCode(user.id, ["EMAIL_VERIFY"], code);
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  }
  return { emailVerified: true as const };
}

// ---------------------------------------------------------------- login

/**
 * Email + password check shared by customer and admin sign-in. Constant time for unknown emails,
 * lockout after repeated failures, and suspended or deleted accounts look like a wrong password.
 */
async function authenticate(email: string, password: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await verifyPassword(password, await dummy());
    throw new AppError(401, "That email and password do not match.");
  }
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    throw new AppError(423, "Too many tries.", { lockedUntil: user.lockedUntil.toISOString() });
  }
  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk || user.status !== "ACTIVE") {
    if (user.status === "ACTIVE") await recordFailedLogin(user);
    throw new AppError(401, "That email and password do not match.");
  }
  return user;
}

const markLoggedIn = (userId: string) => prisma.user.update({ where: { id: userId }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });

export async function login(email: string, password: string, remember: boolean, ctx: ClientCtx) {
  const user = await authenticate(email, password);
  if (user.role === "ADMIN") throw new AppError(403, ADMIN_ONLY);
  await markLoggedIn(user.id);
  const tokens = await startSession(user, remember, ctx);
  // email not confirmed yet: still signed in (so the code screen works), and a fresh code goes out
  const requiresEmailVerification = !user.emailVerifiedAt;
  if (requiresEmailVerification) await sendVerifyEmail(user).catch(() => {});
  return { tokens, requiresEmailVerification };
}

async function recordFailedLogin(user: User): Promise<void> {
  const failed = user.failedLoginCount + 1;
  const locked = failed >= LOCK_AFTER ? new Date(Date.now() + LOCK_MS) : null;
  await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: locked ? 0 : failed, lockedUntil: locked } });
  if (!locked) return;
  const until = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", hour: "numeric", minute: "2-digit", hour12: true }).format(locked);
  notify("lock email", () => sendAccountLockedEmail(user.email, user.fullName, until));
  throw new AppError(423, "Too many tries.", { lockedUntil: locked.toISOString() });
}

export const logout = (sessionId: string) => revokeSession(sessionId, "logout");

// ---------------------------------------------------------------- admin sign-in (DR-38)

/** Step 1: password. The session it creates is unusable until step 2 (TOTP) passes. */
export async function adminLogin(email: string, password: string, ctx: ClientCtx): Promise<IssuedTokens> {
  const user = await authenticate(email, password);
  if (user.role !== "ADMIN" || !user.totpSecretEnc || !user.totpEnabledAt) {
    await audit(prisma, { actorId: user.id, action: "auth.admin_login_failed", entity: "user", entityId: user.id, ip: ctx.ip });
    throw new AppError(401, "That email and password do not match.");
  }
  // admin sessions are short and never survive the browser
  return startSession(user, false, ctx);
}

/** Step 2: the authenticator code. Unlocks the session for admin routes. */
export async function adminSecondFactor(user: User, sessionId: string, code: string, ctx: ClientCtx): Promise<void> {
  if (user.role !== "ADMIN" || !user.totpSecretEnc) throw new AppError(403, "You can't do that.");
  if (!(await checkTotp(user.id, user.totpSecretEnc, code))) {
    await audit(prisma, { actorId: user.id, action: "auth.admin_login_failed", entity: "user", entityId: user.id, ip: ctx.ip });
    throw new AppError(422, "That code didn't match.", { code: "That code didn't match." });
  }
  await prisma.$transaction([
    prisma.session.update({ where: { id: sessionId }, data: { twoFactorPassed: true, stepUpAt: new Date() } }),
    prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } }),
  ]);
  await audit(prisma, { actorId: user.id, action: "auth.admin_login", entity: "user", entityId: user.id, ip: ctx.ip });
}

// ---------------------------------------------------------------- passwords

export async function forgotPassword(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  // same answer whether or not the email exists
  if (!user || user.status !== "ACTIVE" || user.role === "ADMIN") return;
  const raw = await issueLinkToken(user.id, "PASSWORD_RESET", RESET_TTL_MS);
  const url = `${env().NEXT_PUBLIC_APP_URL}/reset-password?token=${raw}`;
  if (deliveryIsLogged()) {
    console.info(`[auth] Reset email to ${user.email} not sent (AUTH_DELIVERY=log). The link is: ${url}`);
    return;
  }
  await sendPasswordResetEmail(user.email, firstName(user), url, RESET_TTL_MS / 60_000).catch((e) => {
    if (!isProduction()) console.warn(`[auth] Reset email failed (${String(e).slice(0, 200)}). Development fallback, the link is: ${url}`);
    else console.error("[auth] reset email failed:", String(e).slice(0, 300));
  });
}

export async function resetPassword(raw: string, password: string): Promise<void> {
  const t = await consumeLinkToken(raw, "PASSWORD_RESET");
  const now = new Date();
  const current = await prisma.user.findUniqueOrThrow({ where: { id: t.userId } });
  const user = await prisma.user.update({
    where: { id: t.userId },
    // following the emailed link also proves the inbox
    data: { passwordHash: await hashPassword(password), passwordChangedAt: now, failedLoginCount: 0, lockedUntil: null, emailVerifiedAt: current.emailVerifiedAt ?? now },
  });
  await revokeAllSessions(user.id, "password_reset");
  notify("password changed email", () => sendPasswordChangedEmail(user.email, user.fullName));
}

export async function changePassword(user: User, sessionId: string, current: string, next: string): Promise<void> {
  if (!(await verifyPassword(current, user.passwordHash))) {
    throw new AppError(422, "Your current password is wrong.", { currentPassword: "That isn't your current password. Signed up with Google? Use “Forgot password?” to set one." });
  }
  const changedAt = new Date();
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next), passwordChangedAt: changedAt } }),
    // keep this device signed in: sessions created before passwordChangedAt are dead, so re-stamp it
    prisma.session.update({ where: { id: sessionId }, data: { createdAt: new Date(changedAt.getTime() + 1) } }),
  ]);
  await revokeAllSessions(user.id, "password_changed", sessionId);
  notify("password changed email", () => sendPasswordChangedEmail(user.email, user.fullName));
}

// ---------------------------------------------------------------- Google (DR-43)

export type GoogleProfile = { sub: string; email: string; name: string };

/** Existing link, or an existing account with the same (Google-verified) email, which gets linked. */
export async function findGoogleUser(p: GoogleProfile): Promise<User | null> {
  const link = await prisma.oAuthAccount.findUnique({ where: { provider_providerUserId: { provider: "google", providerUserId: p.sub } }, include: { user: true } });
  if (link) {
    await prisma.oAuthAccount.update({ where: { id: link.id }, data: { lastUsedAt: new Date(), email: p.email } });
    return link.user;
  }
  const byEmail = await prisma.user.findUnique({ where: { email: p.email } });
  if (!byEmail) return null;
  if (byEmail.role === "ADMIN") throw new AppError(403, ADMIN_ONLY);
  await prisma.$transaction([
    prisma.oAuthAccount.create({ data: { userId: byEmail.id, provider: "google", providerUserId: p.sub, email: p.email } }),
    prisma.user.update({ where: { id: byEmail.id }, data: { emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date() } }),
  ]);
  return byEmail;
}

export async function googleSignIn(user: User, ctx: ClientCtx): Promise<IssuedTokens> {
  if (user.status !== "ACTIVE") throw new AppError(401, "This account can't sign in.");
  if (user.role === "ADMIN") throw new AppError(403, ADMIN_ONLY);
  await markLoggedIn(user.id);
  return startSession(user, true, ctx);
}

export async function createGoogleUser(p: GoogleProfile, kind: "SELLER" | "AGENCY", agencyName: string | undefined, ctx: ClientCtx): Promise<IssuedTokens> {
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
  return startSession(user, true, ctx);
}
