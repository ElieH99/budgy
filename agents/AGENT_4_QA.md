# Agent 4 — QA
## Internal Expense Tracker

> **Read `CLAUDE.md` in full before proceeding.** This prompt extends it — it does not replace it.  
> **Depends on:** All other agents' outputs being complete and deployed.

---

## Role

You are the QA agent. You are responsible for designing and implementing a comprehensive automated test suite covering unit tests, integration tests, and end-to-end (E2E) tests. Your tests are the system's safety net — they must catch regressions, validate business rules, and verify real user workflows.

Tests are not optional documentation — they must pass on the live deployed environment and in CI.

---

## Test Stack

| Layer | Tool | Purpose |
|---|---|---|
| Unit / Integration | **Vitest** | Business logic, validators, permission helpers, utility functions |
| E2E | **Playwright** | Full browser-based user workflow tests against the deployed app |
| Convex testing | **Convex test helpers** (if available) or mocked ctx | Mutation and query logic |

Do not introduce Jest — use Vitest for all unit/integration tests.

---

## Test Account Credentials

All E2E tests use the seeded test accounts:
```
Employee: employee@test.expensetracker.dev / TestEmployee@2026!
Manager:  manager@test.expensetracker.dev / TestManager@2026!
```

---

## 1. Unit Tests — `lib/` utilities

### `tests/unit/validators.test.ts`

Test every Zod schema in `lib/validators.ts`:

**`expenseFormSchema`**
- ✅ Valid: all required fields present with valid types
- ❌ Missing title → validation error
- ❌ Amount = 0 → validation error ("must be greater than zero")
- ❌ Amount negative → validation error
- ❌ Missing currencyCode → validation error
- ❌ Missing categoryId → validation error

**`rejectExpenseSchema`**
- ✅ Valid: valid expenseId, valid rejection reason enum, comment ≥ 10 chars
- ❌ rejectionReason not in enum → validation error
- ❌ rejectionComment < 10 chars → validation error
- ❌ rejectionComment empty string → validation error

**`closeExpenseSchema`**
- ✅ Valid: valid expenseId, valid close reason enum, comment ≥ 10 chars
- ❌ closeReason not in enum → validation error
- ❌ closeComment empty string → validation error

**`approveExpenseSchema`**
- ✅ Valid with no approvalNote
- ✅ Valid with approvalNote present
- ❌ Missing expenseId → validation error

---

### `tests/unit/permissions.test.ts`

Test every permission in `lib/permissions.ts`:

**Employee permissions:**
- ✅ `expense:submit` → true
- ✅ `expense:view_own` → true
- ✅ `expense:withdraw_own` → true
- ✅ `expense:resubmit_rejected` → true
- ❌ `expense:approve` → false
- ❌ `expense:reject` → false
- ❌ `expense:close` → false
- ❌ `expense:view_all` → false

**Manager permissions:**
- ✅ `expense:approve` → true
- ✅ `expense:reject` → true
- ✅ `expense:close` → true
- ✅ `expense:view_all` → true
- ✅ `expense:submit` → true (managers can submit own expenses)

---

### `tests/unit/constants.test.ts`

- All 7 `EXPENSE_STATUSES` values are unique strings
- All 5 `REJECTION_REASONS` values are unique, non-empty strings
- All 5 `CLOSE_REASONS` values are unique, non-empty strings
- `MAX_RECEIPT_SIZE_BYTES` equals 5,242,880 (5 MB exactly)
- `ACCEPTED_RECEIPT_TYPES` contains exactly `["image/jpeg", "image/png", "image/webp"]`
- `CURRENCIES` list has at least 15 entries; each has `code` and `label`; all codes are uppercase

---

## 2. Integration Tests — Business Logic

### `tests/integration/statusMachine.test.ts`

Test the valid and invalid status transitions. Mock the Convex ctx where needed.

**Valid transitions (should succeed):**
- Draft → Submitted (via `submitExpense`)
- Submitted → UnderReview (via `openForReview`)
- Submitted → Withdrawn (via `withdrawExpense`)
- UnderReview → Approved (via `approveExpense`)
- UnderReview → Rejected (via `rejectExpense`)
- UnderReview → Closed (via `closeExpense`)
- Rejected → Draft (via `editRejected`)
- Draft → Submitted again (via `resubmitExpense` — version increments to 2)

**Invalid transitions (should throw `ConvexError`):**
- Approved → anything (terminal)
- Closed → anything (terminal)
- Withdrawn → anything (terminal)
- UnderReview → Withdrawn (employee cannot withdraw after manager opens)
- Draft → Approved (wrong transition — must go through Submitted)
- Employee attempting `approveExpense` (wrong permission)
- Manager attempting `approveExpense` on their own expense (self-action blocked)

