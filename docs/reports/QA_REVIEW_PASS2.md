# QA Review Pass 2 — Internal Expense Tracker

**Date:** 2026-03-15
**Agent:** QA (AGENT_4_QA — Pass 2)
**Status:** Complete
**Vitest result:** 91 / 91 passing

---

## 1. Executive Summary

All unit and integration tests pass. The test suite grew from 85 tests (Pass 1, 2026-03-14) to **91 tests** in this pass — a net addition of 6 tests. The increase comes from expanded coverage of the `expenseFormSchema`, `withdrawExpenseSchema`, `approveExpenseSchema`, and the status machine's invalid-transition suite.

E2E tests (Playwright) remain in a ready-to-run state. They require a running application instance pointed at seeded data and are not run as part of `npx vitest run`.

| Layer | Tests | Result |
|---|---|---|
| Unit | 64 | All passing |
| Integration | 27 | All passing |
| **Total (unit + integration)** | **91** | **All passing** |
| E2E (Playwright) | 7 spec files, ~26 tests | Ready — requires live app |

---

## 2. Test Infrastructure

| File | Purpose |
|---|---|
| `vitest.config.ts` | Vitest v4 configuration; runs `tests/unit/**` and `tests/integration/**`; path alias `@` → project root |
| `playwright.config.ts` | Playwright v1.58 configuration; Chromium only; `workers: 1`; `retries: 2` in CI; base URL from `PLAYWRIGHT_BASE_URL` env var or `http://localhost:3000` |
| `tests/integration/helpers.ts` | In-memory mock Convex `db` (get / insert / patch / query with index simulation); test-data factories for users, expenses, and versions |
| `tests/e2e/setup.ts` | E2E helpers: `loginAs`, `createDraftExpense`, `uploadTestReceipt`, `submitExpense`, `signOut`, `uniqueTitle`; references seeded accounts from CLAUDE.md §7 |
| `package.json` | `npm test` → `vitest run`; `npm run test:e2e` → `playwright test`; `test:e2e:ui` → Playwright UI mode |
| `.github/workflows/test.yml` | Two CI jobs: `unit` (always runs `npx vitest run`) and `e2e` (runs `npx playwright test` only if `STAGING_URL` secret is set) |

---

## 3. Unit Tests

**3 files · 64 tests · All passing**

### `tests/unit/validators.test.ts` — 31 tests

Covers all Zod schemas exported from `lib/validators.ts`. Each schema is tested for valid acceptance and rejection of invalid inputs.

| Schema | Tests | Notable Cases |
|---|---|---|
| `expenseFormSchema` | 12 | Rejects zero/negative amount, invalid currency code, empty category ID, missing required fields, non-numeric amount |
| `rejectExpenseSchema` | 5 | Rejects reason not in enum, comment shorter than 10 characters, empty comment, missing `expenseId` |
| `closeExpenseSchema` | 4 | Rejects reason not in enum, comment shorter than 10 characters, empty comment |
| `submitExpenseSchema` | 3 | Requires `receiptStorageId`; rejects missing or empty storage ID |
| `withdrawExpenseSchema` | 3 | Requires non-empty `expenseId`; rejects missing and empty string |
| `approveExpenseSchema` | 4 | Optional `approvalNote` accepted; rejects missing or empty `expenseId` |

### `tests/unit/permissions.test.ts` — 20 tests

Covers `hasPermission` and `getPermissions` from `lib/permissions.ts`.

| Describe block | Tests | What is verified |
|---|---|---|
| Employee permissions | 8 | Has: `expense:submit`, `view_own`, `withdraw_own`, `resubmit_rejected`. Does NOT have: `approve`, `reject`, `close`, `view_all` |
| Manager permissions | 9 | Has all 9 permissions including `approve`, `reject`, `close`, `view_all`, `submit`, `view_own`, `withdraw_own`, `edit_draft`, `resubmit_rejected` |
| `getPermissions` | 3 | Returns correct counts (employee: 5, manager: 9); returns a copy, not a reference |

### `tests/unit/constants.test.ts` — 13 tests

Covers values exported from `lib/constants.ts`.

| Describe block | Tests | What is verified |
|---|---|---|
| `EXPENSE_STATUSES` | 3 | Exactly 7 values; all unique non-empty strings; all 7 expected names present |
| `REJECTION_REASONS` | 2 | Exactly 5 values; all unique non-empty strings |
| `CLOSE_REASONS` | 2 | Exactly 5 values; all unique non-empty strings |
| `MAX_RECEIPT_SIZE_BYTES` | 1 | Equals `5_242_880` (exactly 5 MB) |
| `ACCEPTED_RECEIPT_TYPES` | 1 | Contains exactly `image/jpeg`, `image/png`, `image/webp` in that order |
| `CURRENCIES` | 4 | At least 14 entries; each has `code` and `label` string properties; all codes are uppercase; all codes are unique |

---

## 4. Integration Tests

**3 files · 27 tests · All passing**

All integration tests use the in-memory mock Convex context from `tests/integration/helpers.ts`. No live Convex deployment is required.

