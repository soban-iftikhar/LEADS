import { expect, test } from "@playwright/test";
import { loginAsDemo, PNG } from "./helpers";

test("create a listing, fill it and submit it for review", async ({ page }) => {
  await loginAsDemo(page);
  await page.goto("/listings/new");
  await page.getByRole("tab", { name: "House" }).click();
  await expect(page).toHaveURL(/\/listings\/[^/]+\/edit/);
  await page.getByLabel("Size").fill("10");
  await page.getByLabel("Bedrooms").fill("5");
  await page.getByLabel("Bathrooms").fill("4");
  await page.getByLabel("Price").fill("31000000");
  await page.getByRole("combobox", { name: "Area and block" }).fill("G-13");
  await page.getByRole("option", { name: /G-13\/2/ }).click();
  await page.getByLabel("Description").fill("Corner house on a wide road, five bedrooms, near the markaz and the park.");
  await page.locator('#photos input[type="file"]').setInputFiles(Array.from({ length: 5 }, (_, i) => ({ name: `p${i}.png`, mimeType: "image/png", buffer: PNG })));
  await expect(page.getByText("5 of 5 minimum")).toBeVisible();
  await page.locator('#document input[type="file"]').setInputFiles({ name: "registry.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  await expect(page.getByText("registry.pdf")).toBeVisible();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Quality check 6 / 6")).toBeVisible();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page).toHaveURL(/\/listings\/[^/]+$/);
  await expect(page.locator(".chip", { hasText: "Under review" }).first()).toBeVisible();
});
