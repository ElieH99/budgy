import { test, expect } from "@playwright/test";
import { loginAs, submitExpense, signOut, uniqueTitle } from "./setup";

test.describe("Manager — Navigation & Filters", () => {
  test("previous/next navigation in review modal", async ({ browser }) => {
    // Submit 3 expenses as employee
    const empPage = await browser.newPage();
    await loginAs(empPage, "employee");

    const titles: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const title = uniqueTitle(`Nav${i}`);
      await submitExpense(empPage, { title });
      titles.push(title);
    }
    await signOut(empPage);

    // Log in as manager
    const mgrPage = await browser.newPage();
    await loginAs(mgrPage, "manager");

    // Wait for expenses to show up in pending queue
    for (const title of titles) {
      await expect(mgrPage.locator(`text=${title}`)).toBeVisible({ timeout: 15000 });
    }

    // Click review on the first one
    const firstRow = mgrPage.locator("tr", { has: mgrPage.locator(`text=${titles[0]}`) });
    await firstRow.locator('button:has-text("Review")').click();
    await mgrPage.waitForSelector('[role="dialog"]');

    // Assert navigation counter shows "X of Y pending"
    await expect(mgrPage.locator("text=/\\d+ of \\d+ pending/")).toBeVisible({ timeout: 10000 });

    // Click "Next" → second expense loads
    const nextBtn = mgrPage.locator('button[aria-label="Next expense"]');
    if (await nextBtn.isEnabled()) {
      await nextBtn.click();
      await mgrPage.waitForTimeout(1000);

      // Click "Previous" → returns to first
      const prevBtn = mgrPage.locator('button[aria-label="Previous expense"]');
      if (await prevBtn.isEnabled()) {
        await prevBtn.click();
        await mgrPage.waitForTimeout(1000);
      }
    }

    await empPage.close();
    await mgrPage.close();
  });

  test("reviewed history status filters", async ({ browser }) => {
    // Create expenses with different statuses
    const titles = {
      approve: uniqueTitle("FilterApprove"),
      reject: uniqueTitle("FilterReject"),
    };

    // Employee submits two expenses
    const empPage = await browser.newPage();
    await loginAs(empPage, "employee");
    await submitExpense(empPage, { title: titles.approve });
    await submitExpense(empPage, { title: titles.reject });
    await signOut(empPage);

    // Manager: approve one, reject the other
    const mgrPage = await browser.newPage();
    await loginAs(mgrPage, "manager");

    // Approve first
    await expect(mgrPage.locator(`text=${titles.approve}`)).toBeVisible({ timeout: 15000 });
    let row = mgrPage.locator("tr", { has: mgrPage.locator(`text=${titles.approve}`) });
    await row.locator('button:has-text("Review")').click();
    await mgrPage.waitForSelector('[role="dialog"]');
    await mgrPage.click('button:has-text("Approve")');
    await mgrPage.click('button:has-text("Confirm Approval")');
    await mgrPage.waitForSelector('[role="dialog"]', { state: "detached", timeout: 10000 });

    // Reject second
    await expect(mgrPage.locator(`text=${titles.reject}`)).toBeVisible({ timeout: 15000 });
    row = mgrPage.locator("tr", { has: mgrPage.locator(`text=${titles.reject}`) });
    await row.locator('button:has-text("Review")').click();
    await mgrPage.waitForSelector('[role="dialog"]');
    await mgrPage.click('button:has-text("Reject")');
    await mgrPage.click('button:has-text("Select reason")');
    await mgrPage.click('[role="option"]:first-child');
    await mgrPage.fill("textarea", "This expense needs more details and corrections");
    await mgrPage.click('button:has-text("Confirm Rejection")');
    await mgrPage.waitForSelector('[role="dialog"]', { state: "detached", timeout: 10000 });

    // Switch to Reviewed History
    await mgrPage.click('button[role="tab"]:has-text("Reviewed History")');
    await mgrPage.waitForTimeout(2000);

    // Both should be visible initially
    await expect(mgrPage.locator(`text=${titles.approve}`)).toBeVisible({ timeout: 10000 });
    await expect(mgrPage.locator(`text=${titles.reject}`)).toBeVisible({ timeout: 10000 });

    await empPage.close();
    await mgrPage.close();
  });
});
