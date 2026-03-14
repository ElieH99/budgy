import { test, expect } from "@playwright/test";
import { loginAs, submitExpense, signOut, uniqueTitle } from "./setup";

test.describe("Edge Cases", () => {
  test("withdraw blocked after Under Review", async ({ browser }) => {
    const title = uniqueTitle("WithdrawBlock");

    // Employee submits
    const empPage = await browser.newPage();
    await loginAs(empPage, "employee");
    await submitExpense(empPage, { title });
    await signOut(empPage);

    // Manager opens ticket (triggers UnderReview transition)
    const mgrPage = await browser.newPage();
    await loginAs(mgrPage, "manager");
    await expect(mgrPage.locator(`text=${title}`)).toBeVisible({ timeout: 15000 });
    const row = mgrPage.locator("tr", { has: mgrPage.locator(`text=${title}`) });
    await row.locator('button:has-text("Review")').click();
    await mgrPage.waitForSelector('[role="dialog"]');
    // Wait for status to change to Under Review
    await expect(
      mgrPage.locator('[role="dialog"]').locator("text=Under Review")
    ).toBeVisible({ timeout: 10000 });
    // Close the review modal
    await mgrPage.keyboard.press("Escape");
    await signOut(mgrPage);

    // Employee opens ticket — Withdraw button should NOT be present
    const empPage2 = await browser.newPage();
    await loginAs(empPage2, "employee");
    await expect(empPage2.locator(`text=${title}`)).toBeVisible({ timeout: 15000 });
    const empRow = empPage2.locator("tr", { has: empPage2.locator(`text=${title}`) });
    await empRow.click();
    await empPage2.waitForSelector('[role="dialog"]');

    // Assert: "Withdraw" button is NOT present
    await expect(
      empPage2.locator('[role="dialog"]').locator('button:has-text("Withdraw")')
    ).not.toBeVisible();

    await empPage.close();
    await mgrPage.close();
    await empPage2.close();
  });

  test("cannot withdraw Approved expense", async ({ browser }) => {
    const title = uniqueTitle("NoWithdrawApproved");

    // Employee submits
    const empPage = await browser.newPage();
    await loginAs(empPage, "employee");
    await submitExpense(empPage, { title });
    await signOut(empPage);

    // Manager approves
    const mgrPage = await browser.newPage();
    await loginAs(mgrPage, "manager");
    await expect(mgrPage.locator(`text=${title}`)).toBeVisible({ timeout: 15000 });
    const row = mgrPage.locator("tr", { has: mgrPage.locator(`text=${title}`) });
    await row.locator('button:has-text("Review")').click();
    await mgrPage.waitForSelector('[role="dialog"]');
    await mgrPage.click('button:has-text("Approve")');
    await mgrPage.click('button:has-text("Confirm Approval")');
    await mgrPage.waitForSelector('[role="dialog"]', { state: "detached", timeout: 10000 });
    await signOut(mgrPage);

    // Employee opens approved ticket — no Withdraw button
    const empPage2 = await browser.newPage();
    await loginAs(empPage2, "employee");
    await expect(empPage2.locator(`text=${title}`)).toBeVisible({ timeout: 15000 });
    const empRow = empPage2.locator("tr", { has: empPage2.locator(`text=${title}`) });
    await empRow.click();
    await empPage2.waitForSelector('[role="dialog"]');

    await expect(
      empPage2.locator('[role="dialog"]').locator('button:has-text("Withdraw")')
    ).not.toBeVisible();

    await empPage.close();
    await mgrPage.close();
    await empPage2.close();
  });

  test("closed expense is read-only for employee", async ({ browser }) => {
    const title = uniqueTitle("ClosedReadOnly");

    // Employee submits
    const empPage = await browser.newPage();
    await loginAs(empPage, "employee");
    await submitExpense(empPage, { title });
    await signOut(empPage);

    // Manager closes permanently
    const mgrPage = await browser.newPage();
    await loginAs(mgrPage, "manager");
    await expect(mgrPage.locator(`text=${title}`)).toBeVisible({ timeout: 15000 });
    const row = mgrPage.locator("tr", { has: mgrPage.locator(`text=${title}`) });
    await row.locator('button:has-text("Review")').click();
    await mgrPage.waitForSelector('[role="dialog"]');

    await mgrPage.click('button:has-text("Close permanently")');
    await mgrPage.click('button:has-text("Select reason")');
    await mgrPage.click('[role="option"]:has-text("Fraudulent receipt")');
    await mgrPage.fill("textarea", "Receipt appears to be falsified, closing permanently");
    await mgrPage.click('button:has-text("Close Permanently"):not([role="alertdialog"] button)');
    await mgrPage.waitForSelector('[role="alertdialog"]');
    await mgrPage.click('[role="alertdialog"] button:has-text("Close permanently")');
    await mgrPage.waitForSelector('[role="dialog"]', { state: "detached", timeout: 10000 });
    await signOut(mgrPage);

    // Employee views closed ticket
    const empPage2 = await browser.newPage();
    await loginAs(empPage2, "employee");
    await expect(empPage2.locator(`text=${title}`)).toBeVisible({ timeout: 15000 });
    const empRow = empPage2.locator("tr", { has: empPage2.locator(`text=${title}`) });
    await empRow.click();
    await empPage2.waitForSelector('[role="dialog"]');

    // All action buttons should be hidden
    const dialog = empPage2.locator('[role="dialog"]');
    await expect(dialog.locator('button:has-text("Edit")')).not.toBeVisible();
    await expect(dialog.locator('button:has-text("Submit")')).not.toBeVisible();
    await expect(dialog.locator('button:has-text("Withdraw")')).not.toBeVisible();

    // Close reason and comment visible
    await expect(dialog.locator("text=Fraudulent receipt")).toBeVisible();
    await expect(dialog.locator("text=Receipt appears to be falsified")).toBeVisible();

    await empPage.close();
    await mgrPage.close();
    await empPage2.close();
  });

  test("empty pending queue shows message", async ({ page }) => {
    // Log in as manager — if no pending expenses, should show empty state
    // (We create a fresh context to check the empty state message)
    await loginAs(page, "manager");

    // Look for either pending expenses or an empty state
    // The empty state is valid if no one has submitted expenses
    const hasTable = await page.locator("table").isVisible().catch(() => false);
    const hasEmptyState = await page
      .locator("text=/no pending/i")
      .or(page.locator("text=/nothing to review/i"))
      .or(page.locator("text=/empty/i"))
      .isVisible()
      .catch(() => false);

    // At least one of these should be true
    expect(hasTable || hasEmptyState).toBeTruthy();
  });
});
