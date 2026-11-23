import "server-only";
import crypto from "node:crypto";
import { Redis } from "ioredis";
import { open, seal } from "@/server/crypto/aead";
import { env } from "@/server/env";
import { base32, codeAt, DIGITS, STEP_SEC } from "./otp-math";

/**
 * Time-based one-time passwords for admins (RFC 6238: HMAC-SHA1, 6 digits, 30 s, ±1 step).
 * Secrets are stored encrypted with TOTP_ENC_KEY. A code is accepted once: the last used time
 * step is kept in Redis, so a code seen over someone's shoulder can't be replayed.
 */

function key(): string {
  const k = env().TOTP_ENC_KEY;
  if (!k) throw new Error("TOTP_ENC_KEY is not set");
  return k;
}

/** A new secret: the encrypted value to store and the otpauth:// URI for the authenticator app. */
export function newTotpSecret(accountEmail: string): { secretEnc: string; uri: string; secret: string } {
  const secret = base32(crypto.randomBytes(20));
  const uri = `otpauth://totp/LEADS:${encodeURIComponent(accountEmail)}?secret=${secret}&issuer=LEADS&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SEC}`;
  return { secretEnc: seal(secret, key()), uri, secret };
}

let redis: Redis | undefined;

/** True when `code` is valid now and was not used before. */
export async function checkTotp(userId: string, secretEnc: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  const secret = open(secretEnc, key());
  const now = Math.floor(Date.now() / 1000 / STEP_SEC);
  const step = [now - 1, now, now + 1].find((s) => {
    const want = Buffer.from(codeAt(secret, s));
    return crypto.timingSafeEqual(want, Buffer.from(code));
  });
  if (step === undefined) return false;
  redis ??= new Redis(env().REDIS_URL, { maxRetriesPerRequest: 2 });
  const k = `totp:last:${userId}`;
  const last = Number((await redis.get(k)) ?? -1);
  if (step <= last) return false;
  await redis.set(k, String(step), "EX", STEP_SEC * 4);
  return true;
}
