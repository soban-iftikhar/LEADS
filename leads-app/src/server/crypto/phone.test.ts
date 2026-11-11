import { describe, expect, it } from "vitest";
import { decryptPhone, encryptPhone, hashPhone, normalizePhone } from "./phone";

// Same keys and vector as python-service/tests/test_crypto.py (pepper = bytes 0..31,
// key = bytes 32..63, iv = bytes 0..11). If these fail, the two services disagree.
const PEPPER = Buffer.from(Array.from({ length: 32 }, (_, i) => i)).toString("base64");
const KEY = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 32)).toString("base64");
const IV = Buffer.from(Array.from({ length: 12 }, (_, i) => i));
const VECTOR_PHONE = "03001234567";
const VECTOR_HASH = "3de51be832065790ba9a0a6d6c20829a68a0579ac5274cd04873e94be2c39a00";
const VECTOR_ENC = "AAECAwQFBgcICQoL9wTyRgsa1aFicdYk9CZb92xhbZd7B9jYic/+";

describe("phone crypto (shared vector with Python)", () => {
  it("hashes exactly like the Python service", () => {
    expect(hashPhone(VECTOR_PHONE, PEPPER)).toBe(VECTOR_HASH);
  });

  it("encrypts exactly like the Python service and decrypts back", () => {
    expect(encryptPhone(VECTOR_PHONE, KEY, IV)).toBe(VECTOR_ENC);
    expect(decryptPhone(VECTOR_ENC, KEY)).toBe(VECTOR_PHONE);
  });

  it("uses a fresh iv for every encryption", () => {
    expect(encryptPhone(VECTOR_PHONE, KEY)).not.toBe(encryptPhone(VECTOR_PHONE, KEY));
  });
});

describe("normalizePhone", () => {
  it.each([
    ["+923320644433", "03320644433"],
    ["923310774648", "03310774648"],
    ["0092 331 0774648", "03310774648"],
    ["0300-1234567", "03001234567"],
    ["3309000012", "03309000012"],
    ["03001234567", "03001234567"],
  ])("%s -> %s", (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it.each(["051-1234567", "0313-XXXXXXX", "", null, undefined])("rejects %s", (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });
});
