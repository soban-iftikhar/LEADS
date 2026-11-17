import { describe, expect, it } from "vitest";
import { can, needsVerifiedEmail } from "./permissions";

describe("permissions", () => {
  it("customers manage their own listings, leads and orders, nothing administrative", () => {
    for (const role of ["CUSTOMER_SELLER", "CUSTOMER_AGENCY"] as const) {
      for (const p of ["listing:create", "listing:update:own", "lead:read:own", "order:create"] as const) expect(can(role, p)).toBe(true);
      for (const p of ["listing:review", "payment:confirm", "user:suspend", "user:read:any"] as const) expect(can(role, p)).toBe(false);
    }
  });

  it("admins administer but never act as a customer", () => {
    for (const p of ["listing:review", "payment:confirm", "user:suspend"] as const) expect(can("ADMIN", p)).toBe(true);
    for (const p of ["listing:create", "lead:read:own", "order:create"] as const) expect(can("ADMIN", p)).toBe(false);
  });

  it("buyers only save and ask", () => {
    expect(can("BUYER", "listing:save")).toBe(true);
    expect(can("BUYER", "listing:create")).toBe(false);
    expect(can("BUYER", "lead:read:own")).toBe(false);
  });

  it("account housekeeping works before the email is confirmed; business actions don't", () => {
    expect(needsVerifiedEmail("profile:update:own")).toBe(false);
    expect(needsVerifiedEmail("listing:create")).toBe(true);
  });
});
