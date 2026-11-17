import "server-only";
import type { User } from "@prisma/client";
import { checkCode, issueCode, liveToken } from "@/server/auth/codes";
import { phoneHashOf, protectPhone, revealPhone, sealPhone } from "@/server/crypto/phone";
import { prisma } from "@/server/db";
import { AppError, conflict, isUniqueViolation } from "@/server/http/errors";
import { sendWhatsAppCode } from "@/server/modules/messaging/whatsapp/client";
import { formatPhone, maskPhone, toE164 } from "@/lib/format";
import { deliverSecret } from "./delivery";

/**
 * The customer's WhatsApp number (DR-42): added and verified inside the app with a WhatsApp code.
 * The number waiting for its code is kept encrypted on the code row, never in plain text.
 */

export async function startPhone(user: User, localPhone: string) {
  const hash = phoneHashOf(localPhone);
  if (user.phoneHash === hash && user.phoneVerifiedAt) throw conflict("This number is already verified on your account.", { phone: "This number is already verified on your account." });
  const owner = await prisma.user.findUnique({ where: { phoneHash: hash }, select: { id: true } });
  if (owner && owner.id !== user.id) throw conflict("This number is already on another account.", { phone: "This number is already on another LEADS account. One number, one account." });
  const type = user.phoneVerifiedAt ? "PHONE_CHANGE" : "PHONE_OTP";
  const { code, retryAfterSec } = await issueCode(user.id, type, { channel: "WHATSAPP", pendingEnc: sealPhone(localPhone), force: true });
  await deliverSecret("WhatsApp code", maskPhone(localPhone), code, () => sendWhatsAppCode(localPhone, code));
  return { phoneMasked: maskPhone(localPhone), retryAfterSec };
}

async function pendingToken(userId: string) {
  return (await liveToken(userId, "PHONE_CHANGE")) ?? (await liveToken(userId, "PHONE_OTP"));
}

export async function resendPhoneCode(user: User) {
  const t = await pendingToken(user.id);
  const local = revealPhone(t?.pendingEnc);
  if (!t || !local) throw new AppError(410, "Enter your number again.");
  const { code, retryAfterSec } = await issueCode(user.id, t.type, { channel: "WHATSAPP" });
  await deliverSecret("WhatsApp code", maskPhone(local), code, () => sendWhatsAppCode(local, code));
  return { retryAfterSec };
}

/** The number waiting for its code ("+92 300 1234567"), shown on the code screen, or null. */
export async function pendingPhone(userId: string): Promise<string | null> {
  const t = await pendingToken(userId);
  if (!t || t.expiresAt.getTime() <= Date.now()) return null;
  const local = revealPhone(t.pendingEnc);
  return local ? formatPhone(toE164(local)) : null;
}

export async function verifyPhone(user: User, otp: string) {
  const t = await checkCode(user.id, ["PHONE_OTP", "PHONE_CHANGE"], otp);
  const local = revealPhone(t.pendingEnc);
  if (!local) throw new AppError(410, "Enter your number again.");
  const { phoneHash, phoneEnc } = protectPhone(local);
  try {
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { phoneHash, phoneEnc, phoneVerifiedAt: new Date() } }),
      // a number we know from a portal ad now belongs to a customer: never auto-purge it
      prisma.contact.updateMany({ where: { phoneHash }, data: { purgeAt: null } }),
    ]);
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("This number is already on another account.", { otp: "This number was just verified on another account." });
    throw e;
  }
  return { phoneVerified: true as const };
}
