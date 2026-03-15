# Security Audit Report — Internal Expense Tracker

> **Auditor:** Security Agent (pass 2)
> **Date:** 2026-03-15
> **Scope:** All Convex mutations, queries, file storage, shared validators, auth pages, and route protection
> **Basis:** Full read-through of codebase including all unstaged changes from git working tree

---

## 1. Executive Summary

**Overall Security Posture: Pass with Findings**

The backend demonstrates consistent authentication enforcement, ownership checks on all employee-facing mutations, and a clean role-to-permission mapping. The previous security pass (Agent 5, pass 1) had already remediated the original Critical and High issues: the `getReceiptUrl` IDOR, missing enum validation for `rejectionReason`/`closeReason`, and missing `currencyCode`/`amount` validation.

This pass identified one remaining **Medium** issue and one **Low** issue, both now remediated:

- **Medium** — `getReviewedHistory` accepted an unbounded string `statusFilter` arg that bypasses Convex's argument type system; fixed by replacing `v.string()` with `v.union(v.literal(...))`.
- **Low** — The server `validateAmount()` requires integer cents, but the Zod client schema validated floating-point dollars with no comment making the cents convention explicit; documented for clarity (the UI correctly converts before calling mutations — no functional gap).

No Critical or High issues remain open.

---

## 2. Authentication Coverage

Every public Convex function was read and its authentication check verified.

| File | Function | Type | Auth Mechanism | Result |
|---|---|---|---|---|
| `expenseMutations.ts` | `createDraft` | mutation | `getAuthenticatedUser(ctx)` — throws if no session | PASS |
| `expenseMutations.ts` | `saveDraft` | mutation | `getAuthenticatedUser(ctx)` | PASS |
| `expenseMutations.ts` | `submitExpense` | mutation | `getAuthenticatedUser(ctx)` | PASS |
| `expenseMutations.ts` | `withdrawExpense` | mutation | `getAuthenticatedUser(ctx)` | PASS |
| `expenseMutations.ts` | `editRejected` | mutation | `getAuthenticatedUser(ctx)` | PASS |
| `expenseMutations.ts` | `resubmitExpense` | mutation | `getAuthenticatedUser(ctx)` | PASS |
| `expenseManagerMutations.ts` | `openForReview` | mutation | `getAuthenticatedUser(ctx)` | PASS |
| `expenseManagerMutations.ts` | `approveExpense` | mutation | `getAuthenticatedUser(ctx)` | PASS |
| `expenseManagerMutations.ts` | `rejectExpense` | mutation | `getAuthenticatedUser(ctx)` | PASS |
| `expenseManagerMutations.ts` | `closeExpense` | mutation | `getAuthenticatedUser(ctx)` | PASS |
| `expenseQueries.ts` | `getMyExpenses` | query | `getAuthenticatedUser(ctx)` | PASS |
| `expenseQueries.ts` | `getExpenseDetail` | query | `getAuthenticatedUser(ctx)` | PASS |
| `expenseQueries.ts` | `getPendingQueue` | query | `getAuthenticatedUser(ctx)` | PASS |
| `expenseQueries.ts` | `getReviewedHistory` | query | `getAuthenticatedUser(ctx)` | PASS |
| `expenseQueries.ts` | `getManagerStats` | query | `getAuthenticatedUser(ctx)` | PASS |
| `users.ts` | `getCurrentUser` | query | `getAuthUserId(ctx)` — returns `null` (no throw) | PASS (acceptable — used for auth state check; exposes no data when null) |
| `users.ts` | `getUserById` | query | `getAuthUserId(ctx)` + throws | PASS |
| `users.ts` | `listAllUsers` | query | `getAuthUserId(ctx)` + throws + role check | PASS |
| `categories.ts` | `listCategories` | query | `getAuthUserId(ctx)` + throws | PASS |
| `files.ts` | `generateUploadUrl` | mutation | `getAuthUserId(ctx)` + throws | PASS |
| `files.ts` | `getReceiptUrl` | query | `getAuthUserId(ctx)` + throws + ownership check | PASS |

