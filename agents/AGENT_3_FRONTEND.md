# Agent 3 — Frontend
## Internal Expense Tracker

> **Read `CLAUDE.md` in full before proceeding.** This prompt extends it — it does not replace it.  
> **Depends on:** Agent 1 (Architect) and Agent 2 (Backend) outputs.

---

## Role

You are the Frontend agent. You build every screen, modal, table, form, and interactive component in the application. You consume the Convex queries and mutations defined by the Backend agent and apply the UI/UX patterns defined by the Design agent.

Your output must be functional, accessible, and consistent with the status badge colours and interaction rules defined in `CLAUDE.md`. Every behaviour described in the FR document must be implemented — not approximated.

---

## Guiding Principles

1. **Every form uses React Hook Form + Zod.** Pull schemas from `lib/validators.ts`. Never write ad-hoc validation logic.
2. **Every table uses TanStack Table v8.** No `<table>` built by hand.
3. **Every date displayed is formatted with date-fns.** UTC timestamps from Convex → user's local time. Lists use relative time (`formatDistanceToNow`); timelines use absolute (`format(date, "dd MMM yyyy, HH:mm")`).
4. **Status badges are consistent.** Use the `<StatusBadge>` component everywhere. Badge colours from `CLAUDE.md` Section 8.
5. **Real-time data via Convex `useQuery`.** Do not poll. Do not cache manually.
6. **Loading states are explicit.** Every query-dependent component shows a skeleton or spinner while data loads.
7. **Error states are handled.** Show user-friendly messages for `ConvexError` failures. Do not let errors silently disappear.

---

## Shared Components to Build First

Build these before any page-level components. Everything else composes them.

### `components/expenses/StatusBadge.tsx`
A badge component rendering the correct colour and label for any `ExpenseStatus`. Uses `CLAUDE.md` Section 8 colour mapping. Accepts `status: ExpenseStatus` prop.

### `components/expenses/VersionBadge.tsx`
Renders e.g. `"Submission v1"` in neutral or `"Submission v2 — Resubmission"` in amber. Accepts `versionNumber: number`.

### `components/expenses/RejectionBanner.tsx`
An amber highlighted banner displaying: rejection reason (bold) + rejection comment. Shown at the top of edit forms and the manager review modal when `versionNumber > 1`.

### `components/expenses/StatusTimeline.tsx`
A vertical chronological list of `ExpenseHistory` entries. Each entry shows:
- Timestamp (absolute, local time)
- Actor name
- Action description (e.g. "Jordan Lee rejected" / "Alex Morgan submitted")
- Version reference badge (e.g. `[v1]`)
- Status change arrow (e.g. `Submitted → Under Review`)
- Comment (if present) — displayed in a sub-line

### `components/expenses/VersionHistoryPanel.tsx`
An expandable accordion. One entry per `ExpenseVersion`. Shows:
- Version number + submission date + outcome label (Rejected / Approved / Pending / Closed)
- Expandable to show: amount, currency, category, description, notes, receipt thumbnail

---

## Pages & Routing

### App Router structure:
```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── (dashboard)/
│   ├── layout.tsx        ← authenticated shell
│   ├── page.tsx          ← employee dashboard (redirect managers)
│   └── manager/
│       └── page.tsx      ← manager dashboard
└── layout.tsx            ← root layout with ConvexProvider + ConvexAuthProvider
```

---

## Screen-by-Screen Specification

### Auth: `(auth)/login/page.tsx`

- Centered card layout
- Fields: email, password
- "Sign in" button — calls Convex Auth `signIn("password", { email, password })`
- Link to register page
- Error: show inline message on invalid credentials
- Redirect to dashboard on success (role-based redirect: employees → `/`, managers → `/manager`)

---

### Auth: `(auth)/register/page.tsx`

- Fields: firstName, lastName, email, password, confirmPassword
- Validation: password min 8 / max 12 chars, passwords must match, email unique
- On success: create account + redirect to dashboard
- Note: all registered users get `"employee"` role (managers are seeded only)

---

### Dashboard Layout: `(dashboard)/layout.tsx`

Authenticated shell used by all dashboard pages:
- Top navigation bar with:
  - App name / logo left
  - Role indicator (pill showing "Employee" or "Manager") 
  - User name right
  - Sign out button
- Role-based nav links:
  - Employee: none needed (single page)
  - Manager: "Review Queue" | "My Expenses" tabs (or use tabs on the page itself)
- Redirect unauthenticated users to `/login`

---

### Employee Dashboard: `(dashboard)/page.tsx`

