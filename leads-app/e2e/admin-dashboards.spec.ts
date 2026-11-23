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

  test("market: filters in the URL, area picker, and the area drawer", async ({ page }) => {
    await loginAsAdmin(page, "/admin/market");
    await expect(page.getByRole("heading", { name: "Hot areas" })).toBeVisible();
    await page.getByRole("group", { name: "Type" }).getByRole("button", { name: "Plots" }).click();
    await expect(page).toHaveURL(/type=plot/);
    await page.getByRole("group", { name: "Show" }).getByRole("button", { name: "Price change %" }).click();
    await expect(page).toHaveURL(/mode=change/);
    await page.getByRole("button", { name: /^Areas/ }).click();
    const picker = page.getByRole("dialog", { name: "Pick areas" });
    await picker.getByRole("button", { name: "Clear" }).click();
    await picker.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText("Pick at least one area")).toBeVisible();
    await page.locator(".hz").first().click();
    const drawer = page.getByRole("dialog").filter({ has: page.getByText("Buyers per home") });
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(page).not.toHaveURL(/area=/);
  });
});