**Auth helper alignment:** `getAuthenticatedUser` in `expenseHelpers.ts` and `requireAuth` in `authHelpers.ts` are functionally identical. Both delegate to `getAuthUserId` from `@convex-dev/auth/server`, and both throw `ConvexError` before any DB read if the session is absent. No data leakage path exists.

---

## 3. Authorisation — Role-Based Access Control

### 3.1 Manager Action Permissions

| Mutation | Permission Check | Self-Action Block | Status |
|---|---|---|---|
| `openForReview` | `hasPermission(role, "expense:approve")` | `submittedBy === user._id` throws | PASS |
| `approveExpense` | `hasPermission(role, "expense:approve")` | `submittedBy === user._id` throws | PASS |
| `rejectExpense` | `hasPermission(role, "expense:reject")` | `submittedBy === user._id` throws | PASS |
| `closeExpense` | `hasPermission(role, "expense:close")` | `submittedBy === user._id` throws | PASS |

No scattered `if role === "manager"` checks — all use the `hasPermission` mapping from `lib/permissions.ts`.

### 3.2 Ownership Checks (Employee Mutations)

| Mutation | Ownership Enforcement | Status |
|---|---|---|
| `saveDraft` | `expense.submittedBy !== user._id` throws | PASS |
| `submitExpense` | `expense.submittedBy !== user._id` throws | PASS |
| `withdrawExpense` | `expense.submittedBy !== user._id` throws | PASS |
| `editRejected` | `expense.submittedBy !== user._id` throws | PASS |
| `resubmitExpense` | `expense.submittedBy !== user._id` throws | PASS |

### 3.3 Query Access Scope

| Query | Scope Enforcement | Status |
|---|---|---|
| `getMyExpenses` | Index filtered by `submittedBy === user._id` | PASS |
| `getExpenseDetail` | Employee: throws if `submittedBy !== self`; Manager: unrestricted | PASS |
| `getPendingQueue` | `hasPermission` check; results filtered to exclude `submittedBy === self` | PASS |
| `getReviewedHistory` | `hasPermission` check; results filtered to exclude `submittedBy === self` | PASS |
| `getManagerStats` | `hasPermission` check | PASS |
| `listAllUsers` | Role check: `user.role !== "manager"` throws | PASS |
| `getCurrentUser` | Returns only calling user's own record | PASS |
| `getUserById` | Authenticated; returns limited fields — no password hash (Convex Auth stores hashes in its own `authAccounts` table, not `users`) | PASS |
| `listCategories` | Authenticated; public seeded data, no sensitivity | PASS |
| `getReceiptUrl` | Employee: owns expense; Manager: any; `storageId` bound to expense versions | PASS |

---

## 4. Input Validation

### 4.1 Mutations — Validation Matrix

| Field | Mutations | Validation | Status |
|---|---|---|---|
| `title` | `createDraft`, `saveDraft`, `submitExpense`, `resubmitExpense` | `validateStringLength(1, 200)` | PASS |
| `description` | `createDraft`, `saveDraft`, `submitExpense`, `resubmitExpense` | `validateStringLength(1, 2000)` | PASS |
| `amount` | `createDraft`, `saveDraft`, `submitExpense`, `resubmitExpense` | `validateAmount()` — requires positive integer (cents) | PASS |
| `currencyCode` | `createDraft`, `saveDraft`, `submitExpense`, `resubmitExpense` | `validateCurrencyCode()` — checks against `CURRENCY_CODES` enum | PASS |
| `notes` | `createDraft`, `saveDraft` | `validateStringLength(0, 2000)` | PASS |
| `approvalNote` | `approveExpense` | `validateStringLength(0, 2000)` | PASS |
| `rejectionReason` | `rejectExpense` | `validateRejectionReason()` — checks against `REJECTION_REASONS` enum | PASS |
| `rejectionComment` | `rejectExpense` | Explicit `< 10` check + `validateStringLength(10, 2000)` | PASS |
| `closeReason` | `closeExpense` | `validateCloseReason()` — checks against `CLOSE_REASONS` enum | PASS |
| `closeComment` | `closeExpense` | Explicit `< 10` check + `validateStringLength(10, 2000)` | PASS |
| `expenseId` | all mutations | `v.id("expenses")` — Convex validates format and rejects unknowns | PASS |
| `categoryId` | `createDraft`, `saveDraft` | `v.id("categories")` | PASS |
| `statusFilter` | `getReviewedHistory` | **Previously** `v.string()` — **Fixed** to `v.union(v.literal(...))` | PASS (after fix) |

