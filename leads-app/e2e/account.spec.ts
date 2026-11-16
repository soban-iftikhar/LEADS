import { expect, test } from "@playwright/test";
import { loginAsDemo, loginAsOwner } from "./helpers";

test("notifications: filter by type, open one and it is read", async ({ page }) => {
  await loginAsDemo(page, "/notifications");
  await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
  await page.getByRole("tab", { name: "Listings" }).click();
  await expect(page).toHaveURL(/type=listing/);
  await expect(page.locator(".nt").first()).toContainText(/Marla|Kanal/);
  await page.getByRole("tab", { name: "All" }).click();
  await expect(page).not.toHaveURL(/type=/);
  const first = page.locator(".nt.unread").first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page).toHaveURL(/\/leads\/[^/?]+$/);
});

test("settings: agency has Agency name, owner picks a city and it saves", async ({ page, browser }) => {
  await loginAsDemo(page, "/settings");
  await expect(page.getByLabel("Agency name")).toBeVisible();
  await expect(page.getByLabel("City")).toHaveCount(0);
  await expect(page.getByText("Can't be changed. Contact us if you need an owner account.")).toBeVisible();

  const owner = await browser.newPage();
  await loginAsOwner(owner, "/settings");
  const city = owner.getByLabel("City");
  await expect(city).toBeVisible();
  await expect(owner.getByLabel("Agency name")).toHaveCount(0);
  await city.selectOption({ label: "Rawalpindi" });
  await owner.getByRole("button", { name: "Save" }).click();
  await expect(owner.getByText("Saved.")).toBeVisible();
  await owner.reload({ waitUntil: "networkidle" });
  await expect(owner.getByLabel("City")).toHaveValue("rawalpindi");
  await owner.getByLabel("City").selectOption({ label: "Islamabad" });
  await owner.getByRole("button", { name: "Save" }).click();
  await expect(owner.getByText("Saved.")).toBeVisible();
  await owner.close();
});
