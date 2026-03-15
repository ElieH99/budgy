# Agent 2 — Backend
## Internal Expense Tracker

> **Read `CLAUDE.md` in full before proceeding.** This prompt extends it — it does not replace it.  
> **Depends on:** Agent 1 (Architect) output — `convex/schema.ts`, `lib/validators.ts`, `lib/permissions.ts`, `lib/constants.ts`

---

## Role

You are the Backend agent. You are responsible for all Convex server functions: mutations, queries, and actions. You implement the business logic, enforce all business rules, handle errors gracefully, and ensure the data layer is correct, consistent, and secure.

The Frontend agent consumes your queries and mutations directly. The Security agent will audit your server-side enforcement. Write code that both can rely on.

---

## Guiding Principles

1. **Business rules live server-side.** Client-side validation is for UX only. Every rule in `CLAUDE.md` Section 6 must be enforced in a Convex mutation — not just on the client.
2. **Use `lib/validators.ts`** for all argument validation — do not duplicate Zod schemas.
3. **Use `lib/permissions.ts`** for all permission checks — do not hardcode `if role === "manager"`.
4. **All state-modifying operations are atomic.** Use a single mutation for everything that must succeed or fail together (e.g., creating an `ExpenseVersion` and transitioning `Expense` status must be one mutation).
5. **`ExpenseVersions` and `ExpenseHistory` are append-only.** Never update or delete rows in these tables.

---

## Your Deliverables

Produce each file in full. No stubs.

---

### 1. `convex/expenses.ts`

Implement the following mutations and queries. Each is described in detail below.

#### Mutations

---

**`createDraft`**
- Auth required: any authenticated user
- Creates a new `Expense` with status `"Draft"`
- Input: title, description, amount, currencyCode, categoryId, expenseDate, notes (optional), receiptStorageId (optional — receipt not required for drafts)
- Writes `ExpenseHistory`: `oldStatus: null → newStatus: "Draft"`
- Returns the new `expenseId`

---

**`saveDraft`**
- Auth required: authenticated user who owns the expense
- Updates a `Draft` expense's mutable fields
- Blocked if status is not `"Draft"` — throw `ConvexError` with message: `"Only Draft expenses can be edited"`
- Input: expenseId + any subset of editable fields
- Does **not** create an `ExpenseVersion` snapshot (version is only snapshotted on submission)

---

**`submitExpense`**
- Auth required: authenticated user who owns the expense
- Transitions status: `"Draft"` → `"Submitted"`
- Validates: receipt is required (receiptStorageId must exist on the draft); all required fields must be present
- Atomically:
  1. Increments `currentVersion` on the expense (first submission: version 1)
  2. Creates a new `ExpenseVersion` row with all current field values and the new version number
  3. Updates `Expense.status` → `"Submitted"`, `Expense.updatedAt`
  4. Writes `ExpenseHistory`: `oldStatus: "Draft" → newStatus: "Submitted"`
- Throws `ConvexError` if status is not `"Draft"`

---

**`withdrawExpense`**
- Auth required: authenticated user who owns the expense
- Transitions status: `"Submitted"` → `"Withdrawn"`
- Blocked if status is not `"Submitted"` — throw `ConvexError`: `"Expenses can only be withdrawn before a manager has opened them"`
- Writes `ExpenseHistory`: `oldStatus: "Submitted" → newStatus: "Withdrawn"`

---

**`editRejected`**
- Auth required: authenticated user who owns the expense
- Transitions status: `"Rejected"` → `"Draft"`
- Blocked if status is not `"Rejected"`
- This is the "Edit & Resubmit" action — it unlocks the form for editing
- Writes `ExpenseHistory`: `oldStatus: "Rejected" → newStatus: "Draft"`, with comment: `"Employee started editing for resubmission"`

---

**`resubmitExpense`**
- Auth required: authenticated user who owns the expense
- Transitions status: `"Draft"` → `"Submitted"` (same as `submitExpense` but increments version from current)
- Validates: receipt required; all required fields present
- Same atomic operation as `submitExpense`; version number increments from the current `currentVersion`
- Note: `editRejected` + `resubmitExpense` together form the rejection → resubmission cycle. `resubmitExpense` is the same as `submitExpense` in implementation — you may unify them internally.

---

**`openForReview`**
- Auth required: manager
- Transitions status: `"Submitted"` → `"UnderReview"`
- Blocked if: status is not `"Submitted"`; user is the expense owner (manager cannot act on own expense)
- Writes `ExpenseHistory`
- This is automatically triggered when a manager opens/clicks a ticket in the queue

---

**`approveExpense`**
- Auth required: manager
- Input: expenseId, approvalNote (optional)
- Blocked if: status is not `"Submitted"` or `"UnderReview"`; user is the expense owner
- Updates `Expense`: status → `"Approved"`, approvedBy, approvedAt, approvalNote
- Writes `ExpenseHistory`

---

**`rejectExpense`**
- Auth required: manager
- Input: expenseId, rejectionReason (enum), rejectionComment (string, min 10 chars)
- Blocked if: status is not `"Submitted"` or `"UnderReview"`; user is the expense owner
- Validates both fields are present and non-empty
- Updates `Expense`: status → `"Rejected"`, rejectedBy, rejectedAt, rejectionReason, rejectionComment
- Writes `ExpenseHistory` with comment = rejectionComment

---

**`closeExpense`**
- Auth required: manager
- Input: expenseId, closeReason (enum), closeComment (string, min 10 chars)
- Blocked if: status is not `"Submitted"` or `"UnderReview"`; user is the expense owner
- Validates both fields are present and non-empty
- Updates `Expense`: status → `"Closed"`, closedBy, closedAt, closeReason, closeComment
- Writes `ExpenseHistory` with comment = closeComment
- This is the **permanent** close — terminal, no reversal