### 4.2 Amount Storage Convention

`validateAmount()` requires a **positive integer** (amounts stored as cents). The client-side `expenseFormSchema` validates in decimal dollars (`.multipleOf(0.01)`). The UI correctly converts with `Math.round(data.amount * 100)` before calling mutations.

**Note:** The Zod schema in `lib/validators.ts` is documented as operating in dollar units and is used only for client-side form validation; it is not used by Convex server validators. The server-side cent requirement is enforced exclusively via `validateAmount()`. This split is intentional and correct but should remain clearly commented to prevent future misalignment.

---

## 5. File Upload Security

### Upload-Time

| Check | Status | Notes |
|---|---|---|
| Auth required to obtain upload URL | PASS | `generateUploadUrl` verifies session |
| Server-side MIME type validation | PASS | `validateReceiptFile()` calls `ctx.storage.getMetadata()` and rejects non-`image/jpeg`/`image/png`/`image/webp` content types |
| Server-side file size validation | PASS | `validateReceiptFile()` rejects files over 5 MB (`MAX_RECEIPT_SIZE_BYTES`) |
| Storage via Convex file storage (not public URL) | PASS | `ctx.storage.generateUploadUrl()` used |

The `validateReceiptFile` function is called in both `submitExpense` and `resubmitExpense` before a version snapshot is committed — these are the only paths that move a receipt from draft scratch-space into the audit trail.

### Serve-Time

| Check | Status | Notes |
|---|---|---|
| Auth required | PASS | `getAuthUserId` + throws |
| Ownership check | PASS | Employee: `expense.submittedBy !== userId` throws; Manager: unrestricted |
| `storageId` validated against expense versions | PASS | Queries all versions of the expense; throws if no match found |
| Short-lived signed URL | PASS | `ctx.storage.getUrl()` returns Convex-signed URLs |

---

## 6. Audit Trail Integrity

### `expenseHistory` — Append-Only

| Check | Status |
|---|---|
| No `ctx.db.patch()` targeting `expenseHistory` anywhere in codebase | PASS |
| No `ctx.db.replace()` targeting `expenseHistory` | PASS |
| No `ctx.db.delete()` targeting `expenseHistory` | PASS |
| `changedBy` always set from server-side `user._id` (not client-supplied) | PASS — `writeHistory` receives `changedBy: user._id` where `user` is the result of `getAuthenticatedUser()` |
| `changedAt` always `Date.now()` server-side | PASS — set inside `writeHistory`, not passed from client |
| `versionNumber` matches `expense.currentVersion` at time of transition | PASS — verified in all call sites |

### `expenseVersions` — Append-Only (with exception)

| Check | Status |
|---|---|
| No `ctx.db.delete()` targeting `expenseVersions` | PASS |
| No `ctx.db.patch()` on submitted versions (versionNumber ≥ 1) | PASS — only version 0 (the working draft scratch-space) is ever patched |
| `ctx.db.patch()` on version 0 in `editRejected` | ACCEPTABLE — version 0 is an explicitly mutable draft workspace. Submitted snapshots (version ≥ 1) are immutable. This is not an audit trail violation. |

---

## 7. IDOR Vulnerability Assessment

