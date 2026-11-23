import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("admin dashboards", () => {
  test("overview follows city and period, and the collapsed sections open", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole("link", { name: /Leads delivered/ })).toBeVisible();
    await page.getByRole("group", { name: "Period" }).getByRole("button", { name: "This month" }).click();
    await expect(page).toHaveURL(/range=month/);
    await expect(page.getByRole("group", { name: "Period" }).getByRole("button", { name: "This month" })).toHaveAttribute("aria-pressed", "true");
    const needs = page.getByRole("button", { name: /Needs you/ });
    await expect(needs).toHaveAttribute("aria-expanded", "false");
    await needs.click();
    await expect(needs).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("link", { name: /Listings to review/ })).toBeVisible();
    await page.getByRole("button", { name: /More numbers/ }).click();
    await expect(page.getByRole("link", { name: /Properties found/ })).toBeVisible();
  });
});
