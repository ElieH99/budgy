# Contributing Guide

This guide covers conventions, patterns, and requirements for engineers extending or maintaining the expense tracker.

Read [CLAUDE.md](../CLAUDE.md) first — it is the authoritative requirements document and defines what is in and out of scope for v1.

---

## Code Style

- **TypeScript strict** — all files are `.ts` or `.tsx`. Zero `any` in new code (existing uses are intentional workarounds for Convex query builder typing).
- **No new libraries** without explicit discussion. The approved stack is fixed (see CLAUDE.md §2). If you think a library is needed, flag it — don't add it silently.
- **Tailwind only** — no custom CSS files. Use utility classes.
- **shadcn/ui first** — before writing any custom UI element, check if a shadcn primitive exists. Use the nearest primitive and compose from there.

---

## Where Validation Lives

**All input validation is in [`lib/validators.ts`](../lib/validators.ts).** This is the single source of truth.

- Client-side React Hook Form validation uses these Zod schemas
- Convex server functions use these schemas (or the underlying validators in `convex/authHelpers.ts` for low-level field checks)

**Do not duplicate validation.** If you add a new field to an expense form, add it to the shared schema and use it in both places.

---

## Where Permissions Live

**All role-to-permission mappings are in [`lib/permissions.ts`](../lib/permissions.ts).**

```ts
// Correct — always go through hasPermission()
if (!hasPermission(user.role as Role, "expense:approve")) {
  throw new ConvexError("You do not have permission to approve expenses");
}

// Wrong — never hardcode role checks in business logic
if (user.role !== "manager") { ... }
```

If you add a new action that requires a permission check, add the permission to `Permission` type and the role mapping in `ROLE_PERMISSIONS`, then use `hasPermission()` in the mutation.

---

## How to Add a New Status Transition

Status transitions touch multiple layers. Follow this checklist in order:

1. **Schema** — If you need a new status value, add it to `schema.ts` and to `EXPENSE_STATUSES` in `lib/constants.ts`.

2. **Mutation** — Write the mutation in `convex/expenseMutations.ts` (employee actions) or `convex/expenseManagerMutations.ts` (manager actions). Follow the existing pattern:
   - Call `getAuthenticatedUser(ctx)` first
   - Check permissions via `hasPermission()` if manager-only
   - Fetch and validate the expense
   - Check `expense.submittedBy === user._id` if the action is manager-only
   - Validate the new status is reachable from the current status
   - `ctx.db.patch(expenseId, { status: newStatus, updatedAt: now })`
   - Call `writeHistory(ctx, { ... })` — always, for every transition

3. **History** — `writeHistory()` in `convex/expenseHelpers.ts` handles the append. Call it with `oldStatus`, `newStatus`, `versionNumber`, and an optional `comment`.

4. **UI** — Add the action button in the relevant component (`ExpenseDetailModal.tsx` for employee actions, `ReviewModal.tsx` for manager actions). Status badge colours are defined in `components/expenses/StatusBadge.tsx` and must follow the colour reference in CLAUDE.md §8.

5. **Permissions** — If the new action requires a permission, add it to `lib/permissions.ts`.

6. **Tests** — Add a unit test for the new transition in `tests/integration/statusMachine.test.ts`.

---

## Append-Only Tables

`expenseVersions` and `expenseHistory` are **never updated or deleted**. If you find yourself patching a history row, you are doing something wrong. Add a new row instead.

---

## Running the Test Suite

Run all tests before opening a PR:

```bash
# Unit and integration tests
npm run test

# End-to-end tests (requires the app to be running)
npx convex dev   # in one terminal
npm run dev      # in another terminal
npx playwright test

# View the Playwright HTML report
npx playwright show-report
```

CI runs unit and integration tests automatically on every push (`.github/workflows/test.yml`). E2E tests require a live Convex deployment and are not currently in CI.

---

## Seeding the Database

The seed script is idempotent — safe to run multiple times:

```bash
# Local
npx convex run seed:seed

# Production
npx convex run seed:seed --prod
```

This creates the 7 categories and 4 test accounts (see CLAUDE.md §7). Do not delete or rename these accounts — E2E tests depend on their exact credentials.

---

## Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add bulk export for approved expenses
fix: prevent withdrawal after UnderReview
docs: add troubleshooting section to README
refactor: extract status transition helpers
test: add E2E spec for manager close flow
```

Keep commits focused. One logical change per commit.

---

## Before Opening a PR

- [ ] `next build` passes with zero TypeScript errors
- [ ] `npm run test` passes (all unit and integration tests green)
- [ ] New mutations call `writeHistory()` on every status change
- [ ] New manager actions check `expense.submittedBy === user._id`
- [ ] Validation is in `lib/validators.ts`, not duplicated inline
- [ ] No new libraries added without discussion
- [ ] shadcn/ui used for any new UI elements
