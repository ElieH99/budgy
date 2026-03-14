import { describe, it, expect, beforeEach } from "vitest";
import {
  createMockCtx,
  createTestUser,
  createTestExpense,
  createTestVersion,
  getHistoryForExpense,
  resetIdCounter,
} from "./helpers";
import { hasPermission } from "@/lib/permissions";
import { TERMINAL_STATUSES } from "@/lib/constants";
import {
  validateRejectionReason,
  validateCloseReason,
} from "@/convex/authHelpers";
import { ConvexError } from "convex/values";

/**
 * Integration tests for the expense status machine.
 *
 * These test the business rules that govern status transitions by simulating
 * the mutation logic against an in-memory database mock. Each test follows
 * the same flow as the real Convex mutations.
 */

// ── Helpers to simulate mutation logic ─────────────────────────────────────

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

  await db.patch(expenseId, { status: "Submitted", currentVersion: newVersion, updatedAt: Date.now() });
  await db.insert("expenseHistory", {
    expenseId,
    changedBy: userId,
    oldStatus: "Draft",
    newStatus: "Submitted",
    versionNumber: newVersion,
    changedAt: Date.now(),
  });
}

async function simulateOpenForReview(
  db: ReturnType<typeof createMockCtx>["db"],
  managerId: string,
  expenseId: string
) {
  const expense = await db.get(expenseId);
  if (!expense) throw new ConvexError("Expense not found");
  if (expense.submittedBy === managerId) throw new ConvexError("Cannot review own expense");
  if (expense.status !== "Submitted") throw new ConvexError("Only Submitted expenses can be opened for review");

  await db.patch(expenseId, { status: "UnderReview", updatedAt: Date.now() });
  await db.insert("expenseHistory", {
    expenseId,
    changedBy: managerId,
    oldStatus: "Submitted",
    newStatus: "UnderReview",
    versionNumber: expense.currentVersion,
    changedAt: Date.now(),
  });
}

async function simulateApprove(
  db: ReturnType<typeof createMockCtx>["db"],
  managerId: string,
  managerRole: string,
  expenseId: string
) {
  if (!hasPermission(managerRole as "employee" | "manager", "expense:approve")) {
    throw new ConvexError("No permission to approve");
  }
  const expense = await db.get(expenseId);
  if (!expense) throw new ConvexError("Expense not found");
  if (expense.submittedBy === managerId) throw new ConvexError("Cannot approve own expense");
  if (expense.status !== "Submitted" && expense.status !== "UnderReview") {
    throw new ConvexError("Only Submitted or Under Review expenses can be approved");
  }

  await db.patch(expenseId, {
    status: "Approved",
    approvedBy: managerId,
    approvedAt: Date.now(),
    updatedAt: Date.now(),
  });
  await db.insert("expenseHistory", {
    expenseId,
    changedBy: managerId,
    oldStatus: expense.status,
    newStatus: "Approved",
    versionNumber: expense.currentVersion,
    changedAt: Date.now(),
  });
}

async function simulateReject(
  db: ReturnType<typeof createMockCtx>["db"],
  managerId: string,
  managerRole: string,
  expenseId: string,
  reason: string,
  comment: string
) {
  if (!hasPermission(managerRole as "employee" | "manager", "expense:reject")) {
    throw new ConvexError("No permission to reject");
  }
  const expense = await db.get(expenseId);
  if (!expense) throw new ConvexError("Expense not found");
  if (expense.submittedBy === managerId) throw new ConvexError("Cannot reject own expense");
  if (expense.status !== "Submitted" && expense.status !== "UnderReview") {
    throw new ConvexError("Only Submitted or Under Review expenses can be rejected");
  }
  validateRejectionReason(reason);

  await db.patch(expenseId, {
    status: "Rejected",
    rejectedBy: managerId,
    rejectedAt: Date.now(),
    rejectionReason: reason,
    rejectionComment: comment,
    updatedAt: Date.now(),
  });
  await db.insert("expenseHistory", {
    expenseId,
    changedBy: managerId,
    oldStatus: expense.status,
    newStatus: "Rejected",
    comment,
    versionNumber: expense.currentVersion,
    changedAt: Date.now(),
  });
}

async function simulateClose(
  db: ReturnType<typeof createMockCtx>["db"],
  managerId: string,
  managerRole: string,
  expenseId: string,
  reason: string,
  comment: string
) {
  if (!hasPermission(managerRole as "employee" | "manager", "expense:close")) {
    throw new ConvexError("No permission to close");
  }
  const expense = await db.get(expenseId);
  if (!expense) throw new ConvexError("Expense not found");
  if (expense.submittedBy === managerId) throw new ConvexError("Cannot close own expense");
  if (expense.status !== "Submitted" && expense.status !== "UnderReview") {
    throw new ConvexError("Only Submitted or Under Review expenses can be closed");
  }
  validateCloseReason(reason);

  await db.patch(expenseId, {
    status: "Closed",
    closedBy: managerId,
    closedAt: Date.now(),
    closeReason: reason,
    closeComment: comment,
    updatedAt: Date.now(),
  });
  await db.insert("expenseHistory", {
    expenseId,
    changedBy: managerId,
    oldStatus: expense.status,
    newStatus: "Closed",
    comment,
    versionNumber: expense.currentVersion,
    changedAt: Date.now(),
  });
}

