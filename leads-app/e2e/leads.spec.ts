import { expect, test } from "@playwright/test";
import { loginAsDemo } from "./helpers";

test("open a lead, change its stage, then report it", async ({ page }) => {
  await loginAsDemo(page);
  await page.goto("/leads?stage=contacted");
  await page.locator("tbody tr").first().locator("td").nth(2).click();
  await expect(page).toHaveURL(/\/leads\/[^/?]+$/);
  await page.locator("label.radio", { hasText: "Viewing" }).click();
  await expect(page.locator(".chip", { hasText: "Viewing" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Report" }).click();
  await expect(page).toHaveURL(/report=1/);
  const send = page.getByRole("button", { name: "Send report" });
  await expect(send).toHaveAttribute("aria-disabled", "true");
  await page.locator(".modal label.radio", { hasText: "Wrong number" }).click();
  await send.click();
  await expect(page.getByText("Under check. We'll reply within 48 hours.")).toBeVisible();
  await expect(page).not.toHaveURL(/report=1/);
});
