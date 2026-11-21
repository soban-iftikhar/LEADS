import crypto from "node:crypto";

/**
 * AES-256-GCM with a random 12-byte IV, stored as base64(iv | tag | ciphertext). The same layout
 * is used for phone numbers (shared with python-service/leads/crypto.py) and TOTP secrets.
 */
const IV_LEN = 12;
const TAG_LEN = 16;

export function seal(plain: string, keyB64: string, iv: Buffer = crypto.randomBytes(IV_LEN)): string {
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(keyB64, "base64"), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

export function open(token: string, keyB64: string): string {
  const blob = Buffer.from(token, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(keyB64, "base64"), blob.subarray(0, IV_LEN));
  decipher.setAuthTag(blob.subarray(IV_LEN, IV_LEN + TAG_LEN));
  return Buffer.concat([decipher.update(blob.subarray(IV_LEN + TAG_LEN)), decipher.final()]).toString("utf8");
}