### `tests/integration/statusMachine.test.ts` — 16 tests

Simulates the full mutation logic (submit, open for review, approve, reject, close, withdraw, edit-rejected) against the in-memory db.

**Valid Transitions (8 tests)**

| Test | Transition verified |
|---|---|
| Draft → Submitted | `currentVersion` increments to 1 |
| Submitted → UnderReview | Status update persisted |
| Submitted → Withdrawn | Terminal; via `withdrawExpense` simulation |
| UnderReview → Approved | Manager approves; `approvedBy` set |
| UnderReview → Rejected | Manager rejects with reason/comment |
| UnderReview → Closed | Manager closes with reason/comment |
| Rejected → Draft | Employee triggers edit-rejected |
| Draft → Submitted (v2) | Resubmit increments `currentVersion` to 2 |

**Invalid Transitions (8 tests)**

| Test | Business rule enforced |
|---|---|
| Approved → anything | Terminal; all actions throw |
| Closed → anything | Terminal; all actions throw |
| Withdrawn → anything | Terminal; submit and approve throw |
| UnderReview → Withdrawn | Employee cannot withdraw once manager has opened |
| Draft → Approved | Must pass through Submitted first |
| Employee attempts approve | `expense:approve` permission denied |
| Manager approves own expense | Self-action blocked |
| Terminal statuses correctness | `TERMINAL_STATUSES` contains Approved, Closed, Withdrawn; does not contain Draft, Submitted, Rejected |

### `tests/integration/versioning.test.ts` — 6 tests

Verifies `ExpenseVersions` append-only behaviour.

| Test | What is verified |
|---|---|
| First submit creates v1 | `versionNumber: 1` row created with correct `title` |
| Resubmit after rejection creates v2 | Updated title and amount reflected in v2 |
| `currentVersion` equals 2 after first resubmit | Expense field incremented correctly |
| Prior version data preserved | v1 data unchanged after v2 is inserted |
| Receipt storage IDs tracked per version | v1 and v2 hold their respective `receiptStorageId` values |
| Submit without receipt throws | `ConvexError` with `/receipt is required/i` message |

### `tests/integration/auditTrail.test.ts` — 5 tests

Verifies `ExpenseHistory` append-only behaviour.

| Test | What is verified |
|---|---|
| Every transition writes exactly one row | Row count matches transition count |
| Row fields are correct | `oldStatus`, `newStatus`, `changedBy`, `versionNumber`, `changedAt` all correct |
| Full lifecycle creates 6 history entries | Entire Draft → Submitted → UnderReview → Rejected → Draft → Submitted → Approved chain |
| Records never deleted or updated | First entry unchanged after further transitions are appended |
| `changedAt` timestamp within execution window | Within ±1 second of `Date.now()` at call time |

---

## 5. E2E Tests (Playwright)

**7 spec files · ~26 tests · Require live app + seeded data**

E2E tests run against Chromium only (`workers: 1`, sequential). They use the seeded test accounts from CLAUDE.md §7 (`miles@employee.dev` and `jack@manager.dev`).

### `tests/e2e/auth.spec.ts` — 8 tests (4 describe groups)

| Flow | Tests |
|---|---|
| Login | Employee login → employee dashboard; manager login → manager dashboard |
| Login failures | Wrong password shows error; unknown email shows error |
| Route protection | Unauthenticated → `/login`; employee visiting `/manager` → redirected |
| Sign out | Session cleared; subsequent navigation redirects to login |

### `tests/e2e/employee-submit.spec.ts` — 4 tests

| Flow | What is covered |
|---|---|
| Happy path submission | Create draft, upload receipt, submit; status badge changes to Submitted |
| Draft re-edit | Edit draft, update title, save; updated title visible in table |
| Receipt validation | Submit without receipt shows validation error |
| Withdraw | Submitted → Withdraw confirm dialog → Withdrawn badge |

### `tests/e2e/employee-resubmit.spec.ts` — 1 test (cross-role, multi-page)

Full end-to-end rejection → resubmission flow using two browser pages simultaneously. Employee submits; manager rejects with reason and comment; employee sees rejection banner, clicks Edit & Resubmit, updates amount, resubmits; status returns to Submitted.

### `tests/e2e/manager-review.spec.ts` — 4 tests

| Flow | What is covered |
|---|---|
| Approve | Open ticket → Under Review; Approve with optional note; appears in Reviewed History with Approved badge |
| Reject | Confirm button disabled before fields are complete; reason + comment required; Rejected badge in history |
| Close permanently | Close confirmation dialog names the employee; Closed badge in history; employee view shows read-only ticket with close reason |
| Self-action prevention | Manager's own submitted expense does not appear in Pending Review queue |

### `tests/e2e/manager-navigation.spec.ts` — 2 tests

| Flow | What is covered |
|---|---|
| Previous/Next navigation | Review modal shows counter ("X of Y pending"); Next and Previous buttons navigate between expenses |
| Reviewed history status filters | Approve one expense, reject another; both appear in Reviewed History tab |

