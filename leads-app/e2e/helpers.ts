import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

const LOG = process.env.E2E_SERVER_LOG ?? "e2e/.server.log";

// Demo account created by scripts/demo-user.mjs (global setup).
export async function loginAsDemo(page: Page, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.fill("#l-email", "demo@leads.pk");
  await page.fill("#l-pw", "password1");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(next ? new RegExp(next.replace(/[?]/g, "\\?")) : /\/dashboard/);
}

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

// 8x8 PNG, enough for the photo uploader.
export const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWM4scABK2IYWhIAjS9qAbecnf4AAAAASUVORK5CYII=", "base64");
