import { expect, test } from "@playwright/test";

test.describe("theme (lamp)", () => {
  test("defaults to the OS preference before first paint", async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: "dark" });
    const page = await ctx.newPage();
    // the head script runs before any paint, so the attribute is there as soon as the DOM exists
    await page.goto("/dev/ui", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await ctx.close();
  });

  test("pulling the cord flips the theme and it sticks after reload", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/dev/ui");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "light");
    const lamp = page.getByRole("button", { name: "Pull the lamp cord: switch to dark mode" });
    await expect(lamp).toHaveAttribute("aria-pressed", "false");

    await lamp.focus();
    await page.keyboard.press("Enter");
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("button", { name: "Pull the lamp cord: switch to light mode" })).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => localStorage.getItem("leads-theme"))).toBe("dark");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(html).toHaveAttribute("data-theme", "dark");
  });

  test("a short tug on the bead does nothing, a real pull switches", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/dev/ui");
    const html = page.locator("html");
    const bead = page.locator(".lamp .bead");
    const box = await bead.boundingBox();
    if (!box) throw new Error("no bead");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 7, { steps: 4 }); // 4-10px: like a half-hearted pull
    await page.mouse.up();
    await expect(html).toHaveAttribute("data-theme", "light");

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 24, { steps: 6 });
    await page.mouse.up();
    await expect(html).toHaveAttribute("data-theme", "dark");
  });
});
