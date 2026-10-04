import { describe, expect, it } from "vitest";
import { registerSchema } from "./schema";

const valid = {
  fullName: "Ahmed Raza",
  email: "ahmed@example.pk",
  phone: "03001234567",
  role: "SELLER",
  password: "Str0ngPass",
  confirmPassword: "Str0ngPass",
};

describe("registerSchema", () => {
  it("accepts a normal seller signup", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("never lets a signup choose the ADMIN role", () => {
    expect(registerSchema.safeParse({ ...valid, role: "ADMIN" }).success).toBe(false);
  });

  it("rejects mismatched passwords", () => {
    expect(registerSchema.safeParse({ ...valid, confirmPassword: "Other1234" }).success).toBe(false);
  });
});
