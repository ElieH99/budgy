import { test, expect } from "@playwright/test";
import { loginAs, submitExpense, signOut, uniqueTitle } from "./setup";

test.describe("Employee — Resubmission Flow", () => {
  test("rejection → resubmission flow", async ({ browser }) => {
    const title = uniqueTitle("Resub");

    // ── Step 1: Employee submits expense ──────────────────────────────
    const employeePage = await browser.newPage();
    await loginAs(employeePage, "employee");
    await submitExpense(employeePage, { title });
    await signOut(employeePage);

    // ── Step 2: Manager rejects it ────────────────────────────────────
    const managerPage = await browser.newPage();
    await loginAs(managerPage, "manager");

    // Open the pending queue — find the expense
    await expect(managerPage.locator(`text=${title}`)).toBeVisible({ timeout: 15000 });

    // Click "Review" button on that row
    const row = managerPage.locator("tr", { has: managerPage.locator(`text=${title}`) });
    await row.locator('button:has-text("Review")').click();
    await managerPage.waitForSelector('[role="dialog"]');

    // Click "Reject — needs correction"
    await managerPage.click('button:has-text("Reject")');

    // Select rejection reason
    await managerPage.click('button:has-text("Select reason")');
    await managerPage.click('[role="option"]:has-text("Incorrect amount")');

    // Fill rejection comment (≥ 10 chars)
    await managerPage.fill(
      'textarea',
      "The amount entered does not match the receipt total"
    );

    // Submit rejection
    await managerPage.click('button:has-text("Confirm Rejection")');
    await managerPage.waitForSelector('[role="dialog"]', { state: "detached", timeout: 10000 });
    await signOut(managerPage);

    // ── Step 3: Employee sees rejection and resubmits ─────────────────
    const resubPage = await browser.newPage();
    await loginAs(resubPage, "employee");

    // Assert: ticket shows "Rejected" badge
    await expect(resubPage.locator(`text=${title}`)).toBeVisible({ timeout: 15000 });
    const expenseRow = resubPage.locator("tr", { has: resubPage.locator(`text=${title}`) });
    await expect(expenseRow.locator("text=Rejected")).toBeVisible();

    // Open ticket
    await expenseRow.click();
    await resubPage.waitForSelector('[role="dialog"]');

    // Assert rejection banner with reason and comment is visible
    await expect(resubPage.locator("text=Incorrect amount")).toBeVisible();
    await expect(
      resubPage.locator("text=The amount entered does not match")
    ).toBeVisible();

    // Click "Edit & Resubmit"
    await resubPage.click('button:has-text("Edit & Resubmit")');
    await resubPage.waitForSelector('[role="dialog"]');

    // Modify amount field
    await resubPage.fill("input#amount", "150.00");

    // Click "Submit for Approval" (resubmit)
    await resubPage.click('button:has-text("Submit for Approval")');
    await resubPage.waitForSelector('[role="dialog"]', { state: "detached", timeout: 15000 });

    // Assert: status → "Submitted"
    await expect(expenseRow.locator("text=Submitted")).toBeVisible({ timeout: 10000 });

    // Cleanup
    await employeePage.close();
    await managerPage.close();
    await resubPage.close();
  });
});
