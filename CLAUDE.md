# Internal Expense Tracker — Master Context & Agent Orchestration Guide

> **Version:** 1.0 · March 2026  
> **Scope:** v1 — Single-level approval, email/password auth, no notifications  
> **Use this file as:** The authoritative context document passed to every agent. All agents must read this file before acting.

---

## 1. What We Are Building

An internal expense tracking web application that lets employees submit expense claims for manager approval. The system supports the full expense lifecycle: draft → submitted → under review → approved / rejected / closed, with version-snapshotted resubmissions after rejection and a permanent-close path.

This is an internal tool — not a public SaaS product. Clarity, correctness, and auditability take priority over marketing polish.

---

## 2. Technology Stack (Non-Negotiable)

| Layer | Technology | Notes |
|---|---|---|
| Backend / DB | **Convex** | Database, server functions, real-time queries, file storage |
| Auth | **Convex Auth** (email/password) | Session management, token signing |
| Frontend | **Next.js 16 (App Router)** | React, file-based routing |
| Styling | **Tailwind CSS** | Utility-first; no custom CSS files unless absolutely necessary |
| Components | **shadcn/ui** | Built on Radix UI — modals, dialogs, badges, dropdowns, form primitives |
| Tables | **TanStack Table v8** | All list/table views — sorting, filtering, pagination |
| Forms | **React Hook Form + Zod** | Zod schemas shared between client and Convex validators |
| Dates | **date-fns** | UTC storage → local display; relative time in lists, absolute in timelines |
| Language | **TypeScript** (strict) | All files — `.ts` / `.tsx` only |

Do **not** introduce additional libraries without explicit discussion. If a library is not on this list and you believe it is needed, flag it rather than adding it silently.

---

## 3. User Roles

| Role | Key Permissions |
|---|---|
| `employee` | Submit, view own expenses, withdraw (pre-review), resubmit after rejection |
| `manager` | View all expenses (except own for actioning), approve / reject / close any expense, submit own expenses |

- Role is a **string field** (`"employee"` | `"manager"`), not a boolean
- Permissions are evaluated from a **role-to-permission mapping** — never hardcoded `if role === "manager"` checks scattered through the codebase
- A manager **cannot** approve, reject, or close their own expense

---

## 4. Expense Status State Machine

```
Draft ──[Submit]──► Submitted ──[Manager opens]──► Under Review
                        │                               │
                   [Withdraw]                   ┌───────┼───────┐
                        │                    Approve  Reject   Close
                        ▼                       │       │       │
                   Withdrawn               Approved  Rejected  Closed
                   (terminal)             (terminal)   │     (terminal)
                                                  [Edit & Resubmit]
                                                        │
                                                      Draft
                                                        │
                                                   [Resubmit]
                                                        │
                                                   Submitted (v2, v3…)
```

**Key rules:**
- `Approved`, `Closed`, and `Withdrawn` are **terminal** — no further transitions
- `Rejected` → employee edits in place → `Draft` → `Submitted` (new version snapshot created)
- Withdrawal is only permitted while status is `Submitted` (not `Under Review` or later)
- Every status transition is recorded in `ExpenseHistory` (append-only)

---

## 5. Data Model (Convex Schema)

### `users`
```ts
{
  firstName: string,
  lastName: string,
  email: string,          // unique
  role: "employee" | "manager",
  createdAt: number,      // UTC ms
}
```

### `expenses`
```ts
{
  submittedBy: Id<"users">,
  status: "Draft" | "Submitted" | "UnderReview" | "Approved" | "Rejected" | "Closed" | "Withdrawn",
  currentVersion: number,     // increments on each submit/resubmit; starts at 1
  // Approval fields
  approvedBy?: Id<"users">,
  approvedAt?: number,
  approvalNote?: string,
  // Rejection fields
  rejectedBy?: Id<"users">,
  rejectedAt?: number,
  rejectionReason?: string,   // categorised
  rejectionComment?: string,  // free-text, required on rejection
  // Close fields
  closedBy?: Id<"users">,
  closedAt?: number,
  closeReason?: string,       // categorised
  closeComment?: string,      // free-text, required on close
  createdAt: number,
  updatedAt: number,
}
```

