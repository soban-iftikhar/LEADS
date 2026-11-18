import { describe, expect, it } from "vitest";
import { codeAt } from "./totp";

// RFC 6238 appendix B, SHA-1 secret "12345678901234567890" (base32 below), last 6 of the 8 digits.
const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("TOTP", () => {
  it.each([
    [59, "287082"],
    [1111111109, "081804"],
    [1234567890, "005924"],
    [2000000000, "279037"],
  ])("time %i -> %s", (t, code) => {
    expect(codeAt(SECRET, Math.floor(t / 30))).toBe(code);
  });
});