| # | Test Case | Code Path | Result |
|---|---|---|---|
| 1 | Employee A supplies Employee B's `expenseId` to `getExpenseDetail` | `if (user.role === "employee" && expense.submittedBy !== user._id) throw` | PASS — throws before returning data |
| 2 | Employee supplies a valid expense ID to `approveExpense` | `hasPermission(role, "expense:approve")` fails for `"employee"` role | PASS — rejected at permission check |
| 3 | Employee supplies another user's `storageId` to `getReceiptUrl` | Ownership check on expense + version binding check on storageId | PASS — rejected before URL is generated |
| 4 | Manager supplies their own `expenseId` to `approveExpense` | `if (expense.submittedBy === user._id) throw` | PASS — self-action blocked |
| 5 | Unauthenticated request to any query or mutation | `getAuthenticatedUser` / `getAuthUserId` as first operation; throws before DB access | PASS — all functions protected |

---

## 8. Status Transition Integrity

| Mutation | Required From Status | Enforcement | Status |
|---|---|---|---|
| `submitExpense` | `"Draft"` | `expense.status !== "Draft"` throws | PASS |
| `withdrawExpense` | `"Submitted"` | `expense.status !== "Submitted"` throws | PASS |
| `openForReview` | `"Submitted"` | `expense.status !== "Submitted"` throws | PASS |
| `approveExpense` | `"Submitted"` or `"UnderReview"` | Compound check on both | PASS |
| `rejectExpense` | `"Submitted"` or `"UnderReview"` | Compound check on both | PASS |
| `closeExpense` | `"Submitted"` or `"UnderReview"` | Compound check on both | PASS |
| `editRejected` | `"Rejected"` | `expense.status !== "Rejected"` throws | PASS |
| `resubmitExpense` | `"Draft"` | `expense.status !== "Draft"` throws | PASS |

Terminal statuses (`Approved`, `Closed`, `Withdrawn`) have no outbound mutations — confirmed by full read-through of both mutation files.

---

## 9. Password and Credential Security

| Check | Result |
|---|---|
| Passwords hashed by Convex Auth | PASS — `convexAuth({ providers: [Password(...)] })` delegates hashing to the library; no password field exists in the `users` table |
| New user registrations default to `"employee"` role | PASS — `role: "employee" as const` hardcoded in `convex/auth.ts` profile callback; role cannot be elevated via registration |
| `CONVEX_AUTH_SECRET` not exposed via `NEXT_PUBLIC_` prefix | PASS — `.env.example` uses `CONVEX_AUTH_SECRET`; only `NEXT_PUBLIC_CONVEX_URL` is prefixed |
| `.env.local` and `.env.production` in `.gitignore` | PASS — both are listed |
| Test credentials outside seed script | INFO — Passwords appear in `CLAUDE.md`, `README.md`, `docs/reports/DEPLOYMENT.md`, and `tests/e2e/setup.ts`. These are internal dev/test documents, not production secrets. `CLAUDE.md` and deployment docs are documentation. The test setup file references them by necessity for E2E automation. Acceptable for an internal tool; would warrant a secrets manager for a public-facing service. |

---

## 10. Route Protection (Frontend)

| Page | Protection Mechanism | Status |
|---|---|---|
| `/login` | `useQuery(getCurrentUser)` + `useEffect` redirect if `user` is truthy | PASS — already-authenticated users are bounced out |
| `/register` | Same pattern | PASS |
| `/(dashboard)/layout.tsx` | `useQuery(getCurrentUser)` — renders loading state until resolved; if `user === null`, redirects to `/login` | PASS |
| Dashboard children | Protected by layout — never rendered until `user` is confirmed non-null | PASS |
| Idle timeout | 15-minute inactivity timer (`IDLE_TIMEOUT_MS`) wired to `mousemove`, `keydown`, `mousedown`, `touchstart` events | PASS |

**Note on client-side route protection:** Client-side redirects are a UX layer, not a security boundary. The authoritative security enforcement is at the Convex server layer (all mutations and queries require auth before any data access). Client-side redirects prevent inadvertent UI access; they cannot be relied upon as the sole gate.

---

## 11. Remediation Applied in This Pass

### Fix 1 — `getReviewedHistory` statusFilter validation (Medium → Fixed)