### `expenseVersions`
Append-only. One row per submit/resubmit.
```ts
{
  expenseId: Id<"expenses">,
  versionNumber: number,
  title: string,
  description: string,
  amount: number,
  currencyCode: string,       // ISO 4217
  categoryId: Id<"categories">,
  expenseDate: number,        // UTC ms
  receiptStorageId: string,   // Convex file storage ID
  notes?: string,
  submittedAt: number,
}
```

### `expenseHistory`
Append-only. One row per status transition.
```ts
{
  expenseId: Id<"expenses">,
  changedBy: Id<"users">,
  oldStatus: string,
  newStatus: string,
  comment?: string,
  versionNumber: number,      // version active at time of event
  changedAt: number,
}
```

### `categories`
Seeded data. 7 categories (see Section 7).
```ts
{
  name: string,
  description: string,
}
```

---

## 6. Key Business Rules (Enforced Server-Side)

1. **Receipt required** — every submission must have exactly one receipt image (JPEG/PNG/WEBP, max 5 MB). Validated client-side for UX and server-side authoritatively.
2. **Version snapshot on every submit** — a new `ExpenseVersion` row is created atomically with every `Draft → Submitted` or `Rejected → Submitted` transition. A submission cannot succeed without a corresponding version record.
3. **Status transitions are atomic** — use Convex mutations for all state changes; partial updates are not possible.
4. **Close is irreversible** — requires a confirmation dialog naming the employee and stating the action cannot be undone. `closeComment` must be non-empty before confirm becomes active.
5. **Manager cannot act on own expense** — all action buttons hidden; ticket is read-only for the submitting manager.
6. **`ExpenseVersions` and `ExpenseHistory` are never updated or deleted** — append-only.
7. **Withdrawal only pre-review** — withdraw only permitted while `status === "Submitted"`. Once `UnderReview`, withdrawal is locked.
8. **Zod schemas shared** — client-side form validation and Convex server validators use the same Zod schema. No duplicating validation logic.
9. **Password minimum 8 characters** — no upper limit. Passwords must be at least 8 characters long; there is no maximum length restriction.

---

## 7. Seeded Data

### Categories (7)
| Name | Description |
|---|---|
| Travel | Flights, trains, buses for business purposes |
| Accommodation | Hotels and short-term lodging |
| Meals & Entertainment | Client lunches, team dinners, business meals |
| Transportation | Taxis, rideshares, fuel, parking |
| Software & Subscriptions | Tools, licenses, SaaS subscriptions |
| Office Supplies | Hardware accessories, stationery |
| Other | Expenses not covered by other categories |

### Test Accounts
| Role | Name | Email | Password |
|---|---|---|---|
| Employee | Miles Morales | `miles@employee.dev` | `MilesEmployee@2026!` |
| Manager | Jack Black | `jack@manager.dev` | `JackManager@2026!` |

Seeded via `convex/seed.ts`. Run with `npx convex run seed`.

---

## 8. Status Badge Colour Reference

| Status | Colour | Tailwind Token |
|---|---|---|
| Draft | Grey | `bg-gray-100 text-gray-700` |
| Submitted | Blue | `bg-blue-100 text-blue-700` |
| Under Review | Amber | `bg-amber-100 text-amber-700` |
| Approved | Green | `bg-green-100 text-green-700` |
| Rejected | Orange | `bg-orange-100 text-orange-700` |
| Closed | Dark Red | `bg-red-100 text-red-800` |
| Withdrawn | Slate | `bg-slate-100 text-slate-600` |

These colours are **consistent across all views** — employee and manager.

---

## 9. Project File Structure

