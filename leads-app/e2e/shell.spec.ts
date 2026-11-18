import { expect, test } from "@playwright/test";
import { loginAsDemo } from "./helpers";

const nav = { waitUntil: "commit" as const };

test.describe("app shell (rail, header, transition)", () => {
  test.describe("with motion", () => {
    test.use({ reducedMotion: "no-preference" });
    test("rail navigates with a leave transition and highlights the section", async ({ page }) => {
    await loginAsDemo(page);
    const rail = page.getByRole("complementary", { name: "Main menu" });
    // record whether the page faded out (190 ms) before the swap
    await page.evaluate(() => {
      const el = document.querySelector(".stage2");
      const w = window as unknown as { __faded?: boolean };
      w.__faded = false;
      if (el) new MutationObserver(() => { if (el.classList.contains("out")) w.__faded = true; }).observe(el, { attributes: true });
    });
    await rail.getByRole("link", { name: "Packages" }).click();
    await page.waitForURL(/\/packages$/, nav);
    expect(await page.evaluate(() => (window as unknown as { __faded?: boolean }).__faded)).toBe(true);
    await expect(rail.getByRole("link", { name: "Packages" })).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".crumbs .cr")).toHaveText("Packages");
    await expect(page.locator(".rme small")).toHaveText("Agency");
    });
  });

  test("reduced motion swaps pages instantly", async ({ page }) => {
    await loginAsDemo(page);
    await page.evaluate(() => {
      const el = document.querySelector(".stage2");
      const w = window as unknown as { __faded?: boolean };
      w.__faded = false;
      if (el) new MutationObserver(() => { if (el.classList.contains("out")) w.__faded = true; }).observe(el, { attributes: true });
    });
    await page.getByRole("complementary", { name: "Main menu" }).getByRole("link", { name: /^Leads, / }).click();
    await page.waitForURL(/\/leads$/, nav);
    expect(await page.evaluate(() => (window as unknown as { __faded?: boolean }).__faded)).toBe(false);
  });

  test("[ collapses the rail and it stays collapsed after reload; 1-6 jump to sections", async ({ page }) => {
    await loginAsDemo(page);
    await page.waitForTimeout(800);
    await page.locator("h1").click();
    await page.keyboard.press("[");
    await expect(page.locator("html")).toHaveAttribute("data-rail", "col");
    await expect(page.getByRole("button", { name: "Expand menu" })).toHaveAttribute("aria-expanded", "false");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-rail", "col");
    await page.keyboard.press("3");
    await page.waitForURL(/\/listings$/, nav);
    await page.getByRole("button", { name: "Expand menu" }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-rail", "col");
  });

  test("owner account shows Owner in the rail", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#l-email", "owner@leads.pk");
    await page.fill("#l-pw", "password1");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL(/\/dashboard/, nav);
    await expect(page.locator(".rme small")).toHaveText("Owner");
  });

  test("mobile uses the bottom tab bar", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsDemo(page);
    await expect(page.getByRole("complementary", { name: "Main menu" })).toBeHidden();
    const tabs = page.getByRole("navigation", { name: "Main" });
    await tabs.getByRole("link", { name: "Account" }).click();
    await page.waitForURL(/\/settings$/, nav);
  });
});