**Empty state** (no tickets):
- Centered icon/illustration
- Heading: "No expense tickets yet"
- Subtext link: "Click here to add a receipt" → opens New Ticket modal
- "＋ New Ticket" button top-right (always visible)

**With tickets** — TanStack Table with columns:
| Column | Source |
|---|---|
| Title | Latest `expenseVersion.title` |
| Category | Category name |
| Amount | `amount currencyCode` (e.g. "£185.00 GBP") |
| Status | `<StatusBadge>` |
| Last Updated | `formatDistanceToNow(updatedAt)` |

- Default sort: `updatedAt` descending
- Row click → opens `<ExpenseDetailModal>`
- "＋ New Ticket" button top-right, always visible

---

### New Ticket Modal: `components/expenses/ExpenseFormModal.tsx`

Used for both creating and editing draft expenses.

**Mode: Create** (new ticket)
**Mode: Edit** (editing a Draft)
**Mode: Resubmit** (editing after Rejection — shows `<RejectionBanner>` at top)

Form fields (all from FR Section 5.4):
| Field | Component | Notes |
|---|---|---|
| Title | `<Input>` | Required |
| Description | `<Textarea>` | Required |
| Category | `<Select>` | Populated from `listCategories` query |
| Amount | `<Input type="number">` | Accepts decimals |
| Currency | `<Select>` | ISO 4217 list from `lib/constants.ts` |
| Expense Date | `<Input type="date">` | Defaults to today |
| Receipt | File upload | Single file; JPEG/PNG/WEBP; max 5MB; shows preview after upload |
| Notes | `<Textarea>` | Optional |

**Receipt upload flow:**
1. User selects file → validate type and size client-side
2. Call `generateUploadUrl` mutation → get upload URL
3. POST file to upload URL
4. Store returned `storageId` in form state
5. Show inline image preview

**Footer actions:**
- **Save as Draft** → calls `createDraft` or `saveDraft`
- **Submit for Approval** → calls `submitExpense`
- **Cancel** → confirm if form is dirty; close modal

---

### Expense Detail Modal: `components/expenses/ExpenseDetailModal.tsx`

Used by employees to view any of their tickets. Opens on row click.

**Layout:**
1. **Header:** Title + `<StatusBadge>` + `<VersionBadge>`
2. **Rejection banner:** `<RejectionBanner>` if status is `Rejected` (or if `currentVersion > 1` in manager review)
3. **Expense info:** Category, Amount + Currency, Description, Expense Date, Optional Notes
4. **Receipt:** Inline image preview (signed URL via `getReceiptUrl`); click to open full size
5. **Approval/Rejection/Close info block:** Conditional on status (see FR Section 5.5)
6. **Action buttons:** Conditional on status + role (see editing rules in `CLAUDE.md`)
7. **Version History Panel:** `<VersionHistoryPanel>` — expandable accordion
8. **Status Timeline:** `<StatusTimeline>` — full audit history

**Action buttons by status (employee view):**
| Status | Buttons |
|---|---|
| Draft | "Edit" (opens edit mode) + "Submit for Approval" |
| Submitted | "Withdraw" (with confirmation dialog) |
| Under Review | None |
| Rejected | "Edit & Resubmit" |
| Approved | None |
| Closed | None |
| Withdrawn | None |

**Withdraw confirmation dialog:**  
> "Are you sure you want to withdraw this ticket? This action cannot be undone."  
> Buttons: "Cancel" | "Withdraw"

---

### Manager Dashboard: `(dashboard)/manager/page.tsx`

