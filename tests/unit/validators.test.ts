import { describe, it, expect } from "vitest";
import {
  expenseFormSchema,
  rejectExpenseSchema,
  closeExpenseSchema,
  approveExpenseSchema,
} from "@/lib/validators";

// ── Helper: valid expense form data ────────────────────────────────────────

const validExpenseForm = {
  title: "Business lunch",
  description: "Lunch with client at downtown restaurant",
  amount: 75.5,
  currencyCode: "USD" as const,
  categoryId: "some-category-id",
  expenseDate: Date.now(),
  notes: "Optional note",
  receiptStorageId: "receipt-123",
};

// ── expenseFormSchema ──────────────────────────────────────────────────────

describe("expenseFormSchema", () => {
  it("accepts valid data with all required fields", () => {
    const result = expenseFormSchema.safeParse(validExpenseForm);
    expect(result.success).toBe(true);
  });

  it("accepts valid data without optional fields", () => {
    const { notes, receiptStorageId, ...required } = validExpenseForm;
    const result = expenseFormSchema.safeParse(required);
    expect(result.success).toBe(true);
  });

  it("rejects missing title", () => {
    const { title, ...rest } = validExpenseForm;
    const result = expenseFormSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects empty title", () => {
    const result = expenseFormSchema.safeParse({ ...validExpenseForm, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects amount = 0", () => {
    const result = expenseFormSchema.safeParse({ ...validExpenseForm, amount: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = expenseFormSchema.safeParse({ ...validExpenseForm, amount: -10 });
    expect(result.success).toBe(false);
  });

  it("rejects missing currencyCode", () => {
    const { currencyCode, ...rest } = validExpenseForm;
    const result = expenseFormSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects invalid currencyCode", () => {
    const result = expenseFormSchema.safeParse({
      ...validExpenseForm,
      currencyCode: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing categoryId", () => {
    const { categoryId, ...rest } = validExpenseForm;
    const result = expenseFormSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects empty categoryId", () => {
    const result = expenseFormSchema.safeParse({
      ...validExpenseForm,
      categoryId: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing expenseDate", () => {
    const { expenseDate, ...rest } = validExpenseForm;
    const result = expenseFormSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects non-number amount", () => {
    const result = expenseFormSchema.safeParse({
      ...validExpenseForm,
      amount: "not-a-number",
    });
    expect(result.success).toBe(false);
  });
});

// ── rejectExpenseSchema ────────────────────────────────────────────────────

describe("rejectExpenseSchema", () => {
  const validReject = {
    expenseId: "expense-123",
    rejectionReason: "Missing receipt" as const,
    rejectionComment: "Please attach the original receipt for this expense",
  };

  it("accepts valid rejection data", () => {
    const result = rejectExpenseSchema.safeParse(validReject);
    expect(result.success).toBe(true);
  });

  it("rejects rejectionReason not in enum", () => {
    const result = rejectExpenseSchema.safeParse({
      ...validReject,
      rejectionReason: "Not a valid reason",
    });
    expect(result.success).toBe(false);
  });

  it("rejects rejectionComment < 10 chars", () => {
    const result = rejectExpenseSchema.safeParse({
      ...validReject,
      rejectionComment: "Short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty rejectionComment", () => {
    const result = rejectExpenseSchema.safeParse({
      ...validReject,
      rejectionComment: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing expenseId", () => {
    const { expenseId, ...rest } = validReject;
    const result = rejectExpenseSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

// ── closeExpenseSchema ─────────────────────────────────────────────────────

describe("closeExpenseSchema", () => {
  const validClose = {
    expenseId: "expense-123",
    closeReason: "Duplicate submission" as const,
    closeComment: "This is a duplicate of expense #456, closing permanently",
  };

  it("accepts valid close data", () => {
    const result = closeExpenseSchema.safeParse(validClose);
    expect(result.success).toBe(true);
  });

  it("rejects closeReason not in enum", () => {
    const result = closeExpenseSchema.safeParse({
      ...validClose,
      closeReason: "Not a valid reason",
    });
    expect(result.success).toBe(false);
  });

  it("rejects closeComment < 10 chars", () => {
    const result = closeExpenseSchema.safeParse({
      ...validClose,
      closeComment: "Short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty closeComment", () => {
    const result = closeExpenseSchema.safeParse({
      ...validClose,
      closeComment: "",
    });
    expect(result.success).toBe(false);
  });
});

// ── approveExpenseSchema ───────────────────────────────────────────────────

describe("approveExpenseSchema", () => {
  it("accepts valid data without approvalNote", () => {
    const result = approveExpenseSchema.safeParse({
      expenseId: "expense-123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid data with approvalNote", () => {
    const result = approveExpenseSchema.safeParse({
      expenseId: "expense-123",
      approvalNote: "Looks good, approved for reimbursement",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing expenseId", () => {
    const result = approveExpenseSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty expenseId", () => {
    const result = approveExpenseSchema.safeParse({ expenseId: "" });
    expect(result.success).toBe(false);
  });
});