**File:** `convex/expenseQueries.ts`

**Before:** `statusFilter: v.optional(v.string())` — accepted any arbitrary string value. An invalid status would produce an empty result set (no data leak) but the argument bypassed Convex's validator type system.

**After:** Replaced with `v.optional(v.union(v.literal("Approved"), v.literal("Rejected"), v.literal("Closed")))`. Convex now rejects calls with an invalid status at the transport layer before the handler runs.

---

## 12. Security Helpers — `convex/authHelpers.ts`

The following helpers are implemented and available for use in mutations and queries:

| Helper | Purpose | Status |
|---|---|---|
| `requireAuth(ctx)` | Returns authenticated user or throws `ConvexError` | Implemented |
| `requirePermission(ctx, permission)` | Auth + permission check; throws if lacking permission | Implemented |
| `requireExpenseOwner(ctx, expenseId)` | Auth + ownership check; returns `{ user, expense }` | Implemented |
| `requireExpenseStatus(ctx, expenseId, ...statuses)` | Returns expense if status matches; throws otherwise | Implemented |
| `requireNotOwnExpense(user, expense)` | Throws if manager is acting on own expense | Implemented |
| `validateRejectionReason(reason)` | Validates against `REJECTION_REASONS` enum | Implemented |
| `validateCloseReason(reason)` | Validates against `CLOSE_REASONS` enum | Implemented |
| `validateCurrencyCode(code)` | Validates against `CURRENCY_CODES` enum | Implemented |
| `validateAmount(amount)` | Requires positive integer (cents) | Implemented |
| `validateStringLength(value, fieldName, min, max)` | Length-bounds any string field | Implemented |

---

## 13. Recommendations (Ordered by Severity)

### Remediated in Previous Pass
| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | Critical | `getReceiptUrl` IDOR — no ownership or storage binding check | Fixed — `expenseId` param added, ownership + version binding enforced |
| 2 | High | `rejectionReason` not validated against enum | Fixed — `validateRejectionReason()` added |
| 3 | High | `closeReason` not validated against enum | Fixed — `validateCloseReason()` added |
| 4 | High | `currencyCode` not validated server-side | Fixed — `validateCurrencyCode()` added |
| 5 | High | `amount` not validated as positive/finite | Fixed — `validateAmount()` added |
| 6 | Medium | String fields unbounded server-side | Fixed — `validateStringLength()` applied throughout |

### Remediated in This Pass
| # | Severity | Finding | Status |
|---|---|---|---|
| 7 | Medium | `getReviewedHistory` `statusFilter` accepted arbitrary string | Fixed — `v.union(v.literal(...))` replaces `v.string()` |

### Remaining Open Items (Low Priority)
| # | Severity | Recommendation |
|---|---|---|
| 8 | Low | Add a comment to `lib/validators.ts` explicitly noting that `expenseFormSchema.amount` is in dollars (the server receives cents after UI conversion). This prevents future contributors from accidentally removing the `Math.round(* 100)` conversion. |
| 9 | Low | Restrict `generateUploadUrl` to prevent excessive upload URL generation (rate limiting). Currently Convex platform handles this; no application-level control exists. Acceptable for v1. |
| 10 | Informational | Test credentials in `README.md` and `docs/reports/DEPLOYMENT.md` are documentation-only. Acceptable for an internal tool. For a customer-facing product, move credentials to a secrets manager and remove from documentation. |

---

## 14. Deliverables Summary

| Deliverable | Status | File(s) |
|---|---|---|
| Security Audit Report | Complete | `SECURITY_AUDIT.md` (this file) |
| Remediation Code (pass 2) | Complete | `convex/expenseQueries.ts` — `statusFilter` enum enforcement |
| Security Helpers | Complete | `convex/authHelpers.ts` — 10 helpers covering auth, permissions, ownership, status guards, and input validation |

---

*All Critical and High severity findings are remediated. One Medium finding fixed in this pass. Codebase is in a secure state for v1 deployment.*
