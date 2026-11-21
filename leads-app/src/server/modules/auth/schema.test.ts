import { describe, expect, it } from "vitest";
import { loginSchema, phone, registerSchema } from "./schema";

const base = { kind: "SELLER", displayName: "Soban Iftikhar", email: "Soban@Example.com ", password: "secret123", acceptTerms: true };

describe("registerSchema", () => {
  it("accepts an owner and lowercases the email", () => {
    const r = registerSchema.parse(base);
    expect(r.email).toBe("soban@example.com");
  });

  it("never accepts ADMIN or BUYER as a kind", () => {
    expect(registerSchema.safeParse({ ...base, kind: "ADMIN" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, kind: "BUYER" }).success).toBe(false);
  });

  it("needs the contact person for an agency", () => {
    const r = registerSchema.safeParse({ ...base, kind: "AGENCY", displayName: "Al-Noor Estate" });
    expect(r.success).toBe(false);
    expect(registerSchema.safeParse({ ...base, kind: "AGENCY", displayName: "Al-Noor Estate", contactPerson: "Imran Qureshi" }).success).toBe(true);
  });

  it("wants 8+ characters with a number and the terms", () => {
    expect(registerSchema.safeParse({ ...base, password: "short1" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "longenough" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(false);
  });

  it("does not ask for a phone at signup", () => {
    expect(Object.keys(registerSchema.parse(base))).not.toContain("phone");
  });
});

describe("phone", () => {
  it.each(["03001234567", "3001234567", "+92 300 1234567", "0092-300-1234567"])("normalises %s", (v) => {
    expect(phone.parse(v)).toBe("03001234567");
  });
  it("rejects landlines and short numbers", () => {
    expect(phone.safeParse("0512345678").success).toBe(false);
    expect(phone.safeParse("300123").success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("defaults remember to true", () => {
    expect(loginSchema.parse({ email: "a@b.pk", password: "x" }).remember).toBe(true);
  });
});