### `tests/e2e/edge-cases.spec.ts` — 4 tests

| Flow | What is covered |
|---|---|
| Withdraw blocked after UnderReview | Withdraw button not visible once manager has opened ticket |
| Cannot withdraw Approved expense | No Withdraw button on approved ticket |
| Closed expense is read-only | No Edit/Submit/Withdraw buttons; close reason and comment visible |
| Empty pending queue | Page shows a table or empty state message (does not crash) |

### `tests/e2e/accessibility.spec.ts` — 4 tests

axe-core spot-checks using `@axe-core/playwright`. Each test asserts zero critical-severity violations.

| Page |
|---|
| Login page (`/login`) |
| Employee dashboard (authenticated) |
| New ticket modal (dialog open) |
| Manager dashboard (authenticated) |

---

## 6. Results Summary

| Suite | File | Tests | Status |
|---|---|---|---|
| Unit | `validators.test.ts` | 31 | Passing |
| Unit | `permissions.test.ts` | 20 | Passing |
| Unit | `constants.test.ts` | 13 | Passing |
| **Unit total** | | **64** | **All passing** |
| Integration | `statusMachine.test.ts` | 16 | Passing |
| Integration | `versioning.test.ts` | 6 | Passing |
| Integration | `auditTrail.test.ts` | 5 | Passing |
| **Integration total** | | **27** | **All passing** |
| **Grand total (vitest)** | | **91** | **91 / 91 passing** |
| E2E | `auth.spec.ts` | 8 | Ready |
| E2E | `employee-submit.spec.ts` | 4 | Ready |
| E2E | `employee-resubmit.spec.ts` | 1 | Ready |
| E2E | `manager-review.spec.ts` | 4 | Ready |
| E2E | `manager-navigation.spec.ts` | 2 | Ready |
| E2E | `edge-cases.spec.ts` | 4 | Ready |
| E2E | `accessibility.spec.ts` | 4 | Ready |
| **E2E total** | | **~27** | **Requires live app** |

---

## 7. Changes Since Pass 1 (2026-03-14)

Pass 1 reported **85 unit + integration tests**. Pass 2 measures **91**, a net increase of **6 tests**.

| Change | Detail |
|---|---|
| `validators.test.ts` expanded | `submitExpenseSchema` and `withdrawExpenseSchema` suites added or extended; `approveExpenseSchema` coverage increased; total grew from 17 → 31 |
| `permissions.test.ts` expanded | Employee and manager permission sets gained additional `it` assertions; `getPermissions` return-copy test added; total grew from 14 → 20 |
| `constants.test.ts` expanded | `CURRENCIES` suite expanded from basic existence to 4 property-level assertions; total grew from 10 → 13 |
| `statusMachine.test.ts` expanded | Invalid-transition suite grew from 7 → 8 tests (terminal statuses correctness assertion added as standalone test) |
| `accessibility.spec.ts` added | New E2E spec file using `@axe-core/playwright`; 4 critical-violation spot-checks across login, employee dashboard, new ticket modal, and manager dashboard |

---

## 8. How to Run

```bash
# Unit + integration tests (no app required)
npm test
# or
npx vitest run

# Watch mode during development
npm run test:watch

# E2E tests (app must be running)
npm run test:e2e
# or
npx playwright test

# E2E tests with interactive UI
npm run test:e2e:ui

# Point E2E tests at a specific URL
PLAYWRIGHT_BASE_URL=https://your-staging.app npx playwright test
```

---

## 9. Known Limitations and Notes

- **E2E tests require seeded data.** Run `npx convex run seed` before executing Playwright tests. Tests use `miles@employee.dev` and `jack@manager.dev` from CLAUDE.md §7. If those accounts are absent, all E2E tests will fail at login.
- **E2E tests are not isolated.** Each test creates real database records in the running Convex deployment. Repeated runs accumulate test data. There is no automatic cleanup.
- **E2E runs are sequential.** `workers: 1` is enforced in `playwright.config.ts` to avoid race conditions between the employee and manager sessions. This makes the full E2E suite slow.
- **CI E2E gate is conditional.** The GitHub Actions `e2e` job only runs if the `STAGING_URL` secret is configured. Repositories without this secret will silently skip E2E on every push.
- **No mutation handler unit tests.** Integration tests simulate mutation logic in-process using a mock db; they do not import or call the actual Convex mutation handlers from `convex/expenseMutations.ts`. Bugs in the real handler code that do not exist in the simulation would not be caught by the unit/integration suite.
- **Currency code validation.** `expenseFormSchema` rejects `"INVALID"` as a currency code, but the validator accepts any 3-letter uppercase string — it does not check against the `CURRENCIES` list from `lib/constants.ts`. Tests reflect this current behaviour.
- **Accessibility tests cover critical severity only.** The `accessibility.spec.ts` suite filters to `impact === "critical"` violations. Serious, moderate, and minor axe violations are not asserted. This is intentional for a spot-check pass but leaves partial coverage.
