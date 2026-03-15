import { query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";
import { hasPermission, type Role } from "../lib/permissions";
import { getAuthenticatedUser } from "./expenseHelpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Get all expenses for the current user (employee dashboard).
 */
export const getMyExpenses = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_submittedBy", (q: any) => q.eq("submittedBy", user._id))
      .collect();

    expenses.sort((a, b) => b.updatedAt - a.updatedAt);

    const results = await Promise.all(
      expenses.map(async (expense) => {
        const versionNumber = expense.currentVersion > 0 ? expense.currentVersion : 0;
        const version = await ctx.db
          .query("expenseVersions")
          .withIndex("by_expenseId_versionNumber", (q: any) =>
            q.eq("expenseId", expense._id).eq("versionNumber", versionNumber)
          )
          .unique();

        return {
          _id: expense._id,
          status: expense.status,
          currentVersion: expense.currentVersion,
          updatedAt: expense.updatedAt,
          createdAt: expense.createdAt,
          title: version?.title ?? "",
          amount: version?.amount ?? 0,
          currencyCode: version?.currencyCode ?? "",
          categoryId: version?.categoryId,
          expenseDate: version?.expenseDate,
        };
      })
    );

    return results;
  },
});

/**
 * Get full expense detail including all versions and history.
 */
export const getExpenseDetail = query({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, { expenseId }) => {
    const user = await getAuthenticatedUser(ctx);
    const expense = await ctx.db.get(expenseId);
    if (!expense) throw new ConvexError("Expense not found");

    if (user.role === "employee" && expense.submittedBy !== user._id) {
      throw new ConvexError("You do not have permission to view this expense");
    }

    const allVersions = await ctx.db
      .query("expenseVersions")
      .withIndex("by_expenseId", (q: any) => q.eq("expenseId", expenseId))
      .collect();

    const submittedVersions = allVersions
      .filter((v) => v.versionNumber > 0)
      .sort((a, b) => a.versionNumber - b.versionNumber);

    const draftVersion = allVersions.find((v) => v.versionNumber === 0) ?? null;

    const history = await ctx.db
      .query("expenseHistory")
      .withIndex("by_expenseId", (q: any) => q.eq("expenseId", expenseId))
      .collect();

    history.sort((a, b) => a.changedAt - b.changedAt);

    // Resolve user names
    const userIds = new Set<string>();
    userIds.add(expense.submittedBy);
    if (expense.approvedBy) userIds.add(expense.approvedBy);
    if (expense.rejectedBy) userIds.add(expense.rejectedBy);
    if (expense.closedBy) userIds.add(expense.closedBy);
    history.forEach((h) => userIds.add(h.changedBy));

    const usersMap: Record<string, { firstName: string; lastName: string }> = {};
    for (const id of userIds) {
      const u = await ctx.db.get(id as Id<"users">);
      if (u) {
        usersMap[id] = { firstName: u.firstName, lastName: u.lastName };
      }
    }

    // Resolve category names
    const categoryIds = new Set<string>();
    allVersions.forEach((v) => categoryIds.add(v.categoryId));
    const categoriesMap: Record<string, string> = {};
    for (const id of categoryIds) {
      const cat = await ctx.db.get(id as Id<"categories">);
      if (cat) categoriesMap[id] = cat.name;
    }

    return {
      expense: {
        ...expense,
        submittedByName: usersMap[expense.submittedBy],
        approvedByName: expense.approvedBy ? usersMap[expense.approvedBy] : null,
        rejectedByName: expense.rejectedBy ? usersMap[expense.rejectedBy] : null,
        closedByName: expense.closedBy ? usersMap[expense.closedBy] : null,
      },
      draftVersion,
      versions: submittedVersions.map((v) => ({
        ...v,
        categoryName: categoriesMap[v.categoryId] ?? "Unknown",
      })),
      history: history.map((h) => ({
        ...h,
        changedByName: usersMap[h.changedBy] ?? { firstName: "Unknown", lastName: "" },
      })),
      usersMap,
      categoriesMap,
    };
  },
});

/**
 * Manager pending queue — submitted/under-review expenses (excluding own).
 */
export const getPendingQueue = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    if (!hasPermission(user.role as Role, "expense:approve")) {
      throw new ConvexError("You do not have permission to view the pending queue");
    }

    const submitted = await ctx.db
      .query("expenses")
      .withIndex("by_status", (q: any) => q.eq("status", "Submitted"))
      .collect();

    const underReview = await ctx.db
      .query("expenses")
      .withIndex("by_status", (q: any) => q.eq("status", "UnderReview"))
      .collect();

    const pending = [...submitted, ...underReview].filter(
      (e) => e.submittedBy !== user._id
    );

    const results = await Promise.all(
      pending.map(async (expense) => {
        const version = await ctx.db
          .query("expenseVersions")
          .withIndex("by_expenseId_versionNumber", (q: any) =>
            q.eq("expenseId", expense._id).eq("versionNumber", expense.currentVersion)
          )
          .unique();

        const submitter = await ctx.db.get(expense.submittedBy as Id<"users">);

        return {
          _id: expense._id,
          status: expense.status,
          currentVersion: expense.currentVersion,
          submittedBy: expense.submittedBy,
          submitterName: submitter
            ? `${submitter.firstName} ${submitter.lastName}`
            : "Unknown",
          title: version?.title ?? "",
          amount: version?.amount ?? 0,
          currencyCode: version?.currencyCode ?? "",
          categoryId: version?.categoryId,
          submittedAt: version?.submittedAt ?? expense.createdAt,
          updatedAt: expense.updatedAt,
        };
      })
    );

    results.sort((a, b) => a.submittedAt - b.submittedAt);

    return results;
  },
});

