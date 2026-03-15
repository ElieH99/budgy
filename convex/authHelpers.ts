import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { hasPermission, type Role, type Permission } from "../lib/permissions";
import type { ExpenseStatus } from "../lib/constants";
import { REJECTION_REASONS, CLOSE_REASONS, CURRENCY_CODES } from "../lib/constants";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Types ──────────────────────────────────────────────────────────────────

type Ctx = any; // Convex QueryCtx or MutationCtx — resolved at runtime
type Doc<T extends string> = any; // Convex Doc<T> — resolved after codegen

// ── Authentication ─────────────────────────────────────────────────────────

/**
 * Returns the authenticated user or throws ConvexError.
 * Must be the FIRST call in every mutation / query handler.
 */
export async function requireAuth(ctx: Ctx): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError("You must be logged in to perform this action");
  }

  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError("User not found");
  }

  return user;
}

// ── Authorisation ──────────────────────────────────────────────────────────

/**
 * Returns the authenticated user and verifies they have the given permission.
 * Throws if unauthenticated or the user's role lacks the permission.
 */
export async function requirePermission(
  ctx: Ctx,
  permission: Permission
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  if (!hasPermission(user.role as Role, permission)) {
    throw new ConvexError(
      `You do not have permission to perform this action (requires: ${permission})`
    );
  }
  return user;
}

// ── Expense Ownership ──────────────────────────────────────────────────────

/**
 * Returns the authenticated user and the expense, verifying the user owns it.
 * Throws if the expense doesn't exist or the user isn't the owner.
 */
export async function requireExpenseOwner(
  ctx: Ctx,
  expenseId: any
): Promise<{ user: Doc<"users">; expense: Doc<"expenses"> }> {
  const user = await requireAuth(ctx);
  const expense = await ctx.db.get(expenseId);
  if (!expense) {
    throw new ConvexError("Expense not found");
  }
  if (expense.submittedBy !== user._id) {
    throw new ConvexError("You can only perform this action on your own expenses");
  }
  return { user, expense };
}

// ── Status Guard ───────────────────────────────────────────────────────────

/**
 * Returns the expense if its status is one of the allowed statuses.
 * Throws if the expense doesn't exist or the status doesn't match.
 */
export async function requireExpenseStatus(
  ctx: Ctx,
  expenseId: any,
  ...allowedStatuses: ExpenseStatus[]
): Promise<Doc<"expenses">> {
  const expense = await ctx.db.get(expenseId);
  if (!expense) {
    throw new ConvexError("Expense not found");
  }
  if (!allowedStatuses.includes(expense.status)) {
    const labels = allowedStatuses.join(", ");
    throw new ConvexError(
      `This action requires the expense to be in one of these statuses: ${labels}. Current status: ${expense.status}`
    );
  }
  return expense;
}

// ── Self-Action Guard ──────────────────────────────────────────────────────

/**
 * Throws if the manager is trying to act on their own expense.
 */
export function requireNotOwnExpense(
  user: Doc<"users">,
  expense: Doc<"expenses">
): void {
  if (expense.submittedBy === user._id) {
    throw new ConvexError("You cannot perform this action on your own expense");
  }
}

// ── Input Validation Helpers ───────────────────────────────────────────────

/**
 * Validates that a rejection reason is from the allowed enum.
 */
export function validateRejectionReason(reason: string): void {
  if (!(REJECTION_REASONS as readonly string[]).includes(reason)) {
    throw new ConvexError(
      `Invalid rejection reason. Must be one of: ${REJECTION_REASONS.join(", ")}`
    );
  }
}

/**
 * Validates that a close reason is from the allowed enum.
 */
export function validateCloseReason(reason: string): void {
  if (!(CLOSE_REASONS as readonly string[]).includes(reason)) {
    throw new ConvexError(
      `Invalid close reason. Must be one of: ${CLOSE_REASONS.join(", ")}`
    );
  }
}

/**
 * Validates that a currency code is from the allowed ISO 4217 list.
 */
export function validateCurrencyCode(code: string): void {
  if (!(CURRENCY_CODES as readonly string[]).includes(code)) {
    throw new ConvexError(
      `Invalid currency code. Must be one of: ${CURRENCY_CODES.join(", ")}`
    );
  }
}

/**
 * Validates that an amount is a positive integer (stored as cents).
 */
export function validateAmount(amount: number): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new ConvexError("Amount must be a positive integer (in cents)");
  }
}

/**
 * Validates string length constraints.
 */
export function validateStringLength(
  value: string,
  fieldName: string,
  minLength: number,
  maxLength: number
): void {
  if (value.length < minLength) {
    throw new ConvexError(`${fieldName} must be at least ${minLength} characters`);
  }
  if (value.length > maxLength) {
    throw new ConvexError(`${fieldName} must be ${maxLength} characters or fewer`);
  }
}
