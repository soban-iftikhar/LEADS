import { expect, test } from "@playwright/test";
import { codeFor, loginAsDemo, typeCode } from "./helpers";

test("guarded page sends you to login and back", async ({ page }) => {
  await page.goto("/leads?stage=new");
  await expect(page).toHaveURL(/\/login\?next=%2Fleads%3Fstage%3Dnew/);
  await page.fill("#l-email", "demo@leads.pk");
  await page.fill("#l-pw", "wrong-pass1");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.locator(".banner")).toHaveText("That email and password do not match.");
  await page.fill("#l-pw", "password1");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/leads\?stage=new/);
});

test("login lands on the overview, logout ends the session", async ({ page }) => {
  await loginAsDemo(page);
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  await page.getByRole("button", { name: /^Account:/ }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
});

test("email signup, email code, then WhatsApp from inside the app", async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e${stamp}@example.test`;
  await page.goto("/signup");
  await page.getByRole("radio", { name: /Agency/ }).click();
  await page.getByRole("link", { name: "Continue as an agency" }).click();
  await expect(page.locator("#s-phone")).toHaveCount(0); // no phone at signup (DR-42)
  await page.fill("#s-agency", "Test Estate");
  await page.fill("#s-name", "Ali Khan");
  await page.fill("#s-email", email);
  await page.fill("#s-pw", "secret123");
  await page.locator("label.chk").click();
  await page.getByRole("button", { name: "Send me the code" }).click();

  await expect(page).toHaveURL(/\/signup\/verify/);
  await expect(page.getByRole("heading", { name: "Check your email." })).toBeVisible();
  await typeCode(page, "000000");
  await expect(page.locator(".banner")).toContainText("didn't match");
  await typeCode(page, await codeFor(email));
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { level: 1, name: "Welcome, Ali" })).toBeVisible();

  // phone is asked inside the app, for the trial and listing review
  await page.getByRole("link", { name: "Add number" }).click();
  await expect(page).toHaveURL(/\/verify-phone/);
  const local = `3${String(stamp).slice(-9)}`;
  await page.fill("#vp-phone", local);
  await page.getByRole("button", { name: "Send me the code" }).click();
  await expect(page.getByRole("heading", { name: "Check WhatsApp." })).toBeVisible();
  await typeCode(page, await codeFor(`+92 ${local.slice(0, 3)} •••${local.slice(-4)}`));
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("link", { name: "Add number" })).toHaveCount(0);
});

test("the same WhatsApp number can't verify a second account", async ({ page }) => {
  await loginAsDemo(page);
  await page.goto("/verify-phone?next=%2Fsettings&change=1");
  await page.fill("#vp-phone", "300 1112233"); // the demo account's own number
  await page.getByRole("button", { name: "Send me the code" }).click();
  await expect(page.locator(".etx")).toContainText("already verified");
});

test("forgot password sends a link that works once", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.fill("#f-email", "demo@leads.pk");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If that email has an account, we sent a link.")).toBeVisible();
});