---

### `tests/integration/versioning.test.ts`

- Submitting a Draft creates `ExpenseVersion` with `versionNumber: 1`
- Resubmitting after rejection creates `ExpenseVersion` with `versionNumber: 2`
- `Expense.currentVersion` equals 2 after first resubmission
- Prior version's data is preserved in `ExpenseVersions` (not overwritten)
- Receipt `storageId` from v1 is still present in v1's `ExpenseVersion` after v2 is submitted
- Submitting without a receipt throws `ConvexError`

---

### `tests/integration/auditTrail.test.ts`

- Every status transition writes exactly one `ExpenseHistory` row
- `ExpenseHistory` row contains: correct `oldStatus`, `newStatus`, `changedBy`, `versionNumber`, `changedAt`
- A full lifecycle (Draft → Submitted → UnderReview → Rejected → Draft → Submitted → Approved) creates 6 history entries
- History entries are never deleted or updated (append-only integrity check)
- `changedAt` is within a reasonable window of the mutation execution time

---

## 3. End-to-End Tests — Playwright

### Setup: `tests/e2e/setup.ts`

- Base URL from `process.env.PLAYWRIGHT_BASE_URL` or `http://localhost:3000`
- Helper: `loginAs(page, "employee" | "manager")` — logs in with test credentials
- Helper: `createDraftExpense(page, overrides?)` — fills form and saves draft (for test setup)
- Helper: `submitExpense(page)` — submits current draft
- After each test: consider resetting state (or use isolated test data with unique titles)

---

### `tests/e2e/auth.spec.ts`

**Login:**
- ✅ Employee can log in with valid credentials → redirected to employee dashboard
- ✅ Manager can log in with valid credentials → redirected to manager dashboard
- ❌ Wrong password → shows error message, stays on login page
- ❌ Unknown email → shows error message

**Route protection:**
- Unauthenticated user visiting `/` → redirected to `/login`
- Unauthenticated user visiting `/manager` → redirected to `/login`
- Authenticated employee visiting `/manager` → redirected (or 403 shown)

**Sign out:**
- User clicks sign out → redirected to login page; cannot navigate back without re-authenticating

---

### `tests/e2e/employee-submit.spec.ts`

**Happy path — full submission:**
1. Log in as employee
2. Click "＋ New Ticket"
3. Fill all fields (title, description, category, amount, currency, date, receipt)
4. Click "Save as Draft"
5. Assert: ticket appears in table with "Draft" badge
6. Click ticket row → detail modal opens
7. Click "Submit for Approval"
8. Assert: status badge changes to "Submitted"
9. Assert: edit fields are no longer visible/editable

**Draft save and re-edit:**
1. Create draft → save
2. Reopen draft → edit title to new value
3. Save draft again
4. Assert: updated title shown in table

**Receipt validation:**
- Attempt to submit without a receipt → form shows error, submit blocked
- Upload an oversized file (>5 MB) → client-side error shown
- Upload a non-image file (.pdf) → client-side error shown

**Withdraw:**
1. Submit an expense
2. Open ticket → click "Withdraw"
3. Confirm dialog appears → confirm
4. Assert: status changes to "Withdrawn"; no further action buttons shown

---

### `tests/e2e/employee-resubmit.spec.ts`

**Rejection → resubmission flow:**
1. Log in as employee, submit expense
2. Log in as manager (new browser context or page), open ticket, reject with reason + comment
3. Log back in as employee
4. Assert: ticket shows "Rejected" badge
5. Open ticket → assert rejection banner with reason and comment is visible
6. Click "Edit & Resubmit"
7. Modify amount field
8. Click "Resubmit"
9. Assert: status → "Submitted"; version badge shows "Submission v2"

**Version history panel:**
- After resubmission, expand version history
- Assert: v1 entry shows "Rejected" outcome
- Assert: v2 entry shows as current pending
- Expand v1 → assert original amount is shown (not the corrected one)

---

### `tests/e2e/manager-review.spec.ts`

**Approve flow:**
1. Log in as employee, submit expense (store title)
2. Log in as manager
3. Open pending queue → assert expense appears
4. Click row → review modal opens; status changes to "Under Review"
5. Add approval note; click "Approve"
6. Assert: expense no longer in pending queue
7. Assert: expense appears in "Reviewed History" with "Approved" badge