```
/
├── app/                        # Next.js App Router
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx          # Authenticated shell with nav
│   │   ├── page.tsx            # Employee dashboard (own tickets)
│   │   └── manager/
│   │       └── page.tsx        # Manager dashboard (queue + history)
│   └── layout.tsx              # Root layout (ConvexProvider, Auth)
├── components/
│   ├── ui/                     # shadcn/ui re-exports
│   ├── expenses/               # Expense-specific components
│   │   ├── ExpenseTable.tsx
│   │   ├── ExpenseFormModal.tsx
│   │   ├── ExpenseDetailModal.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── VersionHistoryPanel.tsx
│   │   └── StatusTimeline.tsx
│   └── manager/
│       ├── ReviewModal.tsx
│       ├── PendingQueue.tsx
│       └── ReviewedHistory.tsx
├── convex/
│   ├── schema.ts               # Convex schema definition
│   ├── auth.config.ts          # Convex Auth config
│   ├── seed.ts                 # Seed script (categories + test accounts)
│   ├── expenses.ts             # Expense mutations & queries
│   ├── users.ts                # User queries
│   ├── categories.ts           # Category queries
│   └── files.ts                # File upload/storage helpers
├── lib/
│   ├── validators.ts           # Shared Zod schemas (client + server)
│   ├── permissions.ts          # Role → permission mapping
│   └── constants.ts            # Status enums, rejection reasons, close reasons
├── .env.example
├── README.md
└── CLAUDE.md                   # This file
```

---

## 10. Environment Variables

```env
# Convex
NEXT_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud
CONVEX_DEPLOY_KEY=your_convex_deploy_key_here
CONVEX_AUTH_SECRET=your_convex_auth_secret_here

# App
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

---

## 11. Agent Roster & Responsibilities

| Agent | File | Primary Responsibility |
|---|---|---|
| Architect | `AGENT_1_ARCHITECT.md` | Schema, auth config, Convex setup, project scaffolding |
| Backend | `AGENT_2_BACKEND.md` | Mutations, queries, business logic, validation, error handling |
| Frontend | `AGENT_3_FRONTEND.md` | All UI — pages, modals, tables, forms, dashboards |
| QA | `AGENT_4_QA.md` | Automated tests — unit, integration, E2E (Playwright) |
| Security | `AGENT_5_SECURITY.md` | Auth rules, server-side enforcement, input validation, audit trail |
| Design | `AGENT_6_DESIGN.md` | UI/UX patterns, accessibility, responsive layout, component design |

**Agent execution order:** Architect → Backend → Security → Frontend → Design → QA

Each agent must:
1. Read this `CLAUDE.md` in full before acting
2. Not introduce libraries outside the approved stack without flagging
3. Not duplicate validation logic — reference `lib/validators.ts`
4. Not make assumptions about business rules — if uncertain, reference the FR/NFR documents

---

## 12. Out of Scope (v1)

Do **not** build any of the following — if a user request implies these, push back:

- Multi-level approval chains
- Email or in-app notifications  
- i18n / multi-language
- Currency conversion / FX logic
- Bulk export / reporting
- Admin panel for user management
- Banking details / reimbursement processing
- Duplicate receipt detection
- Shared / split expenses

---

## 13. Definition of Done

A feature is complete when:
- [ ] Convex mutation/query is implemented with server-side auth and validation
- [ ] Zod schema covers all inputs (shared between client and server)
- [ ] UI reflects all status states with correct badge colours
- [ ] All status transitions write to `ExpenseHistory`
- [ ] All submissions create an `ExpenseVersion` snapshot
- [ ] Manager cannot act on own expense (tested)
- [ ] Close action shows confirmation dialog with employee name
- [ ] Receipt upload validates file type and size client-side and server-side
- [ ] TypeScript compiles with zero errors (`next build` passes)
- [ ] Feature is testable end-to-end with the two seeded test accounts

---

*This document is the single source of truth for agent context. Update it if requirements change — do not let agents operate from stale context.*