async function simulateWithdraw(
  db: ReturnType<typeof createMockCtx>["db"],
  userId: string,
  expenseId: string
) {
  const expense = await db.get(expenseId);
  if (!expense) throw new ConvexError("Expense not found");
  if (expense.submittedBy !== userId) throw new ConvexError("Not your expense");
  if (expense.status !== "Submitted") {
    throw new ConvexError("Expenses can only be withdrawn before a manager has opened them");
  }

  await db.patch(expenseId, { status: "Withdrawn", updatedAt: Date.now() });
  await db.insert("expenseHistory", {
    expenseId,
    changedBy: userId,
    oldStatus: "Submitted",
    newStatus: "Withdrawn",
    versionNumber: expense.currentVersion,
    changedAt: Date.now(),
  });
}

async function simulateEditRejected(
  db: ReturnType<typeof createMockCtx>["db"],
  userId: string,
  expenseId: string
) {
  const expense = await db.get(expenseId);
  if (!expense) throw new ConvexError("Expense not found");
  if (expense.submittedBy !== userId) throw new ConvexError("Not your expense");
  if (expense.status !== "Rejected") throw new ConvexError("Only Rejected expenses can be edited");

  await db.patch(expenseId, { status: "Draft", updatedAt: Date.now() });
  await db.insert("expenseHistory", {
    expenseId,
    changedBy: userId,
    oldStatus: "Rejected",
    newStatus: "Draft",
    versionNumber: expense.currentVersion,
    changedAt: Date.now(),
  });
}

// ── Test suite ─────────────────────────────────────────────────────────────

describe("Status Machine — Valid Transitions", () => {
  let db: ReturnType<typeof createMockCtx>["db"];
  let employeeId: string;
  let managerId: string;

  beforeEach(async () => {
    resetIdCounter();
    const mock = createMockCtx();
    db = mock.db;
    employeeId = await createTestUser(db, { firstName: "Miles", role: "employee" });
    managerId = await createTestUser(db, {
      firstName: "Jack",
      email: "jack@manager.dev",
      role: "manager",
    });
  });

  it("Draft → Submitted (via submitExpense)", async () => {
    const expenseId = await createTestExpense(db, employeeId);
    await createTestVersion(db, expenseId, 0);

    await simulateSubmit(db, employeeId, expenseId);

    const expense = await db.get(expenseId);
    expect(expense!.status).toBe("Submitted");
    expect(expense!.currentVersion).toBe(1);
  });

  it("Submitted → UnderReview (via openForReview)", async () => {
    const expenseId = await createTestExpense(db, employeeId);
    await createTestVersion(db, expenseId, 0);
    await simulateSubmit(db, employeeId, expenseId);

    await simulateOpenForReview(db, managerId, expenseId);

    const expense = await db.get(expenseId);
    expect(expense!.status).toBe("UnderReview");
  });

  it("Submitted → Withdrawn (via withdrawExpense)", async () => {
    const expenseId = await createTestExpense(db, employeeId);
    await createTestVersion(db, expenseId, 0);
    await simulateSubmit(db, employeeId, expenseId);

    await simulateWithdraw(db, employeeId, expenseId);

    const expense = await db.get(expenseId);
    expect(expense!.status).toBe("Withdrawn");
  });

  it("UnderReview → Approved (via approveExpense)", async () => {
    const expenseId = await createTestExpense(db, employeeId);
    await createTestVersion(db, expenseId, 0);
    await simulateSubmit(db, employeeId, expenseId);
    await simulateOpenForReview(db, managerId, expenseId);

    await simulateApprove(db, managerId, "manager", expenseId);

    const expense = await db.get(expenseId);
    expect(expense!.status).toBe("Approved");
  });

  it("UnderReview → Rejected (via rejectExpense)", async () => {
    const expenseId = await createTestExpense(db, employeeId);
    await createTestVersion(db, expenseId, 0);
    await simulateSubmit(db, employeeId, expenseId);
    await simulateOpenForReview(db, managerId, expenseId);

    await simulateReject(
      db,
      managerId,
      "manager",
      expenseId,
      "Missing receipt",
      "Please attach the original receipt document"
    );

    const expense = await db.get(expenseId);
    expect(expense!.status).toBe("Rejected");
  });

  it("UnderReview → Closed (via closeExpense)", async () => {
    const expenseId = await createTestExpense(db, employeeId);
    await createTestVersion(db, expenseId, 0);
    await simulateSubmit(db, employeeId, expenseId);
    await simulateOpenForReview(db, managerId, expenseId);

    await simulateClose(
      db,
      managerId,
      "manager",
      expenseId,
      "Duplicate submission",
      "This expense was already submitted under ticket #123"
    );

    const expense = await db.get(expenseId);
    expect(expense!.status).toBe("Closed");
  });

  it("Rejected → Draft (via editRejected)", async () => {
    const expenseId = await createTestExpense(db, employeeId);
    await createTestVersion(db, expenseId, 0);
    await simulateSubmit(db, employeeId, expenseId);
    await simulateOpenForReview(db, managerId, expenseId);
    await simulateReject(
      db,
      managerId,
      "manager",
      expenseId,
      "Incorrect amount",
      "The amount does not match the receipt"
    );

    await simulateEditRejected(db, employeeId, expenseId);

    const expense = await db.get(expenseId);
    expect(expense!.status).toBe("Draft");
  });

  it("Draft → Submitted again (resubmit — version increments to 2)", async () => {
    const expenseId = await createTestExpense(db, employeeId);
    await createTestVersion(db, expenseId, 0);
    await simulateSubmit(db, employeeId, expenseId); // v1
    await simulateOpenForReview(db, managerId, expenseId);
    await simulateReject(
      db,
      managerId,
      "manager",
      expenseId,
      "Incorrect amount",
      "The amount does not match the receipt"
    );
    await simulateEditRejected(db, employeeId, expenseId);

    // Reset draft version for resubmission
    await createTestVersion(db, expenseId, 0, { amount: 200 });
    // Manually set currentVersion to 1 (since it was at 1 after first submit)
    await db.patch(expenseId, { currentVersion: 1 });

    await simulateSubmit(db, employeeId, expenseId); // v2

    const expense = await db.get(expenseId);
    expect(expense!.status).toBe("Submitted");
    expect(expense!.currentVersion).toBe(2);
  });
});

