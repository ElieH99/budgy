import { internalMutation } from "./_generated/server";

const CATEGORIES = [
  {
    name: "Travel",
    description: "Flights, trains, buses for business purposes",
  },
  {
    name: "Accommodation",
    description: "Hotels and short-term lodging",
  },
  {
    name: "Meals & Entertainment",
    description: "Client lunches, team dinners, business meals",
  },
  {
    name: "Transportation",
    description: "Taxis, rideshares, fuel, parking",
  },
  {
    name: "Software & Subscriptions",
    description: "Tools, licenses, SaaS subscriptions",
  },
  {
    name: "Office Supplies",
    description: "Hardware accessories, stationery",
  },
  {
    name: "Other",
    description: "Expenses not covered by other categories",
  },
] as const;

const TEST_ACCOUNTS = [
  {
    firstName: "Miles",
    lastName: "Morales",
    email: "miles@employee.dev",
    role: "employee" as const,
  },
  {
    firstName: "Jack",
    lastName: "Black",
    email: "jack@manager.dev",
    role: "manager" as const,
  },
] as const;

/**
 * Seed categories and test user accounts.
 * Idempotent — safe to run multiple times.
 *
 * Usage: npx convex run seed
 */
export const seed = internalMutation({
  args: {},
  // Handler types are fully inferred once `npx convex dev` generates typed bindings
  handler: async (ctx: { db: any }) => {
    // ── Seed Categories (upsert by name) ──────────────────────────────────
    for (const category of CATEGORIES) {
      const existing = await ctx.db
        .query("categories")
        .withIndex("by_name", (q: any) => q.eq("name", category.name))
        .unique();

      if (!existing) {
        await ctx.db.insert("categories", {
          name: category.name,
          description: category.description,
        });
      }
    }

    // ── Seed Test User Accounts ───────────────────────────────────────────
    for (const account of TEST_ACCOUNTS) {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_email", (q: any) => q.eq("email", account.email))
        .unique();

      if (!existing) {
        await ctx.db.insert("users", {
          firstName: account.firstName,
          lastName: account.lastName,
          email: account.email,
          role: account.role,
          createdAt: Date.now(),
        });
      }
    }

    return { success: true, message: "Seed complete" };
  },
});

export default seed;
