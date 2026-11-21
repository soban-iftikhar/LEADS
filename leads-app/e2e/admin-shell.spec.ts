import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("admin shell", () => {
  test("signs in with the code and lands on the overview", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Good (morning|afternoon|evening), Soban/);
    const rail = page.getByRole("complementary", { name: "Admin menu" });
    await expect(rail.getByRole("link", { name: "Overview", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".crumb small")).toHaveText("Dashboards");
  });

  test("the rail collapses and remembers it", async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole("button", { name: "Collapse menu" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-rail", "col");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-rail", "col");
    await page.getByRole("button", { name: "Expand menu" }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-rail", "col");
  });

  test("signed-out visitors go to the admin sign-in", async ({ page }) => {
    await page.goto("/admin/settings");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fsettings/);
  });

  test("customers are sent back to their dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#l-email", "demo@leads.pk");
    await page.fill("#l-pw", "password1");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL(/\/dashboard/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe("admin feedback", () => {
  test("log out asks first; Esc keeps you signed in, confirming ends the session", async ({ page }) => {
    await loginAsAdmin(page);
    await page.getByRole("button", { name: "Log out" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Log out?" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: "Log out" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
