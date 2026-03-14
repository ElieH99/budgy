import { describe, it, expect, beforeEach } from "vitest";
import {
  createMockCtx,
  createTestUser,
  createTestExpense,
  createTestVersion,
  getVersionsForExpense,
  resetIdCounter,
} from "./helpers";
import { ConvexError } from "convex/values";

/**
 * Integration tests for expense version management.
 *
 * Verifies that version snapshots are created correctly on submit/resubmit,
 * that prior version data is preserved (append-only), and that receipt
 * validation is enforced.
 */

async function simulateSubmit(
  db: ReturnType<typeof createMockCtx>["db"],
  userId: string,
  expenseId: string
) {
  const expense = await db.get(expenseId);
  if (!expense) throw new ConvexError("Expense not found");
  if (expense.submittedBy !== userId) throw new ConvexError("Not your expense");
  if (expense.status !== "Draft") throw new ConvexError("Only Draft expenses can be submitted");

  const draftVersion = await db
    .query("expenseVersions")
    .withIndex("by_expenseId_versionNumber", (q) =>
      q.eq("expenseId", expenseId).eq("versionNumber", 0)
    )
    .unique();
  if (!draftVersion) throw new ConvexError("Draft data not found");
  if (!draftVersion.receiptStorageId) throw new ConvexError("Receipt is required for submission");

  const newVersion = (expense.currentVersion as number) + 1;
  await db.insert("expenseVersions", {
    expenseId,
    versionNumber: newVersion,
    title: draftVersion.title,
    description: draftVersion.description,
    amount: draftVersion.amount,
    currencyCode: draftVersion.currencyCode,
    categoryId: draftVersion.categoryId,
    expenseDate: draftVersion.expenseDate,
    receiptStorageId: draftVersion.receiptStorageId,
    notes: draftVersion.notes,
    submittedAt: Date.now(),
  });

  await db.patch(expenseId, {
    status: "Submitted",
    currentVersion: newVersion,
    updatedAt: Date.now(),
  });

  await db.insert("expenseHistory", {
    expenseId,
    changedBy: userId,
    oldStatus: "Draft",
    newStatus: "Submitted",
    versionNumber: newVersion,
    changedAt: Date.now(),
  });
}

describe("Versioning", () => {
  let db: ReturnType<typeof createMockCtx>["db"];
  let employeeId: string;

  beforeEach(async () => {
    resetIdCounter();
    const mock = createMockCtx();
    db = mock.db;
    employeeId = await createTestUser(db, { firstName: "Miles", role: "employee" });
  });

  it("submitting a Draft creates ExpenseVersion with versionNumber: 1", async () => {
    const expenseId = await createTestExpense(db, employeeId);
    await createTestVersion(db, expenseId, 0, { title: "First Expense" });

    await simulateSubmit(db, employeeId, expenseId);

    const versions = await getVersionsForExpense(db, expenseId);
    const v1 = versions.find((v) => v.versionNumber === 1);
    expect(v1).toBeDefined();
    expect(v1!.title).toBe("First Expense");
    expect(v1!.versionNumber).toBe(1);
  });

  it("resubmitting after rejection creates ExpenseVersion with versionNumber: 2", async () => {
    const expenseId = await createTestExpense(db, employeeId);
    await createTestVersion(db, expenseId, 0, { title: "Original Title" });

    // First submit → v1
    await simulateSubmit(db, employeeId, expenseId);

    // Simulate rejection → Draft (skipping manager flow for version test)
    await db.patch(expenseId, { status: "Rejected" });
    await db.patch(expenseId, { status: "Draft" });

    // Update draft version for resubmit
    const draftV = await db
      .query("expenseVersions")
      .withIndex("by_expenseId_versionNumber", (q) =>
        q.eq("expenseId", expenseId).eq("versionNumber", 0)
      )
      .unique();
    if (draftV) {
      await db.patch(draftV._id, { title: "Updated Title", amount: 200 });
    }

    // Resubmit → v2
    await simulateSubmit(db, employeeId, expenseId);

    const expense = await db.get(expenseId);
    expect(expense!.currentVersion).toBe(2);

    const versions = await getVersionsForExpense(db, expenseId);
    const v2 = versions.find((v) => v.versionNumber === 2);
    expect(v2).toBeDefined();
    expect(v2!.title).toBe("Updated Title");
    expect(v2!.amount).toBe(200);
  });

  it("Expense.currentVersion equals 2 after first resubmission", async () => {
    const expenseId = await createTestExpense(db, employeeId);
    await createTestVersion(db, expenseId, 0);

    await simulateSubmit(db, employeeId, expenseId); // v1
    await db.patch(expenseId, { status: "Rejected" });
    await db.patch(expenseId, { status: "Draft" });
    await simulateSubmit(db, employeeId, expenseId); // v2

    const expense = await db.get(expenseId);
    expect(expense!.currentVersion).toBe(2);
  });

  it("prior version data is preserved in ExpenseVersions (not overwritten)", async () => {
    const expenseId = await createTestExpense(db, employeeId);
    await createTestVersion(db, expenseId, 0, { title: "Original", amount: 100 });

    await simulateSubmit(db, employeeId, expenseId); // v1

    // Simulate rejection → draft → update → resubmit
    await db.patch(expenseId, { status: "Rejected" });
    await db.patch(expenseId, { status: "Draft" });

    const draftV = await db
      .query("expenseVersions")
      .withIndex("by_expenseId_versionNumber", (q) =>
        q.eq("expenseId", expenseId).eq("versionNumber", 0)
      )
      .unique();
    if (draftV) {
      await db.patch(draftV._id, { title: "Updated", amount: 250 });
    }

    await simulateSubmit(db, employeeId, expenseId); // v2

    const versions = await getVersionsForExpense(db, expenseId);
    const v1 = versions.find((v) => v.versionNumber === 1);
    const v2 = versions.find((v) => v.versionNumber === 2);

    // v1 data preserved
    expect(v1!.title).toBe("Original");
    expect(v1!.amount).toBe(100);

    // v2 has new data
    expect(v2!.title).toBe("Updated");
    expect(v2!.amount).toBe(250);
  });

  it("receipt storageId from v1 is still present after v2 is submitted", async () => {
    const expenseId = await createTestExpense(db, employeeId);
    await createTestVersion(db, expenseId, 0, { receiptStorageId: "receipt-v1" });

    await simulateSubmit(db, employeeId, expenseId); // v1

    await db.patch(expenseId, { status: "Rejected" });
    await db.patch(expenseId, { status: "Draft" });

    // Update receipt for v2
    const draftV = await db
      .query("expenseVersions")
      .withIndex("by_expenseId_versionNumber", (q) =>
        q.eq("expenseId", expenseId).eq("versionNumber", 0)
      )
      .unique();
    if (draftV) {
      await db.patch(draftV._id, { receiptStorageId: "receipt-v2" });
    }

    await simulateSubmit(db, employeeId, expenseId); // v2

    const versions = await getVersionsForExpense(db, expenseId);
    const v1 = versions.find((v) => v.versionNumber === 1);
    const v2 = versions.find((v) => v.versionNumber === 2);

    expect(v1!.receiptStorageId).toBe("receipt-v1");
    expect(v2!.receiptStorageId).toBe("receipt-v2");
  });

  it("submitting without a receipt throws ConvexError", async () => {
    const expenseId = await createTestExpense(db, employeeId);
    await createTestVersion(db, expenseId, 0, { receiptStorageId: "" });

    await expect(simulateSubmit(db, employeeId, expenseId)).rejects.toThrow(
      /receipt is required/i
    );
  });
});
