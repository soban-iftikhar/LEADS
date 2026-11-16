import { expect, test } from "@playwright/test";
import { loginAsDemo, loginAsOwner } from "./helpers";

test("agency overview: packages, waiting calls, pipeline and listings", async ({ page }) => {
  await loginAsDemo(page);
  await expect(page.getByRole("heading", { level: 1, name: /^Good (morning|afternoon|evening), / })).toBeVisible();
  await expect(page.getByText("Across your 3 active packages")).toBeVisible();
  await expect(page.locator(".bkr")).toHaveCount(3);
  await expect(page.getByText("Waiting for your call")).toBeVisible();
  await expect(page.locator(".callc .cl")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "Follow-ups today" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your listings" })).toBeVisible();
  await page.getByRole("link", { name: /^Contacted: \d+$/ }).click();
  await expect(page).toHaveURL(/\/leads\?stage=contacted/);
});

test("waiting call row opens the lead", async ({ page }) => {
  await loginAsDemo(page);
  await page.locator(".callc .cl-a").first().click();
  await expect(page).toHaveURL(/\/leads\/[^/?]+$/);
  await expect(page.locator(".top2")).toContainText("Lead · ");
});

test("owner overview: one package timeline and the property card", async ({ page }) => {
  await loginAsOwner(page);
  await expect(page.getByText(/^Growth package · /).first()).toBeVisible();
  await expect(page.getByText(/^Day \d+ of 60$/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your property" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View listing" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your listings" })).toHaveCount(0);
});
