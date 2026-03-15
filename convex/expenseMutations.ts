import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getAuthenticatedUser, writeHistory } from "./expenseHelpers";
import {
  validateCurrencyCode,
  validateAmount,
  validateStringLength,
} from "./authHelpers";
import { ACCEPTED_RECEIPT_TYPES, MAX_RECEIPT_SIZE_BYTES } from "../lib/constants";

async function validateReceiptFile(ctx: any, storageId: string): Promise<void> {
  const metadata = await ctx.storage.getMetadata(storageId);
  if (!metadata) {
    throw new ConvexError("Receipt file not found in storage");
  }
  if (!(ACCEPTED_RECEIPT_TYPES as readonly string[]).includes(metadata.contentType ?? "")) {
    throw new ConvexError("Receipt must be a JPEG, PNG, or WEBP image");
  }
  if (metadata.size > MAX_RECEIPT_SIZE_BYTES) {
    throw new ConvexError("Receipt file must be under 5 MB");
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Create a new expense draft.
 */
export const createDraft = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    amount: v.number(),
    currencyCode: v.string(),
    categoryId: v.id("categories"),
    expenseDate: v.number(),
    notes: v.optional(v.string()),
    receiptStorageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    // Server-side input validation
    validateStringLength(args.title, "Title", 1, 200);
    validateStringLength(args.description, "Description", 1, 2000);
    validateAmount(args.amount);
    validateCurrencyCode(args.currencyCode);
    if (args.notes !== undefined) {
      validateStringLength(args.notes, "Notes", 0, 2000);
    }

    const now = Date.now();

    const expenseId = await ctx.db.insert("expenses", {
      submittedBy: user._id,
      status: "Draft",
      currentVersion: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Version 0 = working draft, snapshotted to version 1+ on submit
    await ctx.db.insert("expenseVersions", {
      expenseId,
      versionNumber: 0,
      title: args.title,
      description: args.description,
      amount: args.amount,
      currencyCode: args.currencyCode,
      categoryId: args.categoryId,
      expenseDate: args.expenseDate,
      receiptStorageId: args.receiptStorageId ?? "",
      notes: args.notes,
      submittedAt: now,
    });

    await writeHistory(ctx, {
      expenseId,
      changedBy: user._id,
      oldStatus: "",
      newStatus: "Draft",
      versionNumber: 0,
    });

    return expenseId;
  },
});

/**
 * Save/update a draft expense's mutable fields.
 */
export const saveDraft = mutation({
  args: {
    expenseId: v.id("expenses"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    amount: v.optional(v.number()),
    currencyCode: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    expenseDate: v.optional(v.number()),
    notes: v.optional(v.string()),
    receiptStorageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    const expense = await ctx.db.get(args.expenseId);
    if (!expense) throw new ConvexError("Expense not found");
    if (expense.submittedBy !== user._id) throw new ConvexError("You can only edit your own expenses");
    if (expense.status !== "Draft") throw new ConvexError("Only Draft expenses can be edited");

    // Server-side input validation for provided fields
    if (args.title !== undefined) validateStringLength(args.title, "Title", 1, 200);
    if (args.description !== undefined) validateStringLength(args.description, "Description", 1, 2000);
    if (args.amount !== undefined) validateAmount(args.amount);
    if (args.currencyCode !== undefined) validateCurrencyCode(args.currencyCode);
    if (args.notes !== undefined) validateStringLength(args.notes, "Notes", 0, 2000);

    const draftVersion = await ctx.db
      .query("expenseVersions")
      .withIndex("by_expenseId_versionNumber", (q: any) =>
        q.eq("expenseId", args.expenseId).eq("versionNumber", 0)
      )
      .unique();

    if (!draftVersion) throw new ConvexError("Draft data not found");

    const { expenseId, ...updates } = args;
    const patchData: Record<string, unknown> = {};
    if (updates.title !== undefined) patchData.title = updates.title;
    if (updates.description !== undefined) patchData.description = updates.description;
    if (updates.amount !== undefined) patchData.amount = updates.amount;
    if (updates.currencyCode !== undefined) patchData.currencyCode = updates.currencyCode;
    if (updates.categoryId !== undefined) patchData.categoryId = updates.categoryId;
    if (updates.expenseDate !== undefined) patchData.expenseDate = updates.expenseDate;
    if (updates.notes !== undefined) patchData.notes = updates.notes;
    if (updates.receiptStorageId !== undefined) patchData.receiptStorageId = updates.receiptStorageId;

    await ctx.db.patch(draftVersion._id, patchData);
    await ctx.db.patch(args.expenseId, { updatedAt: Date.now() });
  },
});

/**
 * Submit a draft expense — creates a version snapshot atomically.
 */
export const submitExpense = mutation({
  args: {
    expenseId: v.id("expenses"),
  },
  handler: async (ctx, { expenseId }) => {
    const user = await getAuthenticatedUser(ctx);
    const expense = await ctx.db.get(expenseId);
    if (!expense) throw new ConvexError("Expense not found");
    if (expense.submittedBy !== user._id) throw new ConvexError("You can only submit your own expenses");
    if (expense.status !== "Draft") throw new ConvexError("Only Draft expenses can be submitted");

    const draftVersion = await ctx.db
      .query("expenseVersions")
      .withIndex("by_expenseId_versionNumber", (q: any) =>
        q.eq("expenseId", expenseId).eq("versionNumber", 0)
      )
      .unique();

    if (!draftVersion) throw new ConvexError("Draft data not found");

    if (!draftVersion.receiptStorageId) {
      throw new ConvexError("Receipt is required for submission");
    }

    // Server-side receipt file type and size validation
    await validateReceiptFile(ctx, draftVersion.receiptStorageId);

    if (!draftVersion.title || !draftVersion.description || !draftVersion.amount || !draftVersion.currencyCode || !draftVersion.expenseDate) {
      throw new ConvexError("All required fields must be filled before submission");
    }

    // Validate data integrity at submission time
    validateAmount(draftVersion.amount);
    validateCurrencyCode(draftVersion.currencyCode);
    validateStringLength(draftVersion.title, "Title", 1, 200);
    validateStringLength(draftVersion.description, "Description", 1, 2000);

    const now = Date.now();
    const newVersion = expense.currentVersion + 1;

    await ctx.db.insert("expenseVersions", {
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
      submittedAt: now,
    });

    await ctx.db.patch(expenseId, {
      status: "Submitted",
      currentVersion: newVersion,
      updatedAt: now,
    });

    await writeHistory(ctx, {
      expenseId,
      changedBy: user._id,
      oldStatus: "Draft",
      newStatus: "Submitted",
      versionNumber: newVersion,
    });
  },
});

/**
 * Withdraw a submitted expense (only before manager review).
 */
export const withdrawExpense = mutation({
  args: {
    expenseId: v.id("expenses"),
  },
  handler: async (ctx, { expenseId }) => {
    const user = await getAuthenticatedUser(ctx);
    const expense = await ctx.db.get(expenseId);
    if (!expense) throw new ConvexError("Expense not found");
    if (expense.submittedBy !== user._id) throw new ConvexError("You can only withdraw your own expenses");
    if (expense.status !== "Submitted") {
      throw new ConvexError("Expenses can only be withdrawn before a manager has opened them");
    }

    await ctx.db.patch(expenseId, {
      status: "Withdrawn",
      updatedAt: Date.now(),
    });

    await writeHistory(ctx, {
      expenseId,
      changedBy: user._id,
      oldStatus: "Submitted",
      newStatus: "Withdrawn",
      versionNumber: expense.currentVersion,
    });
  },
});

/**
 * Edit a rejected expense — transitions to Draft for resubmission.
 */
export const editRejected = mutation({
  args: {
    expenseId: v.id("expenses"),
  },
  handler: async (ctx, { expenseId }) => {
    const user = await getAuthenticatedUser(ctx);
    const expense = await ctx.db.get(expenseId);
    if (!expense) throw new ConvexError("Expense not found");
    if (expense.submittedBy !== user._id) throw new ConvexError("You can only edit your own expenses");
    if (expense.status !== "Rejected") {
      throw new ConvexError("Only Rejected expenses can be edited for resubmission");
    }

    const currentVersionData = await ctx.db
      .query("expenseVersions")
      .withIndex("by_expenseId_versionNumber", (q: any) =>
        q.eq("expenseId", expenseId).eq("versionNumber", expense.currentVersion)
      )
      .unique();

    if (!currentVersionData) throw new ConvexError("Version data not found");

    const existingDraft = await ctx.db
      .query("expenseVersions")
      .withIndex("by_expenseId_versionNumber", (q: any) =>
        q.eq("expenseId", expenseId).eq("versionNumber", 0)
      )
      .unique();

    if (existingDraft) {
      await ctx.db.patch(existingDraft._id, {
        title: currentVersionData.title,
        description: currentVersionData.description,
        amount: currentVersionData.amount,
        currencyCode: currentVersionData.currencyCode,
        categoryId: currentVersionData.categoryId,
        expenseDate: currentVersionData.expenseDate,
        receiptStorageId: currentVersionData.receiptStorageId,
        notes: currentVersionData.notes,
      });
    } else {
      await ctx.db.insert("expenseVersions", {
        expenseId,
        versionNumber: 0,
        title: currentVersionData.title,
        description: currentVersionData.description,
        amount: currentVersionData.amount,
        currencyCode: currentVersionData.currencyCode,
        categoryId: currentVersionData.categoryId,
        expenseDate: currentVersionData.expenseDate,
        receiptStorageId: currentVersionData.receiptStorageId,
        notes: currentVersionData.notes,
        submittedAt: Date.now(),
      });
    }

    await ctx.db.patch(expenseId, {
      status: "Draft",
      updatedAt: Date.now(),
    });

    await writeHistory(ctx, {
      expenseId,
      changedBy: user._id,
      oldStatus: "Rejected",
      newStatus: "Draft",
      comment: "Employee started editing for resubmission",
      versionNumber: expense.currentVersion,
    });
  },
});

/**
 * Resubmit a previously rejected expense.
 * Functionally identical to submitExpense — unified internally.
 */
export const resubmitExpense = mutation({
  args: {
    expenseId: v.id("expenses"),
  },
  handler: async (ctx, { expenseId }) => {
    const user = await getAuthenticatedUser(ctx);
    const expense = await ctx.db.get(expenseId);
    if (!expense) throw new ConvexError("Expense not found");
    if (expense.submittedBy !== user._id) throw new ConvexError("You can only submit your own expenses");
    if (expense.status !== "Draft") throw new ConvexError("Only Draft expenses can be submitted");

    const draftVersion = await ctx.db
      .query("expenseVersions")
      .withIndex("by_expenseId_versionNumber", (q: any) =>
        q.eq("expenseId", expenseId).eq("versionNumber", 0)
      )
      .unique();

    if (!draftVersion) throw new ConvexError("Draft data not found");

    if (!draftVersion.receiptStorageId) {
      throw new ConvexError("Receipt is required for submission");
    }

    // Server-side receipt file type and size validation
    await validateReceiptFile(ctx, draftVersion.receiptStorageId);

    if (!draftVersion.title || !draftVersion.description || !draftVersion.amount || !draftVersion.currencyCode || !draftVersion.expenseDate) {
      throw new ConvexError("All required fields must be filled before submission");
    }

    // Validate data integrity at resubmission time
    validateAmount(draftVersion.amount);
    validateCurrencyCode(draftVersion.currencyCode);
    validateStringLength(draftVersion.title, "Title", 1, 200);
    validateStringLength(draftVersion.description, "Description", 1, 2000);

    const now = Date.now();
    const newVersion = expense.currentVersion + 1;

    await ctx.db.insert("expenseVersions", {
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
      submittedAt: now,
    });

    await ctx.db.patch(expenseId, {
      status: "Submitted",
      currentVersion: newVersion,
      updatedAt: now,
    });

    await writeHistory(ctx, {
      expenseId,
      changedBy: user._id,
      oldStatus: "Draft",
      newStatus: "Submitted",
      versionNumber: newVersion,
    });
  },
});