Tab layout with 3 tabs:
1. **Pending Review** (default)
2. **Reviewed History**
3. **My Expenses** (manager's own tickets — uses employee view)

**Summary stats row** (above tabs):
- Pending | Approved this month | Rejected this month | Total under management
- Live counts from `getManagerStats` query

---

### Manager Tab 1 — Pending Review Queue: `components/manager/PendingQueue.tsx`

TanStack Table columns:
| Column | Notes |
|---|---|
| Employee Name | Full name |
| Ticket Title | From latest version |
| Category | Category name |
| Amount | With currency |
| Submitted On | Absolute date |
| Status | `Submitted` or `Under Review` badge |

- Default sort: `submittedAt` ascending (FIFO)
- `Under Review` rows visually distinguished (slightly dimmed or amber row bg)
- Row click → `<ReviewModal>` + triggers `openForReview` mutation (if status is `Submitted`)

---

### Manager Review Modal: `components/manager/ReviewModal.tsx`

Full-screen or large modal. The manager reviews and actions a ticket.

**Left/top panel (read-only ticket info):**
- Employee name + role
- Title + `<VersionBadge>`
- `<RejectionBanner>` if `versionNumber > 1`
- Description, Category, Amount, Expense Date
- Receipt inline preview + download button
- `<VersionHistoryPanel>` (expandable)
- `<StatusTimeline>`

**Right/bottom panel (action controls):**

Three action buttons:

**Approve (green):**
- Optional textarea: "Add a note for the employee (optional)"
- On click: calls `approveExpense`

**Reject — needs correction (orange):**
- Required dropdown: Rejection reason (from `REJECTION_REASONS` constant)
- Required textarea: Rejection comment (min 10 chars)
- Both fields must be non-empty before confirm is active
- On click: calls `rejectExpense`

**Close permanently (dark red / destructive):**
- Required dropdown: Close reason (from `CLOSE_REASONS` constant)
- Required textarea: Close comment (min 10 chars)
- On click → shows confirmation dialog before committing

**Close Confirmation Dialog:**
> "You are permanently closing this expense. [Employee First Name] will not be able to edit or resubmit it. This cannot be undone."  
> Buttons: "Cancel" | "Close permanently" (red, destructive, disabled until closeComment is non-empty)

**Navigation arrows** (within modal):
- Previous / Next buttons to move through the pending queue
- Counter: "Reviewing 3 of 7 pending"
- Implement by passing the sorted queue array and current index as props

---

### Manager Tab 2 — Reviewed History: `components/manager/ReviewedHistory.tsx`

TanStack Table columns:
| Column | Notes |
|---|---|
| Employee Name | |
| Ticket Title | |
| Category | |
| Amount | With currency |
| Decision | `Approved` / `Rejected` / `Closed` badge |
| Decided On | Absolute date |

**Filter bar (above table):**
- Employee name search (text input, filters by name client-side)
- Status filter: All / Approved / Rejected / Closed (select)
- Date range: Start date + End date pickers
- Category filter: dropdown

Row click → opens `<ReviewModal>` in **read-only mode** (no action buttons shown).

---

### Manager Tab 3 — My Expenses

Reuse the employee expense table and modals. Render from the manager's own `getMyExpenses` query. Action buttons hidden for manager's own tickets in the review queue (enforced both server-side and in UI).

---

## Form Validation UX

- Errors appear **inline** below each field immediately on blur and on submit attempt
- Required field errors: "This field is required"
- Amount: must be > 0; "Amount must be greater than zero"
- Receipt: wrong type: "Only JPEG, PNG, and WEBP files are accepted"; too large: "File must be under 5 MB"
- Rejection/close comment: min 10 chars: "Comment must be at least 10 characters"
- All validation via React Hook Form + Zod resolvers

---

## Loading & Error States

**Loading:**
- Table views: render a skeleton with 5 placeholder rows while `useQuery` is loading
- Modals: show a centered spinner while expense detail is loading
- File upload: show a progress indicator during upload

**Errors:**
- Mutation failures: display a `<Toast>` notification (shadcn/ui `useToast`) with the `ConvexError` message
- Query failures: show an inline error state with a "Try again" button

---

## Real-Time Behaviour

Convex queries are reactive — the UI updates automatically when data changes. Explicitly leverage this:
- Manager's pending queue updates live when an employee submits a new expense
- Employee's ticket status updates live when a manager approves/rejects
- Manager stats counts update live

Do not add polling or manual refresh logic.

---

## Constraints

- No inline styles — Tailwind only
- No custom CSS files unless absolutely necessary (e.g., a specific animation not available in Tailwind)
- All `Id<"expenses">` and other Convex IDs are typed — do not use `string` for IDs
- Do not implement server-side logic — only consume the Backend agent's mutations and queries
- Mobile layout is a nice-to-have — desktop-first is acceptable for v1

---

## Handoff Checklist

- [ ] Login and register pages functional
- [ ] Employee dashboard with empty state and ticket table
- [ ] New ticket modal with all form fields, receipt upload, save/submit actions
- [ ] Expense detail modal with all status-conditional UI
- [ ] Status timeline and version history panel components
- [ ] Manager dashboard with stats + 3 tabs
- [ ] Pending queue table with FIFO sort and `Under Review` visual distinction
- [ ] Review modal with approve/reject/close actions
- [ ] Close confirmation dialog with employee name and irreversibility language
- [ ] Previous/Next navigation in review modal
- [ ] Reviewed history table with filters
- [ ] All status badges using correct colours
- [ ] All dates formatted with date-fns
- [ ] All forms use React Hook Form + Zod with inline errors
- [ ] Loading skeletons and error toasts implemented
- [ ] TypeScript compiles with zero errors
