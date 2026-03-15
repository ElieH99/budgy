# API Reference — Convex Functions

All server functions are implemented in the `convex/` directory. Every function requires an authenticated session. Auth is validated via `getAuthenticatedUser(ctx)` which throws a `ConvexError` if no session exists.

---

## Employee Mutations

File: [convex/expenseMutations.ts](../convex/expenseMutations.ts)

---

### `createDraft`

Creates a new expense in Draft status.

| | |
|---|---|
| **Type** | Mutation |
| **Auth** | Any authenticated user |

**Args:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | `string` | Yes | 1–200 characters |
| `description` | `string` | Yes | 1–2000 characters |
| `amount` | `number` | Yes | Must be positive |
| `currencyCode` | `string` | Yes | ISO 4217, must be in supported list |
| `categoryId` | `Id<"categories">` | Yes | |
| `expenseDate` | `number` | Yes | UTC milliseconds |
| `notes` | `string` | No | 0–2000 characters |
| `receiptStorageId` | `string` | No | Convex storage ID |

**Returns:** `Id<"expenses">`

**Side effects:**
- Inserts a row into `expenses` with `status: "Draft"`, `currentVersion: 0`
- Inserts a draft version row into `expenseVersions` with `versionNumber: 0`
- Writes a `"" → "Draft"` row to `expenseHistory`

---

### `saveDraft`

Updates the mutable fields of a Draft expense. Only callable by the expense owner while status is `Draft`.

| | |
|---|---|
| **Type** | Mutation |
| **Auth** | Expense owner only |

**Args:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `expenseId` | `Id<"expenses">` | Yes | |
| `title` | `string` | No | |
| `description` | `string` | No | |
| `amount` | `number` | No | |
| `currencyCode` | `string` | No | |
| `categoryId` | `Id<"categories">` | No | |
| `expenseDate` | `number` | No | |
| `notes` | `string` | No | |
| `receiptStorageId` | `string` | No | |

**Returns:** `void`

**Side effects:** Patches the draft version row (`versionNumber: 0`) in `expenseVersions`. Updates `updatedAt` on the expense.

**Throws:** If expense is not in `Draft` status, or caller is not the owner.

---

### `submitExpense`

Submits a draft expense for manager review. Creates a version snapshot atomically.

| | |
|---|---|
| **Type** | Mutation |
| **Auth** | Expense owner only |

**Args:**

| Field | Type | Required |
|---|---|---|
| `expenseId` | `Id<"expenses">` | Yes |

**Returns:** `void`

**Side effects:**
- Inserts a new `expenseVersions` row with `versionNumber: currentVersion + 1`
- Updates `expenses.status` to `"Submitted"` and increments `currentVersion`
- Writes a `"Draft" → "Submitted"` row to `expenseHistory`

**Throws:** If receipt is missing, required fields are empty, or status is not `Draft`.

---

### `withdrawExpense`

Withdraws a submitted expense before a manager has opened it.

| | |
|---|---|
| **Type** | Mutation |
| **Auth** | Expense owner only |

**Args:**

| Field | Type | Required |
|---|---|---|
| `expenseId` | `Id<"expenses">` | Yes |

**Returns:** `void`

**Side effects:**
- Updates `expenses.status` to `"Withdrawn"` (terminal)
- Writes a `"Submitted" → "Withdrawn"` row to `expenseHistory`

**Throws:** If status is not `Submitted` (i.e. already under review or later).

---

### `editRejected`

Transitions a rejected expense back to Draft so the employee can make corrections.

| | |
|---|---|
| **Type** | Mutation |
| **Auth** | Expense owner only |

**Args:**

| Field | Type | Required |
|---|---|---|
| `expenseId` | `Id<"expenses">` | Yes |

**Returns:** `void`

**Side effects:**
- Copies the current version data into the draft slot (`versionNumber: 0`)
- Updates `expenses.status` to `"Draft"`
- Writes a `"Rejected" → "Draft"` row to `expenseHistory`

**Throws:** If status is not `Rejected`.

---

### `resubmitExpense`

Resubmits a draft expense after rejection. Functionally identical to `submitExpense`.

| | |
|---|---|
| **Type** | Mutation |
| **Auth** | Expense owner only |

**Args:**

| Field | Type | Required |
|---|---|---|
| `expenseId` | `Id<"expenses">` | Yes |

**Returns:** `void`

**Side effects:** Same as `submitExpense` — creates a new version snapshot and writes history.

---

## Manager Mutations

File: [convex/expenseManagerMutations.ts](../convex/expenseManagerMutations.ts)

All manager mutations require the `expense:approve` (or specific) permission via `hasPermission()`. Managers cannot act on their own expenses.

---

### `openForReview`

Marks a submitted expense as under review.

| | |
|---|---|
| **Type** | Mutation |
| **Auth** | Manager only (`expense:approve`) |

**Args:**

| Field | Type | Required |
|---|---|---|
| `expenseId` | `Id<"expenses">` | Yes |

**Returns:** `void`

**Side effects:**
- Updates `expenses.status` to `"UnderReview"`
- Writes a `"Submitted" → "UnderReview"` row to `expenseHistory`

**Throws:** If not a manager, if own expense, or if status is not `Submitted`.

---

### `approveExpense`

Approves an expense.

| | |
|---|---|
| **Type** | Mutation |
| **Auth** | Manager only (`expense:approve`) |