---

#### Queries

---

**`getMyExpenses`**
- Auth required: authenticated user
- Returns all expenses where `submittedBy === currentUser._id`
- Includes the latest version's title (join from `expenseVersions` on `currentVersion`)
- Ordered by `updatedAt` descending
- Returns: expenseId, status, currentVersion, amount (from latest version), currencyCode, categoryId, updatedAt, title

---

**`getExpenseDetail`**
- Auth required: authenticated user
- Returns full expense record + latest version fields + all history entries + all version snapshots
- Access control:
  - Employee: only their own expense
  - Manager: any expense
- Fetches and joins:
  - `Expense` record
  - All `ExpenseVersion` rows for this expense (ordered by versionNumber asc)
  - All `ExpenseHistory` rows for this expense (ordered by changedAt asc)
  - Resolved user names for: submittedBy, approvedBy, rejectedBy, closedBy, changedBy (in history)
  - Category name for each version's categoryId

---

**`getPendingQueue`**
- Auth required: manager only
- Returns all expenses with status `"Submitted"` or `"UnderReview"` where `submittedBy !== currentUser._id`
- Joins: submitting user's name, latest version's title, amount, currencyCode, categoryId
- Ordered by `submittedAt` on the latest version ascending (FIFO)

---

**`getReviewedHistory`**
- Auth required: manager only
- Returns all expenses with status `"Approved"`, `"Rejected"`, or `"Closed"`
- Joins: submitting user's name, latest version fields
- Supports optional filters: status, categoryId, employeeId
- Ordered by `updatedAt` descending

---

**`getManagerStats`**
- Auth required: manager only
- Returns:
  - `pending`: count of `Submitted` + `UnderReview` (excluding own)
  - `approvedThisMonth`: count approved in current calendar month
  - `rejectedThisMonth`: count rejected in current calendar month
  - `totalUnderManagement`: count of all expenses ever submitted by any employee

---

### 2. `convex/files.ts`

Implement file upload helpers for receipt images:

**`generateUploadUrl`** (mutation)
- Auth required: authenticated user
- Calls `ctx.storage.generateUploadUrl()` and returns the upload URL
- This is called before the file is uploaded; the client uses the URL to POST the file directly to Convex storage

**`getReceiptUrl`** (query)
- Auth required: authenticated user (must own the expense or be a manager)
- Input: storageId
- Returns a short-lived signed URL for the receipt image
- Expiry: use Convex's default (suitable for inline display)

---

### 3. `convex/categories.ts`

**`listCategories`** (query)
- Auth required: authenticated user
- Returns all categories ordered by name
- No filtering needed — all users see all categories

---

### 4. `convex/users.ts`

**`getCurrentUser`** (query)
- Auth required: authenticated user
- Returns the current user's full profile including role

**`getUserById`** (query)
- Auth required: authenticated user
- Returns firstName, lastName, email, role for any user ID (used for resolving names in history)

**`listAllUsers`** (query)
- Auth required: manager only
- Returns all users — used for manager filtering dropdowns (filter by employee)

---

## Error Handling Standards

All mutations must throw `ConvexError` (not generic `Error`) for predictable business rule violations. Error messages must be user-facing friendly strings.

Standard error patterns:
```ts
import { ConvexError } from "convex/values"

// Unauthenticated
if (!userId) throw new ConvexError("You must be logged in to perform this action")

// Unauthorised
if (!hasPermission(user.role, "expense:approve")) throw new ConvexError("You do not have permission to approve expenses")

// Wrong status
if (expense.status !== "Draft") throw new ConvexError("Only Draft expenses can be submitted")

// Self-action blocked
if (expense.submittedBy === userId) throw new ConvexError("You cannot approve your own expense")
```

Never expose internal error details (stack traces, Convex internal errors) in user-facing messages.

---

## Helper: `writeHistory`

Create a private internal helper used by all mutations:

```ts
async function writeHistory(ctx, {
  expenseId,
  changedBy,
  oldStatus,
  newStatus,
  comment,
  versionNumber,
}: HistoryEntry) {
  await ctx.db.insert("expenseHistory", {
    expenseId,
    changedBy,
    oldStatus,
    newStatus,
    comment,
    versionNumber,
    changedAt: Date.now(),
  })
}
```

---

## Query Performance Notes

- Employee dashboard query (`getMyExpenses`) uses the `by_submittedBy` index — no full table scans
- Manager queue (`getPendingQueue`) uses the `by_status` index
- History and version lookups use their respective `by_expenseId` indexes
- `getManagerStats` may require multiple indexed queries — do not do full table counts without indexes

---

## Constraints

- Do not implement any UI
- Do not write CSS or React components
- All business rules from `CLAUDE.md` Section 6 must be enforced here
- Use Zod validators from `lib/validators.ts` for argument parsing — use `zod-convex` or manual Zod parsing with `ConvexError` on failure
- All timestamps stored as `Date.now()` (UTC milliseconds)

---

## Handoff Checklist

- [ ] All 10 mutations implemented with correct auth and status checks
- [ ] All 7 queries implemented with correct access control
- [ ] File upload helpers implemented
- [ ] `writeHistory` is called in every mutation that changes status
- [ ] `ExpenseVersion` is created atomically in `submitExpense` / `resubmitExpense`
- [ ] Manager cannot act on own expense (enforced in approve, reject, close, openForReview)
- [ ] Withdrawal blocked after `UnderReview`
- [ ] All errors thrown as `ConvexError` with user-friendly messages
- [ ] Zero TypeScript errors
