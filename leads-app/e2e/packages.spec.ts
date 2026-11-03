import { expect, test } from "@playwright/test";
import { loginAsDemo } from "./helpers";

test("buy leads, pay, and come back to a confirmed package", async ({ page }) => {
  await loginAsDemo(page);
  await page.goto("/packages/buy?listing=lst_bahria&plan=plan_starter");
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await expect(page).toHaveURL(/\/checkout\/[^/]+$/);
  await page.getByRole("button", { name: /Pay PKR/ }).click();
  await expect(page).toHaveURL(/\/checkout\/[^/]+\/return$/);
  await expect(page.getByText("Payment received")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("link", { name: "Go to packages" }).click();
  await expect(page).toHaveURL(/\/packages$/);
});