describe("Status Machine — Invalid Transitions", () => {
  let db: ReturnType<typeof createMockCtx>["db"];
  let employeeId: string;
  let managerId: string;

  beforeEach(async () => {
    resetIdCounter();
    const mock = createMockCtx();
    db = mock.db;
    employeeId = await createTestUser(db, { firstName: "Miles", role: "employee" });
    managerId = await createTestUser(db, {
      firstName: "Jack",
      email: "jack@manager.dev",
      role: "manager",
    });
  });

  it("Approved → anything (terminal)", async () => {
    const expenseId = await createTestExpense(db, employeeId, {
      status: "Approved",
      currentVersion: 1,
    });

    // Cannot submit
    await expect(simulateSubmit(db, employeeId, expenseId)).rejects.toThrow();
    // Cannot withdraw
    await expect(simulateWithdraw(db, employeeId, expenseId)).rejects.toThrow();
    // Cannot approve again
    await expect(simulateApprove(db, managerId, "manager", expenseId)).rejects.toThrow();
  });

  it("Closed → anything (terminal)", async () => {
    const expenseId = await createTestExpense(db, employeeId, {
      status: "Closed",
      currentVersion: 1,
    });

    await expect(simulateSubmit(db, employeeId, expenseId)).rejects.toThrow();
    await expect(simulateApprove(db, managerId, "manager", expenseId)).rejects.toThrow();
    await expect(simulateEditRejected(db, employeeId, expenseId)).rejects.toThrow();
  });

  it("Withdrawn → anything (terminal)", async () => {
    const expenseId = await createTestExpense(db, employeeId, {
      status: "Withdrawn",
      currentVersion: 1,
    });

    await expect(simulateSubmit(db, employeeId, expenseId)).rejects.toThrow();
    await expect(simulateApprove(db, managerId, "manager", expenseId)).rejects.toThrow();
  });

  it("UnderReview → Withdrawn (employee cannot withdraw after manager opens)", async () => {
    const expenseId = await createTestExpense(db, employeeId, {
      status: "UnderReview",
      currentVersion: 1,
    });

    await expect(simulateWithdraw(db, employeeId, expenseId)).rejects.toThrow(
      /withdrawn before a manager/i
    );
  });

  it("Draft → Approved (wrong transition — must go through Submitted)", async () => {
    const expenseId = await createTestExpense(db, employeeId, {
      status: "Draft",
      currentVersion: 0,
    });

    await expect(
      simulateApprove(db, managerId, "manager", expenseId)
    ).rejects.toThrow();
  });

  it("Employee attempting approveExpense (wrong permission)", async () => {
    const expenseId = await createTestExpense(db, employeeId, {
      status: "UnderReview",
      currentVersion: 1,
    });

    await expect(
      simulateApprove(db, employeeId, "employee", expenseId)
    ).rejects.toThrow(/permission/i);
  });

  it("Manager attempting approveExpense on their own expense (self-action blocked)", async () => {
    const expenseId = await createTestExpense(db, managerId, {
      status: "UnderReview",
      currentVersion: 1,
    });

    await expect(
      simulateApprove(db, managerId, "manager", expenseId)
    ).rejects.toThrow(/own expense/i);
  });

  it("terminal statuses are correctly identified", () => {
    expect(TERMINAL_STATUSES).toContain("Approved");
    expect(TERMINAL_STATUSES).toContain("Closed");
    expect(TERMINAL_STATUSES).toContain("Withdrawn");
    expect(TERMINAL_STATUSES).not.toContain("Draft");
    expect(TERMINAL_STATUSES).not.toContain("Submitted");
    expect(TERMINAL_STATUSES).not.toContain("Rejected");
  });
});
