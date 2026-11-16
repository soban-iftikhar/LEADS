import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { insertUser, resetIdentity } from "./db";

// SPEC_02 section 4: constraints that live in the database, not only in code.

beforeEach(resetIdentity);
afterAll(() => prisma.$disconnect());

async function rejects(sql: string, ...params: unknown[]): Promise<string> {
  try {
    await prisma.$executeRawUnsafe(sql, ...params);
  } catch (e) {
    return String((e as Error).message);
  }
  throw new Error("expected the statement to be rejected");
}

describe("4.6 settings seed", () => {
  it("has the auth and listing defaults", async () => {
    const rows = await prisma.appSetting.findMany({
      where: { key: { in: ["auth.terms_version", "auth.session", "listings.max_active_per_seller"] } },
      orderBy: { key: "asc" },
    });
    expect(Object.fromEntries(rows.map((r) => [r.key, r.value]))).toEqual({
      "auth.session": { idle_days: 7, absolute_days: 30, admin_idle_hours: 12, admin_absolute_hours: 24 },
      "auth.terms_version": "2026-11",
      "listings.max_active_per_seller": null,
    });
  });
});

describe("4.1 users", () => {
  it("requires deleted_at exactly when status is DELETED", async () => {
    expect(await rejects(
      `INSERT INTO app.users (email, full_name, password_hash, role, status)
       VALUES ('a@test.leads', 'A', 'x', 'BUYER', 'DELETED')`)).toMatch(/users_deleted_check/);
    expect(await rejects(
      `INSERT INTO app.users (email, full_name, password_hash, role, status, deleted_at)
       VALUES ('b@test.leads', 'B', 'x', 'BUYER', 'ACTIVE', now())`)).toMatch(/users_deleted_check/);
    await insertUser({ role: "BUYER", status: "DELETED", deletedAt: new Date() });
  });

  it("requires full_name and keeps legacy_id unique", async () => {
    expect(await rejects(
      `INSERT INTO app.users (email, password_hash, role) VALUES ('c@test.leads', 'x', 'BUYER')`)).toMatch(/full_name/);
    await prisma.$executeRawUnsafe(
      `INSERT INTO app.users (email, full_name, password_hash, role, legacy_id) VALUES ('d@test.leads', 'D', 'x', 'BUYER', 'old-1')`);
    expect(await rejects(
      `INSERT INTO app.users (email, full_name, password_hash, role, legacy_id) VALUES ('e@test.leads', 'E', 'x', 'BUYER', 'old-1')`)).toMatch(/legacy_id/);
  });
});

describe("4.2 sessions", () => {
  const insertSession = (userId: string, extra = "", values = "") =>
    `INSERT INTO app.sessions (user_id, token_hash, expires_at, absolute_expires_at${extra})
     VALUES ('${userId}', md5(random()::text), now() + interval '7 days', now() + interval '30 days'${values})`;

  it("defaults: two_factor_passed false, last_seen_at set", async () => {
    const userId = await insertUser({ role: "ADMIN" });
    await prisma.$executeRawUnsafe(insertSession(userId));
    const s = await prisma.session.findFirstOrThrow({ where: { userId } });
    expect(s.twoFactorPassed).toBe(false);
    expect(s.lastSeenAt).toBeInstanceOf(Date);
    expect(s.stepUpAt).toBeNull();
  });

  it("accepts only known revocation reasons, always with revoked_at", async () => {
    const userId = await insertUser({ role: "BUYER" });
    expect(await rejects(insertSession(userId, ", revoked_at, revoked_reason", ", now(), 'because'")))
      .toMatch(/sessions_revoked_reason_check/);
    expect(await rejects(insertSession(userId, ", revoked_reason", ", 'logout'")))
      .toMatch(/sessions_revoked_pair_check/);
    await prisma.$executeRawUnsafe(insertSession(userId, ", revoked_at, revoked_reason", ", now(), 'logout_all'"));
  });

  it("never lets the idle expiry pass the absolute cap", async () => {
    const userId = await insertUser({ role: "BUYER" });
    expect(await rejects(
      `INSERT INTO app.sessions (user_id, token_hash, expires_at, absolute_expires_at)
       VALUES ('${userId}', 'h1', now() + interval '31 days', now() + interval '30 days')`)).toMatch(/sessions_expiry_check/);
  });
});

describe("4.3 verification tokens", () => {
  it("accepts PHONE_CHANGE and the two channels only", async () => {
    const userId = await insertUser({ role: "BUYER" });
    await prisma.verificationToken.create({
      data: { userId, type: "PHONE_CHANGE", tokenHash: "t1", expiresAt: new Date(Date.now() + 600_000), channel: "WHATSAPP" },
    });
    expect(await rejects(
      `INSERT INTO app.verification_tokens (user_id, type, token_hash, expires_at, channel)
       VALUES ('${userId}', 'EMAIL_VERIFY', 't2', now(), 'SMS')`)).toMatch(/verification_tokens_channel_check/);
    const t = await prisma.verificationToken.findFirstOrThrow({ where: { tokenHash: "t1" } });
    expect(t.lastSentAt).toBeInstanceOf(Date);
  });
});

describe("4.4 recovery codes", () => {
  it("are unique per user and go when the user goes", async () => {
    const userId = await insertUser({ role: "ADMIN" });
    await prisma.recoveryCode.create({ data: { userId, codeHash: "c1" } });
    expect(await rejects(
      `INSERT INTO app.recovery_codes (user_id, code_hash) VALUES ('${userId}', 'c1')`)).toMatch(/recovery_codes_user_id_code_hash_key/);
    await prisma.user.delete({ where: { id: userId } });
    expect(await prisma.recoveryCode.count()).toBe(0);
  });
});

describe("4.5 role and customer profile kind stay consistent", () => {
  const profile = (userId: string, kind: "SELLER" | "AGENCY") =>
    prisma.customerProfile.create({ data: { userId, kind, displayName: "X" } });

  it("accepts matching pairs", async () => {
    await profile(await insertUser({ role: "CUSTOMER_SELLER" }), "SELLER");
    await profile(await insertUser({ role: "CUSTOMER_AGENCY" }), "AGENCY");
  });

  it("rejects a profile kind that does not match the role", async () => {
    const seller = await insertUser({ role: "CUSTOMER_SELLER" });
    await expect(profile(seller, "AGENCY")).rejects.toThrow(/does not match/);
    const buyer = await insertUser({ role: "BUYER" });
    await expect(profile(buyer, "SELLER")).rejects.toThrow(/does not match/);
  });

  it("rejects a role change that leaves the profile behind", async () => {
    const userId = await insertUser({ role: "CUSTOMER_SELLER" });
    await profile(userId, "SELLER");
    await expect(prisma.user.update({ where: { id: userId }, data: { role: "BUYER" } })).rejects.toThrow(/does not match/);
  });

  it("allows a role change and the profile switch in one transaction, in either order", async () => {
    const userId = await insertUser({ role: "CUSTOMER_SELLER" });
    await profile(userId, "SELLER");
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { role: "CUSTOMER_AGENCY" } });
      await tx.customerProfile.update({ where: { userId }, data: { kind: "AGENCY" } });
    });
    await prisma.$transaction(async (tx) => {
      await tx.customerProfile.update({ where: { userId }, data: { kind: "SELLER" } });
      await tx.user.update({ where: { id: userId }, data: { role: "CUSTOMER_SELLER" } });
    });
    expect((await prisma.customerProfile.findUniqueOrThrow({ where: { userId } })).kind).toBe("SELLER");
  });
});
