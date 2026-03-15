# Agent 5 — Security
## Internal Expense Tracker

> **Read `CLAUDE.md` in full before proceeding.** This prompt extends it — it does not replace it.  
> **Depends on:** Agent 1 (Architect) and Agent 2 (Backend) outputs.

---

## Role

You are the Security agent. Your responsibility is to audit, enforce, and harden all security controls in the application: server-side authorisation, input validation, data protection, file handling, and audit trail integrity. You review the Backend agent's Convex mutations and queries and produce both a security review report and any corrective code.

You do not build UI. You do not build business logic from scratch. You verify that what was built is secure, and you fix what is not.

---

## Security Surface Areas

### 1. Authentication Enforcement

Every Convex mutation and query must check authentication before doing anything else. Unauthenticated requests must fail immediately.

**Audit checklist — for every mutation and query in `convex/expenses.ts`, `convex/users.ts`, `convex/categories.ts`, `convex/files.ts`:**

- [ ] The function calls `await ctx.auth.getUserIdentity()` (or equivalent Convex Auth method) as its first operation
- [ ] If identity is `null`, the function throws `ConvexError("You must be logged in to perform this action")` and does nothing else
- [ ] No data is returned or modified before the auth check passes

Produce a table listing every function, its auth requirement, and whether it passes the audit. Flag any that do not.

---

### 2. Authorisation — Role-Based Access Control

Authentication proves *who* you are. Authorisation proves *what you're allowed to do*. Both must be enforced server-side.

**Rules to verify in every mutation:**

| Mutation | Auth Required | Additional Check |
|---|---|---|
| `createDraft` | Any authenticated user | None |
| `saveDraft` | Authenticated, expense owner | `expense.submittedBy === currentUser._id` |
| `submitExpense` | Authenticated, expense owner | `expense.submittedBy === currentUser._id` |
| `withdrawExpense` | Authenticated, expense owner | `expense.submittedBy === currentUser._id`; status must be `"Submitted"` |
| `editRejected` | Authenticated, expense owner | `expense.submittedBy === currentUser._id`; status must be `"Rejected"` |
| `resubmitExpense` | Authenticated, expense owner | `expense.submittedBy === currentUser._id` |
| `openForReview` | Manager only | `user.role === "manager"`; `expense.submittedBy !== currentUser._id` |
| `approveExpense` | Manager only | `user.role === "manager"`; `expense.submittedBy !== currentUser._id` |
| `rejectExpense` | Manager only | `user.role === "manager"`; `expense.submittedBy !== currentUser._id` |
| `closeExpense` | Manager only | `user.role === "manager"`; `expense.submittedBy !== currentUser._id` |

| Query | Auth Required | Access Scope |
|---|---|---|
| `getMyExpenses` | Authenticated | Own expenses only (`submittedBy === self`) |
| `getExpenseDetail` | Authenticated | Employee: own only; Manager: any |
| `getPendingQueue` | Manager only | All non-own submitted/under-review |
| `getReviewedHistory` | Manager only | All actioned expenses |
| `getManagerStats` | Manager only | Aggregate counts |
| `listCategories` | Authenticated | Public data — no restriction needed |
| `getCurrentUser` | Authenticated | Own user only |
| `getUserById` | Authenticated | Limited fields (no password hash) |
| `listAllUsers` | Manager only | Used for filter dropdowns |
| `generateUploadUrl` | Authenticated | Any authenticated user |
| `getReceiptUrl` | Authenticated | Employee: own expense; Manager: any |

For each query, verify: if an employee manually constructs a query argument with another user's `expenseId`, the query returns an error or empty result — not the other user's data.

---

### 3. Input Validation — Server-Side is Authoritative

Client-side validation is UX. Server-side validation is security. Both must exist; server-side never trusts client-side.

**For every mutation, verify:**

- [ ] All string inputs are length-constrained (no unbounded text fields)
- [ ] `rejectionComment` and `closeComment` are validated `min(10)` characters server-side
- [ ] `rejectionReason` and `closeReason` are validated against their respective enums — arbitrary strings are rejected
- [ ] `amount` is validated as a positive number — negative amounts are rejected
- [ ] `currencyCode` is validated against the allowed ISO 4217 list — arbitrary strings are rejected
- [ ] `expenseId` is validated as a real `Id<"expenses">` that exists in the database — non-existent IDs throw an error, not a silent `undefined`

