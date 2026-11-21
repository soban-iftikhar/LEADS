import "server-only";
import crypto from "node:crypto";
import { env } from "@/server/env";
import { open, seal } from "./aead";

/**
 * Phone normalisation, hashing and encryption (SPEC_00 4.3).
 * Must match python-service/leads/crypto.py byte for byte: both services read and
 * write the same app.contacts rows. phone.test.ts checks the shared test vector.
 *
 *   phone_hash = HMAC-SHA256(PHONE_HASH_PEPPER, "03XXXXXXXXX"), hex
 *   phone_enc  = base64(iv | tag | ciphertext), AES-256-GCM, 12-byte random iv
 */

const MOBILE = /^03\d{9}$/;

/** A Pakistani mobile number as 03XXXXXXXXX, or null if the input is not one. */
export function normalizePhone(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  let digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("0092")) digits = digits.slice(4);
  else if (digits.startsWith("92") && digits.length === 12) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("3")) digits = "0" + digits;
  return MOBILE.test(digits) ? digits : null;
}

export function hashPhone(normalised: string, pepperB64: string): string {
  return crypto.createHmac("sha256", Buffer.from(pepperB64, "base64")).update(normalised).digest("hex");
}

export const encryptPhone = (normalised: string, keyB64: string, iv?: Buffer): string => seal(normalised, keyB64, iv);
export const decryptPhone = (token: string, keyB64: string): string => open(token, keyB64);

// ---------------------------------------------------------------- with the configured keys

function keys(): { pepper: string; key: string } {
  const { PHONE_HASH_PEPPER, PHONE_ENC_KEY } = env();
  if (!PHONE_HASH_PEPPER || !PHONE_ENC_KEY) throw new Error("PHONE_HASH_PEPPER and PHONE_ENC_KEY must be set");
  return { pepper: PHONE_HASH_PEPPER, key: PHONE_ENC_KEY };
}

/** Hash and ciphertext of a normalised number (03XXXXXXXXX), ready to store. */
export function protectPhone(normalised: string): { phoneHash: string; phoneEnc: string } {
  const { pepper, key } = keys();
  return { phoneHash: hashPhone(normalised, pepper), phoneEnc: encryptPhone(normalised, key) };
}

export const phoneHashOf = (normalised: string) => hashPhone(normalised, keys().pepper);
export const sealPhone = (normalised: string) => encryptPhone(normalised, keys().key);

/** The stored number, or null when there is none or it can't be decrypted (key rotated, purged). */
export function revealPhone(enc: string | null | undefined): string | null {
  if (!enc) return null;
  try {
    return decryptPhone(enc, keys().key);
  } catch {
    return null;
  }
}
