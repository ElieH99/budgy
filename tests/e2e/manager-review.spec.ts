import { test, expect } from "@playwright/test";
import { loginAs, submitExpense, signOut, uniqueTitle } from "./setup";

test.describe("Manager — Review", () => {
  test("approve flow", async ({ browser }) => {
    const title = uniqueTitle("Approve");

    // Employee submits
    const empPage = await browser.newPage();
    await loginAs(empPage, "employee");
    await submitExpense(empPage, { title });
    await signOut(empPage);

    // Manager approves
    const mgrPage = await browser.newPage();
    await loginAs(mgrPage, "manager");

    // Open pending queue — find expense
    await expect(mgrPage.locator(`text=${title}`)).toBeVisible({ timeout: 15000 });
    const row = mgrPage.locator("tr", { has: mgrPage.locator(`text=${title}`) });
    await row.locator('button:has-text("Review")').click();
    await mgrPage.waitForSelector('[role="dialog"]');

    // Status should show Under Review
    await expect(
      mgrPage.locator('[role="dialog"]').locator("text=Under Review")
    ).toBeVisible({ timeout: 10000 });

    // Click "Approve"
    await mgrPage.click('button:has-text("Approve")');

    // Add approval note (optional)
    await mgrPage.fill("textarea", "Looks good, approved.");

    // Confirm approval
    await mgrPage.click('button:has-text("Confirm Approval")');

    // Modal should close
    await mgrPage.waitForSelector('[role="dialog"]', { state: "detached", timeout: 10000 });

    // Switch to Reviewed History tab
    await mgrPage.click('button[role="tab"]:has-text("Reviewed History")');

    // Assert expense appears with "Approved" badge
    await expect(mgrPage.locator(`text=${title}`)).toBeVisible({ timeout: 10000 });
    const historyRow = mgrPage.locator("tr", { has: mgrPage.locator(`text=${title}`) });
    await expect(historyRow.locator("text=Approved")).toBeVisible();

    await empPage.close();
    await mgrPage.close();
  });

  test("reject flow", async ({ browser }) => {
    const title = uniqueTitle("Reject");

    // Employee submits
    const empPage = await browser.newPage();
    await loginAs(empPage, "employee");
    await submitExpense(empPage, { title });
    await signOut(empPage);

    // Manager rejects
    const mgrPage = await browser.newPage();
    await loginAs(mgrPage, "manager");

    await expect(mgrPage.locator(`text=${title}`)).toBeVisible({ timeout: 15000 });
    const row = mgrPage.locator("tr", { has: mgrPage.locator(`text=${title}`) });
    await row.locator('button:has-text("Review")').click();
    await mgrPage.waitForSelector('[role="dialog"]');

    // Click "Reject — needs correction"
    await mgrPage.click('button:has-text("Reject")');

    // Confirm is disabled before fields completed (no confirm button or it's disabled)
    const confirmBtn = mgrPage.locator('button:has-text("Confirm Rejection")');
    await expect(confirmBtn).toBeDisabled();

    // Fill rejection reason
    await mgrPage.click('button:has-text("Select reason")');
    await mgrPage.click('[role="option"]:has-text("Missing receipt")');

    // Fill rejection comment (≥ 10 chars)
    await mgrPage.fill("textarea", "Please reupload the receipt, the current one is missing");

    // Confirm should now be enabled
    await expect(confirmBtn).toBeEnabled();

    // Submit rejection
    await confirmBtn.click();
    await mgrPage.waitForSelector('[role="dialog"]', { state: "detached", timeout: 10000 });

    // Switch to Reviewed History
    await mgrPage.click('button[role="tab"]:has-text("Reviewed History")');
    await expect(mgrPage.locator(`text=${title}`)).toBeVisible({ timeout: 10000 });
    const historyRow = mgrPage.locator("tr", { has: mgrPage.locator(`text=${title}`) });
    await expect(historyRow.locator("text=Rejected")).toBeVisible();

    await empPage.close();
    await mgrPage.close();
  });

  test("close (permanent) flow", async ({ browser }) => {
    const title = uniqueTitle("Close");

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

    // Click "Close permanently"
    await mgrPage.click('button:has-text("Close permanently")');

    // Fill close reason
    await mgrPage.click('button:has-text("Select reason")');
    await mgrPage.click('[role="option"]:has-text("Duplicate submission")');

    // Fill close comment (≥ 10 chars)
    await mgrPage.fill("textarea", "This is a duplicate expense already submitted and processed");

    // Click "Close Permanently" button to open confirmation dialog
    await mgrPage.click('button:has-text("Close Permanently"):not([role="alertdialog"] button)');

    // Confirmation dialog should appear — mention the employee's first name
    await mgrPage.waitForSelector('[role="alertdialog"]');
    await expect(mgrPage.locator('[role="alertdialog"]').locator("text=Miles")).toBeVisible();

    // Confirm close
    await mgrPage.click('[role="alertdialog"] button:has-text("Close permanently")');
    await mgrPage.waitForSelector('[role="dialog"]', { state: "detached", timeout: 10000 });

    // Switch to Reviewed History
    await mgrPage.click('button[role="tab"]:has-text("Reviewed History")');
    await expect(mgrPage.locator(`text=${title}`)).toBeVisible({ timeout: 10000 });
    const historyRow = mgrPage.locator("tr", { has: mgrPage.locator(`text=${title}`) });
    await expect(historyRow.locator("text=Closed")).toBeVisible();

    // ── Verify employee view shows closed + read-only ──
    const empPage2 = await browser.newPage();
    await loginAs(empPage2, "employee");
    await expect(empPage2.locator(`text=${title}`)).toBeVisible({ timeout: 15000 });
    const empRow = empPage2.locator("tr", { has: empPage2.locator(`text=${title}`) });
    await empRow.click();
    await empPage2.waitForSelector('[role="dialog"]');

    // No action buttons should be visible
    await expect(
      empPage2.locator('[role="dialog"]').locator('button:has-text("Edit")')
    ).not.toBeVisible();
    await expect(
      empPage2.locator('[role="dialog"]').locator('button:has-text("Submit")')
    ).not.toBeVisible();
    await expect(
      empPage2.locator('[role="dialog"]').locator('button:has-text("Withdraw")')
    ).not.toBeVisible();

    // Close reason and comment visible
    await expect(empPage2.locator("text=Duplicate submission")).toBeVisible();

    await empPage.close();
    await mgrPage.close();
    await empPage2.close();
  });

  test("self-action prevention — manager's own expense not in pending queue", async ({
    page,
  }) => {
    await loginAs(page, "manager");

    // Submit an expense as manager
    const title = await submitExpense(page, { title: uniqueTitle("SelfMgr") });

    // The submitted expense should NOT appear in the pending queue
    // (pending queue is the default tab for managers)
    // The expense should be under "My Submissions" tab
    await page.click('button[role="tab"]:has-text("My Submissions")');
    await expect(page.locator(`text=${title}`)).toBeVisible({ timeout: 10000 });

    // Switch back to pending queue
    await page.click('button[role="tab"]:has-text("Pending Review")');

    // Own expense should NOT be in pending queue
    await page.waitForTimeout(2000);
    const pendingRow = page.locator("tr", { has: page.locator(`text=${title}`) });
    await expect(pendingRow).not.toBeVisible();
  });
});