/**
 * Manager reviewed history — approved, rejected, closed expenses.
 */
export const getReviewedHistory = query({
  args: {
    statusFilter: v.optional(v.string()),
    categoryFilter: v.optional(v.id("categories")),
    employeeFilter: v.optional(v.id("users")),
  },
  handler: async (ctx, { statusFilter, categoryFilter, employeeFilter }) => {
    const user = await getAuthenticatedUser(ctx);

    if (!hasPermission(user.role as Role, "expense:approve")) {
      throw new ConvexError("You do not have permission to view reviewed history");
    }

    let expenses: any[] = [];

    if (!statusFilter || statusFilter === "Approved") {
      const approved = await ctx.db
        .query("expenses")
        .withIndex("by_status", (q: any) => q.eq("status", "Approved"))
        .collect();
      expenses.push(...approved);
    }
    if (!statusFilter || statusFilter === "Rejected") {
      const rejected = await ctx.db
        .query("expenses")
        .withIndex("by_status", (q: any) => q.eq("status", "Rejected"))
        .collect();
      expenses.push(...rejected);
    }
    if (!statusFilter || statusFilter === "Closed") {
      const closed = await ctx.db
        .query("expenses")
        .withIndex("by_status", (q: any) => q.eq("status", "Closed"))
        .collect();
      expenses.push(...closed);
    }

    // Exclude the manager's own expenses
    expenses = expenses.filter((e) => e.submittedBy !== user._id);

    if (employeeFilter) {
      expenses = expenses.filter((e) => e.submittedBy === employeeFilter);
    }

    expenses.sort((a, b) => b.updatedAt - a.updatedAt);

    const results = await Promise.all(
      expenses.map(async (expense) => {
        const version = await ctx.db
          .query("expenseVersions")
          .withIndex("by_expenseId_versionNumber", (q: any) =>
            q.eq("expenseId", expense._id).eq("versionNumber", expense.currentVersion)
          )
          .unique();

        if (categoryFilter && version?.categoryId !== categoryFilter) {
          return null;
        }

        const submitter = await ctx.db.get(expense.submittedBy as Id<"users">);

        return {
          _id: expense._id,
          status: expense.status,
          currentVersion: expense.currentVersion,
          submittedBy: expense.submittedBy,
          submitterName: submitter
            ? `${submitter.firstName} ${submitter.lastName}`
            : "Unknown",
          title: version?.title ?? "",
          amount: version?.amount ?? 0,
          currencyCode: version?.currencyCode ?? "",
          categoryId: version?.categoryId,
          updatedAt: expense.updatedAt,
          approvedAt: expense.approvedAt,
          rejectedAt: expense.rejectedAt,
          closedAt: expense.closedAt,
        };
      })
    );

    return results.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

/**
 * Manager dashboard stats.
 */
export const getManagerStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    if (!hasPermission(user.role as Role, "expense:approve")) {
      throw new ConvexError("You do not have permission to view manager stats");
    }

    const submitted = await ctx.db
      .query("expenses")
      .withIndex("by_status", (q: any) => q.eq("status", "Submitted"))
      .collect();
    const underReview = await ctx.db
      .query("expenses")
      .withIndex("by_status", (q: any) => q.eq("status", "UnderReview"))
      .collect();

    const pending = [...submitted, ...underReview].filter(
      (e) => e.submittedBy !== user._id
    ).length;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const approved = await ctx.db
      .query("expenses")
      .withIndex("by_status", (q: any) => q.eq("status", "Approved"))
      .collect();
    const approvedThisMonthExpenses = approved.filter(
      (e) => e.approvedAt && e.approvedAt >= monthStart
    );
    const approvedThisMonth = approvedThisMonthExpenses.length;

    // Compute total approved budget this month by summing version amounts
    let approvedBudgetThisMonth = 0;
    for (const expense of approvedThisMonthExpenses) {
      const version = await ctx.db
        .query("expenseVersions")
        .withIndex("by_expenseId_versionNumber", (q: any) =>
          q.eq("expenseId", expense._id).eq("versionNumber", expense.currentVersion)
        )
        .unique();
      approvedBudgetThisMonth += version?.amount ?? 0;
    }

    const rejected = await ctx.db
      .query("expenses")
      .withIndex("by_status", (q: any) => q.eq("status", "Rejected"))
      .collect();
    const rejectedThisMonth = rejected.filter(
      (e) => e.rejectedAt && e.rejectedAt >= monthStart
    ).length;

    const closed = await ctx.db
      .query("expenses")
      .withIndex("by_status", (q: any) => q.eq("status", "Closed"))
      .collect();
    const totalUnderManagement =
      submitted.length + underReview.length + approved.length + rejected.length + closed.length;

    return {
      pending,
      approvedThisMonth,
      approvedBudgetThisMonth,
      rejectedThisMonth,
      closedCount: closed.length,
      submittedCount: submitted.length,
      underReviewCount: underReview.length,
      totalUnderManagement,
    };
  },
});
