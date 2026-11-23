import { expect, type Page, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// shared checks of the list engine on any screen: sort cycles, archive asks, Undo restores
async function sortCycles(page: Page, header: string, key: string) {
  const th = page.getByRole("columnheader", { name: header });
  await th.getByRole("button").click();
  await expect(page).toHaveURL(new RegExp(`sort=${key}\\.asc`));
  await expect(th).toHaveAttribute("aria-sort", "ascending");
  await th.getByRole("button").click();
  await expect(page).toHaveURL(new RegExp(`sort=${key}\\.desc`));
  await th.getByRole("button").click();
  await expect(page).not.toHaveURL(/sort=/);
}

async function archiveAndUndo(page: Page) {
  const first = page.locator("tbody tr").first();
  const title = (await first.locator(".tt b").textContent()) ?? "";
  await first.getByRole("button", { name: "Archive" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Archive" }).click();
  await expect(page.getByRole("status").getByText("Archived")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("status").getByText("Restored")).toBeVisible();
  await expect(page.locator("tbody tr .tt b", { hasText: title }).first()).toBeVisible();
}

test.describe("admin lists: properties", () => {
  test("selection filters by area, sorts, invites and archives with undo", async ({ page }) => {
    await loginAsAdmin(page, "/admin/properties/selection");
    await page.getByLabel("Filter by Area").selectOption("g-13");
    await expect(page).toHaveURL(/filter=g-13/);
    await sortCycles(page, "Price", "price");
    await page.getByRole("tab", { name: /^New/ }).click();
    await expect(page).toHaveURL(/tab=new/);
    await page.locator("tbody tr").first().getByRole("button", { name: "Invite" }).click();
    await expect(page.getByRole("status").getByText(/Invite sent|don't have the seller/)).toBeVisible();
    await archiveAndUndo(page);
  });
});
