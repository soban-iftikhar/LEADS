import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { Redis } from "ioredis";
import sharp from "sharp";
import { codeAt } from "../src/server/auth/otp-math";

const LOG = process.env.E2E_SERVER_LOG ?? "e2e/.server.log";

// Demo accounts created by scripts/dev-seed.ts (global setup).
export async function loginAsDemo(page: Page, next?: string, email = "demo@leads.pk") {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.fill("#l-email", email);
  await page.fill("#l-pw", "password1");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(next ? new RegExp(next.replace(/[?]/g, "\\?")) : /\/dashboard/, { timeout: 30_000 });
  await page.waitForLoadState("networkidle"); // interactive before the test clicks anything
}

/** The demo agency's verified WhatsApp number as typed in the form (scripts/dev-seed.ts: fakePhone(1)). */
export const DEMO_PHONE = "399 0000001";

/** The owner demo account (one listing, one package). */
export const loginAsOwner = (page: Page, next?: string) => loginAsDemo(page, next, "owner@leads.pk");

/** Latest code the server logged for this recipient (AUTH_DELIVERY=log). */
export async function codeFor(recipient: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const lines = readFileSync(LOG, "utf8").split("\n").filter((l) => l.includes(`to ${recipient} `) && l.includes("The code is:"));
    const m = lines.at(-1)?.match(/The code is: (\d{6})/);
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No code logged for ${recipient}`);
}

export async function typeCode(page: Page, code: string) {
  await page.locator(".ob").first().focus();
  await page.keyboard.type(code);
}

// A plain 800×600 photo: above the uploader's 400×400 minimum.
export const photo = (): Promise<Buffer> => sharp({ create: { width: 800, height: 600, channels: 3, background: "#8aa39b" } }).png().toBuffer();

// The dev admin from prisma/seed/admin/team.json (npm run db:seed:admin).
const ADMIN = { email: "admin@leads.pk", password: "password1", totpSecret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP" };

/** Signs in on /admin/login with the password and a fresh authenticator code. */
export async function loginAsAdmin(page: Page, next = "/admin") {
  // a code is accepted once per 30 s step; forget the last one so back-to-back tests can sign in
  const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: 2 });
  const keys = await redis.keys("totp:last:*");
  if (keys.length) await redis.del(...keys);
  await redis.quit();
  await page.goto(`/admin/login?next=${encodeURIComponent(next)}`);
  await page.fill("#a-email", ADMIN.email);
  await page.fill("#a-pw", ADMIN.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.fill("#a-code", codeAt(ADMIN.totpSecret, Math.floor(Date.now() / 30_000)));
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(next.replace(/[?]/g, "\\?") + "$"), { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
}