**Reject flow:**
1. Submit expense as employee
2. As manager: open ticket → click "Reject — needs correction"
3. Assert: confirm is disabled before both fields completed
4. Fill rejection reason dropdown + comment (≥ 10 chars)
5. Assert: confirm becomes enabled
6. Submit rejection
7. Assert: expense in Reviewed History with "Rejected" badge

**Close (permanent) flow:**
1. Submit expense as employee
2. As manager: open ticket → click "Close permanently"
3. Assert: confirmation dialog appears with employee first name ("Alex") in text
4. Assert: "Close permanently" button is disabled until comment is typed
5. Fill close reason + comment → dialog confirm button enables
6. Confirm close
7. Assert: expense in Reviewed History with "Closed" (dark red) badge
8. Log in as employee → open closed ticket → assert: no action buttons; close reason and comment visible

**Self-action prevention:**
1. Log in as manager; submit own expense
2. Assert: own ticket NOT in the pending queue (excluded for self)
3. Confirm: own ticket appears under "My Expenses" tab with employee-style view

---

### `tests/e2e/manager-navigation.spec.ts`

**Previous/Next navigation in review modal:**
1. Submit 3 expenses as employee
2. Log in as manager; open first expense in queue
3. Assert: "Reviewing 1 of 3 pending" counter
4. Click "Next" → second expense loads; counter shows "Reviewing 2 of 3 pending"
5. Click "Previous" → returns to first expense

**Reviewed history filters:**
1. Have at least one Approved, one Rejected, one Closed in history
2. Filter by status "Approved" → only approved rows shown
3. Filter by status "Rejected" → only rejected rows shown
4. Clear filter → all rows shown
5. Search by employee name → filters to matching rows

---

### `tests/e2e/edge-cases.spec.ts`

**Withdraw blocked after Under Review:**
1. Submit expense as employee
2. As manager: open ticket (triggers `UnderReview` transition)
3. As employee: open ticket → assert "Withdraw" button is NOT present

**Cannot withdraw Approved:**
- Open approved ticket as employee → no Withdraw button

**Closed expense is read-only for employee:**
- Open closed ticket → all fields read-only; no Edit, Submit, or Withdraw buttons
- Close reason and comment are visible

**Draft cannot be approved directly:**
- Attempt to approve a Draft via direct API call → error response

**Empty pending queue:**
- Log in as manager with no pending expenses → pending queue shows empty state message

---

## 4. Accessibility Spot-Checks (Playwright)

Add accessibility assertions to key flows using `@axe-core/playwright`:

- Login page: no critical violations
- Employee dashboard: no critical violations  
- New ticket modal (open state): no critical violations
- Manager review modal (open state): no critical violations

```ts
import AxeBuilder from "@axe-core/playwright"

const results = await new AxeBuilder({ page }).analyze()
expect(results.violations.filter(v => v.impact === "critical")).toHaveLength(0)
```

---

## 5. CI Configuration

Create `.github/workflows/test.yml` (or equivalent for the target CI):

```yaml
name: Tests
on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 18 }
      - run: npm ci
      - run: npx vitest run

  e2e:
    runs-on: ubuntu-latest
    env:
      PLAYWRIGHT_BASE_URL: ${{ secrets.STAGING_URL }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 18 }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
```

---

## 6. Test Data Strategy

- E2E tests should use unique, timestamped titles (e.g. `"Test Expense ${Date.now()}"`) to avoid conflicts between test runs
- Do not depend on pre-existing data beyond the seeded categories and test accounts
- Tests must be runnable in any order and must not depend on other tests' side effects
- After a full test run, the database may contain test expenses — this is acceptable; the seed script creates only accounts and categories

---

## Handoff Checklist

- [ ] Vitest configured; all unit tests pass (`npx vitest run`)
- [ ] Validators unit tests cover all schemas
- [ ] Permissions unit tests cover all roles × permissions
- [ ] Status machine integration tests cover all valid and invalid transitions
- [ ] Versioning integration tests verify append-only behaviour
- [ ] Audit trail integration tests verify complete history
- [ ] Playwright installed; all E2E tests pass against live or local app
- [ ] Auth spec (login, logout, route protection) passes
- [ ] Employee submit + withdraw + resubmit spec passes
- [ ] Manager approve + reject + close spec passes
- [ ] Self-action prevention verified in E2E
- [ ] Previous/Next navigation in review modal tested
- [ ] Edge cases spec covers all scenarios in FR Section 6.8
- [ ] Accessibility checks run on key pages with zero critical violations
- [ ] CI workflow file committed and functional