**Produce:** A list of any fields that are not validated server-side with specific remediation steps.

---

### 4. File Upload Security

Receipt images are user-controlled input. Validate both at upload time and at serve time.

**Upload-time checks (in the mutation that stores the receipt reference):**
- [ ] File type validation: verify the uploaded file's MIME type is `image/jpeg`, `image/png`, or `image/webp` — do not trust the client-provided filename extension alone
- [ ] File size validation: verify file size ≤ 5,242,880 bytes (5 MB) server-side — client-side check is UX only
- [ ] Files are stored in Convex file storage, not in a publicly accessible URL without a signed token

**Serve-time checks (in `getReceiptUrl`):**
- [ ] The requesting user is authorised to view the receipt (owns the expense, or is a manager)
- [ ] The URL returned is a short-lived signed URL — not a permanent public link
- [ ] The `storageId` provided is validated against the expense record (not an arbitrary storage ID for another user's file)

---

### 5. Audit Trail Integrity

The `ExpenseHistory` and `ExpenseVersions` tables are the system's legal audit record. Tampering with them is a critical security concern.

**Verify:**
- [ ] No `ctx.db.patch()` or `ctx.db.replace()` calls target `expenseHistory` or `expenseVersions`
- [ ] No `ctx.db.delete()` calls target `expenseHistory` or `expenseVersions`
- [ ] Every `ExpenseHistory` row is created with the correct `changedBy` (the authenticated user's ID — not a client-supplied user ID)
- [ ] `changedAt` is always set to `Date.now()` server-side — never accepted from the client
- [ ] `versionNumber` in history entries matches the `currentVersion` on the `Expense` record at the time of the transition

**Produce:** Confirmation that no mutation touches history or version rows except via `INSERT` (Convex `ctx.db.insert`).

---

### 6. Password & Credential Security

- [ ] Passwords are hashed by Convex Auth — plaintext passwords are never stored
- [ ] The seed script uses Convex Auth's password hashing functions — not a custom hash
- [ ] Confirm `CONVEX_AUTH_SECRET` is only set in server-side environment variables, not exposed to the client via `NEXT_PUBLIC_` prefix
- [ ] `.env.local` and `.env.production` are listed in `.gitignore`
- [ ] Confirm test credentials from `CLAUDE.md` Section 7 are not hardcoded anywhere outside the seed script

---

### 7. IDOR (Insecure Direct Object Reference) Prevention

IDOR occurs when a user can access another user's data by supplying their resource ID.

**Test cases to verify programmatically or by code audit:**

1. Employee A supplies Employee B's `expenseId` to `getExpenseDetail` → error or empty; B's data not returned
2. Employee supplies a valid expense ID to `approveExpense` → rejected (wrong permission)
3. Employee supplies another user's `storageId` to `getReceiptUrl` → rejected (not their expense)
4. Manager supplies their own `expenseId` to `approveExpense` → rejected (self-action blocked)
5. Unauthenticated request to any query/mutation → rejected before any DB access

---

### 8. Status Transition Integrity

Arbitrary status transitions (e.g., jumping from `Draft` to `Approved` by calling `approveExpense` on a Draft) must be blocked server-side.

**Verify each mutation enforces the correct `from` status:**

| Mutation | Required `from` status |
|---|---|
| `submitExpense` | `"Draft"` only |
| `withdrawExpense` | `"Submitted"` only |
| `openForReview` | `"Submitted"` only |
| `approveExpense` | `"Submitted"` or `"UnderReview"` |
| `rejectExpense` | `"Submitted"` or `"UnderReview"` |
| `closeExpense` | `"Submitted"` or `"UnderReview"` |
| `editRejected` | `"Rejected"` only |
| `resubmitExpense` | `"Draft"` only |

Any mutation that does not enforce its `from` status should be flagged and fixed.

---

## Deliverables

### Deliverable 1: Security Audit Report (`SECURITY_AUDIT.md`)

A structured markdown report containing:

1. **Executive Summary** — overall security posture rating (Pass / Pass with findings / Fail) and summary
2. **Authentication Coverage** — table of all functions audited; status (✅ Pass / ❌ Fail / ⚠️ Needs review)
3. **Authorisation Findings** — any RBAC gaps found; severity (Critical / High / Medium / Low)
4. **Input Validation Findings** — any unvalidated inputs found with specific field names
5. **File Upload Findings** — any missing server-side type/size checks
6. **Audit Trail Integrity** — confirmation of append-only enforcement
7. **IDOR Vulnerability Assessment** — results of each IDOR check
8. **Status Transition Integrity** — any mutations missing `from` status checks
9. **Recommendations** — ordered by severity; each recommendation is actionable

---

### Deliverable 2: Remediation Code

For any `Critical` or `High` severity finding, produce corrected code. Apply fixes directly to the relevant files. Do not leave critical or high severity issues as "recommendations" — fix them.

Common fixes to implement:
- Add missing auth checks at the top of any unprotected function
- Add `from` status enforcement to any mutation missing it
- Add server-side enum validation for `rejectionReason`, `closeReason`, `currencyCode`
- Add expense ownership check to `getReceiptUrl`
- Replace any `ctx.db.patch("expenseHistory", ...)` found with a thrown error

---

### Deliverable 3: Security Middleware / Helpers (`convex/authHelpers.ts`)

Produce reusable server-side helpers to DRY up common patterns:

```ts
// Returns the authenticated user or throws ConvexError
export async function requireAuth(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">>

// Returns the authenticated user and verifies they have the given permission
export async function requirePermission(
  ctx: QueryCtx | MutationCtx,
  permission: Permission
): Promise<Doc<"users">>

// Returns an expense and verifies the requesting user owns it
export async function requireExpenseOwner(
  ctx: MutationCtx,
  expenseId: Id<"expenses">
): Promise<{ user: Doc<"users">; expense: Doc<"expenses"> }>

// Returns an expense in the required status; throws if status doesn't match
export async function requireExpenseStatus(
  ctx: MutationCtx,
  expenseId: Id<"expenses">,
  ...allowedStatuses: ExpenseStatus[]
): Promise<Doc<"expenses">>
```

If the Backend agent did not use these helpers, note which mutations should be refactored to use them.

---

## Audit Approach

Work through each file systematically:

1. `convex/expenses.ts` — full read-through of every mutation and query
2. `convex/files.ts` — file upload and URL generation
3. `convex/users.ts` — user data queries
4. `convex/categories.ts` — public data (lower risk but still check auth)
5. `lib/validators.ts` — are validators actually being used in mutations?
6. `app/` — are routes protected? Does middleware redirect unauthenticated users?

For each function, ask:
- What happens if I call this without being logged in?
- What happens if I call this as the wrong role?
- What happens if I supply someone else's ID?
- What happens if I supply a status that the mutation shouldn't act on?
- What happens if I submit malformed or oversized input?

---

## Constraints

- Do not modify UI components
- Do not change business logic — only security enforcement
- Do not introduce new libraries without flagging
- Fixes must preserve existing TypeScript types and Convex schema
- Every fix must be accompanied by a note in the audit report explaining what was wrong and what was changed

---

## Handoff Checklist

- [ ] Security audit report (`SECURITY_AUDIT.md`) produced covering all 8 sections
- [ ] Every Convex function audited for auth check
- [ ] Every mutation audited for ownership check (where applicable)
- [ ] Every mutation audited for `from` status enforcement
- [ ] Input validation verified for all enum fields server-side
- [ ] File upload server-side type and size validation verified
- [ ] `getReceiptUrl` ownership check verified
- [ ] Audit trail append-only integrity confirmed
- [ ] IDOR scenarios verified (code audit or test)
- [ ] All `Critical` and `High` findings remediated with code
- [ ] `convex/authHelpers.ts` produced with 4 helper functions
- [ ] Zero new TypeScript errors introduced by security fixes
