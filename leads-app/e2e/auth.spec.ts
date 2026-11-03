import { expect, test } from "@playwright/test";
import { loginAsDemo } from "./helpers";

test("guarded page sends you to login and back", async ({ page }) => {
  await page.goto("/leads?stage=new");
  await expect(page).toHaveURL(/\/login\?next=%2Fleads%3Fstage%3Dnew/);
  await page.fill("#l-email", "demo@leads.pk");
  await page.fill("#l-pw", "wrong-pass1");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.locator(".banner")).toHaveText("That email and password do not match.");
  await page.fill("#l-pw", "password1");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/leads\?stage=new/);
});

test("login lands on the overview", async ({ page }) => {
  await loginAsDemo(page);
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
});

test("signup with WhatsApp code ends on the welcome screen", async ({ page }) => {
  const stamp = Date.now();
  await page.goto("/signup");
  await page.getByRole("radio", { name: /Agency/ }).click();
  await page.getByRole("link", { name: "Continue as an agency" }).click();
  await page.fill("#s-agency", "Test Estate");
  await page.fill("#s-name", "Ali Khan");
  await page.fill("#s-email", `e2e${stamp}@example.pk`);
  await page.fill("#s-phone", `3${String(stamp).slice(-9)}`);
  await page.fill("#s-pw", "secret123");
  await page.locator("label.chk").click();
  await page.getByRole("button", { name: "Send me the code" }).click();
  await expect(page).toHaveURL(/\/signup\/verify/);
  await page.locator(".ob").first().focus();
  await page.keyboard.type("000000");
  await expect(page.locator(".banner")).toContainText("That code didn't match");
  await page.locator(".ob").first().focus();
  await page.keyboard.type("123456");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { level: 1, name: "Welcome, Ali" })).toBeVisible();
});
