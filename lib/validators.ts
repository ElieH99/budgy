import { z } from "zod";
import {
  REJECTION_REASONS,
  CLOSE_REASONS,
  CURRENCY_CODES,
} from "./constants";

// ── Expense Form Schema ─────────────────────────────────────────────────────
// Used for creating and editing expense drafts

export const expenseFormSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or fewer"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(2000, "Description must be 2000 characters or fewer"),
  amount: z
    .number({ error: "Amount is required" })
    .positive("Amount must be greater than zero")
    .finite("Amount must be a finite number")
    .multipleOf(0.01, "Amount cannot have more than 2 decimal places"),
  currencyCode: z.enum(CURRENCY_CODES, {
    error: "Currency is required",
  }),
  categoryId: z.string().min(1, "Category is required"),
  expenseDate: z.number({ error: "Expense date is required" }),
  notes: z.string().max(2000, "Notes must be 2000 characters or fewer").optional(),
  receiptStorageId: z.string().optional(),
});

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

// ── Submit Expense Schema ───────────────────────────────────────────────────
// Extends form schema — receipt is required for submission

export const submitExpenseSchema = expenseFormSchema.extend({
  receiptStorageId: z.string().min(1, "Receipt is required for submission"),
});

export type SubmitExpenseValues = z.infer<typeof submitExpenseSchema>;

// ── Reject Expense Schema ───────────────────────────────────────────────────

export const rejectExpenseSchema = z.object({
  expenseId: z.string().min(1, "Expense ID is required"),
  rejectionReason: z.enum(REJECTION_REASONS, {
    error: "Rejection reason is required",
  }),
  rejectionComment: z
    .string()
    .min(10, "Rejection comment must be at least 10 characters")
    .max(2000, "Rejection comment must be 2000 characters or fewer"),
});

export type RejectExpenseValues = z.infer<typeof rejectExpenseSchema>;

// ── Close Expense Schema ────────────────────────────────────────────────────

export const closeExpenseSchema = z.object({
  expenseId: z.string().min(1, "Expense ID is required"),
  closeReason: z.enum(CLOSE_REASONS, {
    error: "Close reason is required",
  }),
  closeComment: z
    .string()
    .min(10, "Close comment must be at least 10 characters")
    .max(2000, "Close comment must be 2000 characters or fewer"),
});

export type CloseExpenseValues = z.infer<typeof closeExpenseSchema>;

// ── Approve Expense Schema ──────────────────────────────────────────────────

export const approveExpenseSchema = z.object({
  expenseId: z.string().min(1, "Expense ID is required"),
  approvalNote: z
    .string()
    .max(2000, "Approval note must be 2000 characters or fewer")
    .optional(),
});

export type ApproveExpenseValues = z.infer<typeof approveExpenseSchema>;

// ── Withdraw Expense Schema ─────────────────────────────────────────────────

export const withdrawExpenseSchema = z.object({
  expenseId: z.string().min(1, "Expense ID is required"),
});

export type WithdrawExpenseValues = z.infer<typeof withdrawExpenseSchema>;

// ── User Profile Schema ─────────────────────────────────────────────────────

export const userProfileSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(100, "First name must be 100 characters or fewer"),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(100, "Last name must be 100 characters or fewer"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
});

export type UserProfileValues = z.infer<typeof userProfileSchema>;
