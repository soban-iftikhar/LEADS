import "server-only";
import crypto from "crypto";

/**
 * Phone normalisation, hashing and encryption (SPEC_00 4.3).
 * Must match python-service/leads/crypto.py byte for byte: both services read and
 * write the same app.contacts rows. phone.test.ts checks the shared test vector.
 *
 *   phone_hash = HMAC-SHA256(PHONE_HASH_PEPPER, "03XXXXXXXXX"), hex
 *   phone_enc  = base64(iv | tag | ciphertext), AES-256-GCM, 12-byte random iv
 */

const IV_LEN = 12;
const TAG_LEN = 16;
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

export function encryptPhone(normalised: string, keyB64: string, iv: Buffer = crypto.randomBytes(IV_LEN)): string {
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(keyB64, "base64"), iv);
  const ciphertext = Buffer.concat([cipher.update(normalised, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

export function decryptPhone(token: string, keyB64: string): string {
  const blob = Buffer.from(token, "base64");
  const iv = blob.subarray(0, IV_LEN);
  const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(keyB64, "base64"), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(blob.subarray(IV_LEN + TAG_LEN)), decipher.final()]).toString("utf8");
}
