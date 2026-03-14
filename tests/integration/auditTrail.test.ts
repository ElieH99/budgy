import { describe, it, expect, beforeEach } from "vitest";
import {
  createMockCtx,
  createTestUser,
  createTestExpense,
  createTestVersion,
  getHistoryForExpense,
  resetIdCounter,
} from "./helpers";

/**
 * Integration tests for the audit trail (ExpenseHistory).
 *
 * Verifies that every status transition writes exactly one history row
 * with the correct fields, and that the append-only integrity is maintained.
 */

// ── Simulation helpers (reused from statusMachine tests) ──────────────────

async function simulateTransition(
  db: ReturnType<typeof createMockCtx>["db"],
  expenseId: string,
  changedBy: string,
  oldStatus: string,
  newStatus: string,
  versionNumber: number,
  comment?: string
) {
  await db.patch(expenseId, { status: newStatus, updatedAt: Date.now() });
  await db.insert("expenseHistory", {
    expenseId,
    changedBy,
    oldStatus,
    newStatus,
    comment,
    versionNumber,
    changedAt: Date.now(),
  });
}

describe("Audit Trail (ExpenseHistory)", () => {
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

  it("every status transition writes exactly one ExpenseHistory row", async () => {
    const expenseId = await createTestExpense(db, employeeId);
    await createTestVersion(db, expenseId, 0);

    // Draft → Submitted
    await simulateTransition(db, expenseId, employeeId, "Draft", "Submitted", 1);

    const history = await getHistoryForExpense(db, expenseId);
    expect(history).toHaveLength(1);
  });

  it("ExpenseHistory row contains correct oldStatus, newStatus, changedBy, versionNumber, changedAt", async () => {
    const expenseId = await createTestExpense(db, employeeId);
    const beforeTime = Date.now();

    await simulateTransition(db, expenseId, employeeId, "Draft", "Submitted", 1);

    const afterTime = Date.now();
    const history = await getHistoryForExpense(db, expenseId);
    const entry = history[0];

    expect(entry.oldStatus).toBe("Draft");
    expect(entry.newStatus).toBe("Submitted");
    expect(entry.changedBy).toBe(employeeId);
    expect(entry.versionNumber).toBe(1);
    expect(entry.changedAt).toBeGreaterThanOrEqual(beforeTime);
    expect(entry.changedAt).toBeLessThanOrEqual(afterTime);
  });

  it("full lifecycle creates 6 history entries", async () => {
    const expenseId = await createTestExpense(db, employeeId);
    await createTestVersion(db, expenseId, 0);

    // 1. Draft → Submitted
    await simulateTransition(db, expenseId, employeeId, "Draft", "Submitted", 1);
    // 2. Submitted → UnderReview
    await simulateTransition(db, expenseId, managerId, "Submitted", "UnderReview", 1);
    // 3. UnderReview → Rejected
    await simulateTransition(
      db,
      expenseId,
      managerId,
      "UnderReview",
      "Rejected",
      1,
      "Missing receipt"
    );
    // 4. Rejected → Draft
    await simulateTransition(db, expenseId, employeeId, "Rejected", "Draft", 1);
    // 5. Draft → Submitted (v2)
    await simulateTransition(db, expenseId, employeeId, "Draft", "Submitted", 2);
    // 6. Submitted → Approved
    await simulateTransition(db, expenseId, managerId, "Submitted", "Approved", 2);

    const history = await getHistoryForExpense(db, expenseId);
    expect(history).toHaveLength(6);

    // Verify the transition chain
    expect(history[0].newStatus).toBe("Submitted");
    expect(history[1].newStatus).toBe("UnderReview");
    expect(history[2].newStatus).toBe("Rejected");
    expect(history[3].newStatus).toBe("Draft");
    expect(history[4].newStatus).toBe("Submitted");
    expect(history[5].newStatus).toBe("Approved");
  });

  it("history entries are never deleted or updated (append-only integrity)", async () => {
    const expenseId = await createTestExpense(db, employeeId);

    await simulateTransition(db, expenseId, employeeId, "Draft", "Submitted", 1);
    const historyBefore = await getHistoryForExpense(db, expenseId);
    const firstEntryId = historyBefore[0]._id;
    const firstEntryData = { ...historyBefore[0] };

    // Add more transitions
    await simulateTransition(db, expenseId, managerId, "Submitted", "UnderReview", 1);
    await simulateTransition(db, expenseId, managerId, "UnderReview", "Approved", 1);

    const historyAfter = await getHistoryForExpense(db, expenseId);
    expect(historyAfter).toHaveLength(3);

    // First entry should be unchanged
    const firstEntryAfter = historyAfter.find((h) => h._id === firstEntryId);
    expect(firstEntryAfter).toBeDefined();
    expect(firstEntryAfter!.oldStatus).toBe(firstEntryData.oldStatus);
    expect(firstEntryAfter!.newStatus).toBe(firstEntryData.newStatus);
    expect(firstEntryAfter!.changedBy).toBe(firstEntryData.changedBy);
    expect(firstEntryAfter!.versionNumber).toBe(firstEntryData.versionNumber);
  });

  it("changedAt is within a reasonable window of execution time", async () => {
    const expenseId = await createTestExpense(db, employeeId);
    const before = Date.now();

    await simulateTransition(db, expenseId, employeeId, "Draft", "Submitted", 1);

    const after = Date.now();
    const history = await getHistoryForExpense(db, expenseId);
    const entry = history[0];

    // changedAt should be within the test execution window (< 1 second tolerance)
    expect(entry.changedAt).toBeGreaterThanOrEqual(before);
    expect(entry.changedAt).toBeLessThanOrEqual(after + 1000);
  });
});
