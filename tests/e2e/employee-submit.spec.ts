import { test, expect } from "@playwright/test";
import { loginAs, createDraftExpense, submitExpense, uploadTestReceipt, signOut, uniqueTitle } from "./setup";

test.describe("Employee — Submit Expense", () => {
  test("happy path — full submission", async ({ page }) => {
    await loginAs(page, "employee");

    const title = uniqueTitle("Submit");

    // 1. Click "+ New Ticket"
    await page.click('button:has-text("New Ticket")');
    await page.waitForSelector('[role="dialog"]');

    // 2. Fill all fields
    await page.fill("input#title", title);
    await page.fill("#description", "Business lunch with client for project discussion");

    // Select category
    await page.click('button:has-text("Select category")');
    await page.click('[role="option"]:first-child');

    // Fill amount
    await page.fill("input#amount", "125.50");

    // Upload receipt
    await uploadTestReceipt(page);

    // 3. Click "Save as Draft"
    await page.click('button:has-text("Save as Draft")');
    await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 10000 });

    // 4. Assert: ticket appears in table with "Draft" badge
    await expect(page.locator(`text=${title}`)).toBeVisible({ timeout: 10000 });
    const row = page.locator("tr", { has: page.locator(`text=${title}`) });
    await expect(row.locator("text=Draft")).toBeVisible();

    // 5. Click ticket row → detail modal opens
    await row.click();
    await page.waitForSelector('[role="dialog"]');

    // 6. Click "Submit for Approval"
    await page.click('button:has-text("Submit for Approval")');

    // 7. Assert: status badge changes to "Submitted"
    await expect(page.locator('[role="dialog"]').locator("text=Submitted")).toBeVisible({
      timeout: 10000,
    });
  });

  test("draft save and re-edit", async ({ page }) => {
    await loginAs(page, "employee");

    // Create draft
    const originalTitle = await createDraftExpense(page);
    await expect(page.locator(`text=${originalTitle}`)).toBeVisible({ timeout: 10000 });

    // Click the ticket row to open detail
    const row = page.locator("tr", { has: page.locator(`text=${originalTitle}`) });
    await row.click();
    await page.waitForSelector('[role="dialog"]');

    // Click Edit
    await page.click('button:has-text("Edit")');
    await page.waitForSelector('[role="dialog"]');

    // Update title
    const updatedTitle = `Updated ${Date.now()}`;
    await page.fill("input#title", updatedTitle);

    // Save draft again
    await page.click('button:has-text("Save as Draft")');
    await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 10000 });

    // Assert: updated title shown in table
    await expect(page.locator(`text=${updatedTitle}`)).toBeVisible({ timeout: 10000 });
  });

  test("receipt validation — submit without receipt shows error", async ({ page }) => {
    await loginAs(page, "employee");

    await page.click('button:has-text("New Ticket")');
    await page.waitForSelector('[role="dialog"]');

    await page.fill("input#title", uniqueTitle("NoReceipt"));
    await page.fill("#description", "Test without receipt");
    await page.click('button:has-text("Select category")');
    await page.click('[role="option"]:first-child');
    await page.fill("input#amount", "50");

    // Click "Submit for Approval" without uploading receipt
    await page.click('button:has-text("Submit for Approval")');

    // Should show error about receipt being required
    await expect(
      page.locator("text=Receipt required").or(page.locator("text=receipt"))
    ).toBeVisible({ timeout: 10000 });
  });

  test("withdraw a submitted expense", async ({ page }) => {
    await loginAs(page, "employee");

    // Submit an expense
    const title = await submitExpense(page);

    // Wait for it to appear
    await expect(page.locator(`text=${title}`)).toBeVisible({ timeout: 10000 });

    // Click the row to open detail
    const row = page.locator("tr", { has: page.locator(`text=${title}`) });
    await row.click();
    await page.waitForSelector('[role="dialog"]');

    // Click "Withdraw"
    await page.click('button:has-text("Withdraw")');

    // Confirm dialog appears — click confirm
    await page.waitForSelector('[role="alertdialog"]');
    await page.click('[role="alertdialog"] button:has-text("Withdraw")');

    // Assert: status changes to "Withdrawn"
    await expect(
      page.locator('[role="dialog"]').locator("text=Withdrawn")
    ).toBeVisible({ timeout: 10000 });
  });
});
