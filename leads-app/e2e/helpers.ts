import { expect, type Page } from "@playwright/test";

// Demo account from the mock store (src/mocks/store.ts).
export async function loginAsDemo(page: Page, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.fill("#l-email", "demo@leads.pk");
  await page.fill("#l-pw", "password1");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(next ? new RegExp(next.replace(/[?]/g, "\\?")) : /\/dashboard/);
}

// 8x8 PNG, enough for the photo uploader.
export const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWM4scABK2IYWhIAjS9qAbecnf4AAAAASUVORK5CYII=", "base64");