**Args:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `expenseId` | `Id<"expenses">` | Yes | |
| `approvalNote` | `string` | No | 0–2000 characters |

**Returns:** `void`

**Side effects:**
- Updates `expenses.status` to `"Approved"` (terminal), sets `approvedBy`, `approvedAt`, `approvalNote`
- Writes a `→ "Approved"` row to `expenseHistory`

**Throws:** If not a manager, if own expense, or if status is not `Submitted` or `UnderReview`.

---

### `rejectExpense`

Rejects an expense with a categorised reason and mandatory comment.

| | |
|---|---|
| **Type** | Mutation |
| **Auth** | Manager only (`expense:reject`) |

**Args:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `expenseId` | `Id<"expenses">` | Yes | |
| `rejectionReason` | `string` | Yes | Must be one of `REJECTION_REASONS` in `lib/constants.ts` |
| `rejectionComment` | `string` | Yes | Minimum 10 characters |

**Returns:** `void`

**Side effects:**
- Updates `expenses.status` to `"Rejected"`, sets `rejectedBy`, `rejectedAt`, `rejectionReason`, `rejectionComment`
- Writes a `→ "Rejected"` row to `expenseHistory`

---

### `closeExpense`

Permanently closes an expense. Irreversible.

| | |
|---|---|
| **Type** | Mutation |
| **Auth** | Manager only (`expense:close`) |

**Args:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `expenseId` | `Id<"expenses">` | Yes | |
| `closeReason` | `string` | Yes | Must be one of `CLOSE_REASONS` in `lib/constants.ts` |
| `closeComment` | `string` | Yes | Minimum 10 characters |

**Returns:** `void`

**Side effects:**
- Updates `expenses.status` to `"Closed"` (terminal), sets `closedBy`, `closedAt`, `closeReason`, `closeComment`
- Writes a `→ "Closed"` row to `expenseHistory`

---

## Queries

File: [convex/expenseQueries.ts](../convex/expenseQueries.ts)

---

### `getMyExpenses`

Returns all expenses owned by the current user, sorted by most recently updated.

| | |
|---|---|
| **Type** | Query (reactive) |
| **Auth** | Any authenticated user |

**Args:** none

**Returns:** Array of:
```ts
{
  _id: Id<"expenses">
  status: ExpenseStatus
  currentVersion: number
  updatedAt: number
  createdAt: number
  title: string
  amount: number
  currencyCode: string
  categoryId: Id<"categories"> | undefined
  expenseDate: number | undefined
}
```

---

### `getExpenseDetail`

Returns full expense detail including all versions and audit history. Employees can only view their own expenses; managers can view all.

| | |
|---|---|
| **Type** | Query (reactive) |
| **Auth** | Owner (employee) or any manager |

**Args:**

| Field | Type | Required |
|---|---|---|
| `expenseId` | `Id<"expenses">` | Yes |

**Returns:**
```ts
{
  expense: Expense & { submittedByName, approvedByName, rejectedByName, closedByName }
  draftVersion: ExpenseVersion | null
  versions: ExpenseVersion[]          // submitted versions (versionNumber > 0), oldest first
  history: ExpenseHistory[]           // all status transitions, oldest first
  usersMap: Record<string, { firstName, lastName }>
  categoriesMap: Record<string, string>
}
```

---

### `getPendingQueue`

Returns all Submitted and UnderReview expenses (excluding the manager's own).

| | |
|---|---|
| **Type** | Query (reactive) |
| **Auth** | Manager only |

**Args:** none

**Returns:** Array sorted by `submittedAt` ascending (oldest first).

---

### `getReviewedHistory`

Returns Approved, Rejected, and Closed expenses with optional filters.

| | |
|---|---|
| **Type** | Query (reactive) |
| **Auth** | Manager only |

**Args:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `statusFilter` | `string` | No | `"Approved"`, `"Rejected"`, or `"Closed"` |
| `categoryFilter` | `Id<"categories">` | No | |
| `employeeFilter` | `Id<"users">` | No | |

**Returns:** Array sorted by `updatedAt` descending.

---

### `getManagerStats`

Returns aggregate counts and totals for the manager dashboard summary strip.

| | |
|---|---|
| **Type** | Query (reactive) |
| **Auth** | Manager only |

**Args:** none

**Returns:**
```ts
{
  pending: number               // Submitted + UnderReview (excluding own)
  approvedThisMonth: number
  approvedBudgetThisMonth: number
  rejectedThisMonth: number
  closedCount: number
  submittedCount: number
  underReviewCount: number
  totalUnderManagement: number
}
```

---

## File Helpers

File: [convex/files.ts](../convex/files.ts)

### `generateUploadUrl`

Returns a short-lived URL for uploading a receipt directly to Convex Storage.

| | |
|---|---|
| **Type** | Mutation |
| **Auth** | Any authenticated user |

**Args:** none

**Returns:** `string` — upload URL (expires quickly; use immediately)

**Usage pattern:**
```ts
const uploadUrl = await generateUploadUrl();
const result = await fetch(uploadUrl, { method: "POST", body: file });
const { storageId } = await result.json();
// Pass storageId to createDraft or saveDraft
```

### `getFileUrl`

Returns the public URL for a stored receipt.

| | |
|---|---|
| **Type** | Query |
| **Auth** | Any authenticated user |

**Args:**

| Field | Type | Required |
|---|---|---|
| `storageId` | `string` | Yes |

**Returns:** `string | null`
