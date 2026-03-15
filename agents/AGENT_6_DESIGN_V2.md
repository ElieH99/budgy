# Agent 6 — Design (v2 Enhancement Pass)
## Internal Expense Tracker

> **Read `CLAUDE.md` in full before proceeding.** This prompt extends it — it does not replace it.  
> **Context:** The initial Design agent (v1) has already been run. The application is functional and styled.  
> **Your job is an enhancement pass** — not a review or a rebuild. You are adding three specific upgrades to a working codebase:
> 1. Replace any hand-rolled UI with the correct shadcn/ui primitives
> 2. Replace the expense date `<input type="date">` with the shadcn `<Calendar>` + `<Popover>` date picker
> 3. Fill whitespace gaps — every page section that currently sits empty or sparse gets purposeful content

Do not re-implement what already works. Do not regenerate the design review report. Ship code.

---

## Pre-Work: Audit What Exists

Before changing anything, read the following files in full:

- `components/expenses/ExpenseFormModal.tsx`
- `components/expenses/ExpenseDetailModal.tsx`
- `components/manager/ReviewModal.tsx`
- `components/manager/PendingQueue.tsx`
- `components/manager/ReviewedHistory.tsx`
- `app/(dashboard)/page.tsx`
- `app/(dashboard)/manager/page.tsx`
- `components/ui/` — list every shadcn component already installed

Then build a quick mental inventory:
- Which shadcn components are already imported and used correctly?
- Which UI elements were built by hand that have a shadcn equivalent (e.g. a `<select>` instead of `<Select>`, a raw `<input>` instead of `<Input>`, a hand-rolled tooltip instead of `<Tooltip>`)?
- Which page areas render with large blank/sparse regions?

Proceed with the three enhancement tasks below.

---

## Enhancement 1 — shadcn/ui Component Audit & Replacement

### Install any missing shadcn components first

Run the following if not already installed:

```bash
npx shadcn@latest add calendar
npx shadcn@latest add popover
npx shadcn@latest add tooltip
npx shadcn@latest add separator
npx shadcn@latest add scroll-area
npx shadcn@latest add hover-card
npx shadcn@latest add card
npx shadcn@latest add skeleton
npx shadcn@latest add progress
```

Only install what is actually needed for the replacements below. Do not install speculatively.

---

### Replacement Map

For every instance found in the codebase, replace the hand-rolled element with the correct shadcn primitive. Use this as your reference:

| Hand-rolled pattern | Replace with | Notes |
|---|---|---|
| `<select className="...">` | `<Select>` + `<SelectTrigger>` + `<SelectContent>` + `<SelectItem>` | Used in category, currency, rejection reason, close reason dropdowns |
| `<input type="text" className="border ...">` | `<Input>` from shadcn | All text inputs in forms |
| `<textarea className="border ...">` | `<Textarea>` from shadcn | Description, notes, rejection comment, close comment |
| `<input type="date" ...>` | `<Calendar>` + `<Popover>` date picker — see Enhancement 2 | Expense date field specifically |
| `<hr />` or `<div className="border-t ...">` used as dividers | `<Separator>` | Section dividers inside modals and panels |
| Overflow-scroll `<div>` containers with fixed height | `<ScrollArea>` | Modal body, version history panel, status timeline — any scrollable region |
| Tooltip-like `title="..."` attribute on buttons | `<Tooltip>` + `<TooltipTrigger>` + `<TooltipContent>` | Action buttons, icon buttons, truncated text |
| `<div className="rounded border p-4 ...">` cards | `<Card>` + `<CardHeader>` + `<CardContent>` | Stats cards, expense detail info blocks, version entries |
| `<div className="animate-pulse ...">` skeleton rows | `<Skeleton>` | Table loading rows, modal loading states |
| `<div className="w-full bg-gray-200 ...">` progress bars | `<Progress>` | File upload progress indicator |

**For each replacement:**
1. Import the component from `@/components/ui/[component]`
2. Apply the same Tailwind classes for sizing/spacing that were on the replaced element
3. Do not change the component's data props or event handlers — only the markup

---

### Select Component — Detailed Spec

The `<Select>` replacement is the most common. Apply this pattern everywhere a `<select>` exists:

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Category dropdown
<Select
  value={field.value}
  onValueChange={field.onChange}
>
  <SelectTrigger className="w-full">
    <SelectValue placeholder="Select a category" />
  </SelectTrigger>
  <SelectContent>
    {categories.map((cat) => (
      <SelectItem key={cat._id} value={cat._id}>
        {cat.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>

// Rejection reason dropdown
<Select
  value={field.value}
  onValueChange={field.onChange}
>
  <SelectTrigger className="w-full">
    <SelectValue placeholder="Select a reason" />
  </SelectTrigger>
  <SelectContent>
    {REJECTION_REASONS.map((reason) => (
      <SelectItem key={reason} value={reason}>
        {reason}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

Wire into React Hook Form using `<Controller>` if the field is not already using it:

```tsx
<Controller
  control={control}
  name="categoryId"
  render={({ field }) => (
    <Select value={field.value} onValueChange={field.onChange}>
      ...
    </Select>
  )}
/>
```

---

### Card Component — Detailed Spec

Replace bare `<div>` containers used as info cards with shadcn `<Card>`. Apply to:

**Manager stats cards:**
```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

<Card>
  <CardHeader className="pb-2">
    <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
      Pending
    </CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
    <p className="text-xs text-muted-foreground mt-1">awaiting review</p>
  </CardContent>
</Card>
```

**Expense detail info block inside modals:**
```tsx
<Card className="bg-gray-50 border-gray-100">
  <CardContent className="pt-4 space-y-3">
    {/* expense fields */}
  </CardContent>
</Card>
```

**Version history entries (inside VersionHistoryPanel):**
```tsx
<Card className="border-gray-100">
  <CardContent className="pt-3 pb-3">
    {/* version fields */}
  </CardContent>
</Card>
```

---

### ScrollArea Component — Detailed Spec

Replace any fixed-height overflow-scroll containers:

```tsx
import { ScrollArea } from "@/components/ui/scroll-area"

// Modal body
<ScrollArea className="h-[60vh] px-6">
  {/* modal content */}
</ScrollArea>

// Status timeline
<ScrollArea className="h-64">
  <StatusTimeline entries={history} />
</ScrollArea>

// Version history panel
<ScrollArea className="h-48">
  <VersionHistoryPanel versions={versions} />
</ScrollArea>
```

---

### Tooltip Component — Detailed Spec

Add tooltips to icon-only buttons and any text that may be truncated:

```tsx
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Wrap the root layout or dashboard layout with TooltipProvider once:
<TooltipProvider>
  {children}
</TooltipProvider>

// Icon button with tooltip
<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="icon" aria-label="Download receipt">
      <DownloadIcon className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>Download receipt</TooltipContent>
</Tooltip>

// Truncated ticket title in table
<Tooltip>
  <TooltipTrigger asChild>
    <span className="truncate max-w-[180px] block">{title}</span>
  </TooltipTrigger>
  <TooltipContent>{title}</TooltipContent>
</Tooltip>
```

Add `<Tooltip>` to: receipt download button, previous/next navigation arrows in review modal, any table cell with truncated text, the sign-out button if icon-only.

---

### Skeleton Component — Detailed Spec

Replace `animate-pulse` div skeletons with the shadcn `<Skeleton>`:

```tsx
import { Skeleton } from "@/components/ui/skeleton"

// Table row skeleton (5 rows)
function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-24 rounded-full" />  {/* badge shape */}
          <Skeleton className="h-4 w-28" />
        </div>
      ))}
    </div>
  )
}

// Stats card skeleton
function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-3 w-20" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-12" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Modal content skeleton
function ModalSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-32 w-full rounded-md" />
    </div>
  )
}
```

---

## Enhancement 2 — Calendar Date Picker

Replace every `<input type="date">` in the codebase with a shadcn Calendar + Popover date picker. This applies to:

- `ExpenseFormModal.tsx` — the "Expense Date" field
- `ReviewedHistory.tsx` — the date range filter (start date + end date, two separate pickers)
- Any other date input found during the audit

### Installation (if not already done above)

```bash
npx shadcn@latest add calendar
npx shadcn@latest add popover
```

Also install `react-day-picker` if not present (shadcn Calendar depends on it):

```bash
npm install react-day-picker date-fns
```

---

### Date Picker Component: `components/ui/date-picker.tsx`

Create this reusable component. Use it everywhere a date input is needed.

```tsx
"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  value?: Date
  onChange: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  /** Prevent selecting dates after today (useful for expense dates) */
  disableFuture?: boolean
  /** Prevent selecting dates before this date */
  fromDate?: Date
  /** Prevent selecting dates after this date */
  toDate?: Date
  className?: string
  id?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled = false,
  disableFuture = false,
  fromDate,
  toDate,
  className,
  id,
}: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {value ? format(value, "dd MMM yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          disabled={(date) => {
            if (disableFuture && date > new Date()) return true
            if (fromDate && date < fromDate) return true
            if (toDate && date > toDate) return true
            return false
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
```

---

### Date Picker — Usage in ExpenseFormModal

Replace the expense date `<input type="date">` field:

```tsx
import { DatePicker } from "@/components/ui/date-picker"

// Inside the form, replacing the date input:
<div className="space-y-1.5">
  <label
    htmlFor="expenseDate"
    className="text-xs font-medium text-gray-500 uppercase tracking-wide"
  >
    Expense Date *
  </label>
  <Controller
    control={control}
    name="expenseDate"
    render={({ field }) => (
      <DatePicker
        id="expenseDate"
        value={field.value ? new Date(field.value) : undefined}
        onChange={(date) => field.onChange(date ? date.getTime() : undefined)}
        placeholder="Select expense date"
        disableFuture={true}
      />
    )}
  />
  {errors.expenseDate && (
    <p className="text-xs text-red-600" id="expenseDate-error">
      {errors.expenseDate.message}
    </p>
  )}
</div>
```

**Important:** The Convex schema stores `expenseDate` as a UTC timestamp (number). Convert: `Date → date.getTime()` on save; `number → new Date(value)` on load.

---

### Date Range Picker — Usage in ReviewedHistory filters

Replace the two date `<input type="date">` fields in the filter bar with a pair of `<DatePicker>` components that constrain each other:

```tsx
const [startDate, setStartDate] = React.useState<Date | undefined>()
const [endDate, setEndDate] = React.useState<Date | undefined>()

// In the filter bar:
<div className="flex items-center gap-2">
  <DatePicker
    value={startDate}
    onChange={(date) => {
      setStartDate(date)
      // Reset end date if it's now before start date
      if (endDate && date && endDate < date) setEndDate(undefined)
    }}
    placeholder="From date"
    toDate={endDate}
  />
  <span className="text-muted-foreground text-sm">to</span>
  <DatePicker
    value={endDate}
    onChange={setEndDate}
    placeholder="To date"
    fromDate={startDate}
  />
  {(startDate || endDate) && (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => { setStartDate(undefined); setEndDate(undefined) }}
    >
      Clear
    </Button>
  )}
</div>
```

Pass `startDate` and `endDate` to your existing filter logic as timestamps: `startDate?.getTime()` and `endDate?.getTime()`.

---

## Enhancement 3 — Whitespace & Empty Area Improvements

Identify every page and panel that currently has a large blank region and fill it with purposeful content. The goal is that no area feels unfinished — every part of the screen either has content, a well-designed empty state, or a summary widget that adds value.

Work through each area below.

---

### 3.1 Employee Dashboard — Above the Table

**Current:** The "＋ New Ticket" button sits in the top-right and the table fills below. If the user has expenses, the area between the nav and the table is typically a single header line with whitespace.

**Fix:** Add a summary strip between the page header and the table. Use a `<Card>`-based row of 3 mini stats:

```tsx
// components/expenses/ExpenseSummaryStrip.tsx
import { Card, CardContent } from "@/components/ui/card"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"

export function ExpenseSummaryStrip() {
  const expenses = useQuery(api.expenses.getMyExpenses)

  const pending = expenses?.filter(e =>
    ["Submitted", "UnderReview"].includes(e.status)
  ).length ?? 0

  const approved = expenses?.filter(e => e.status === "Approved").length ?? 0
  const drafts = expenses?.filter(e => e.status === "Draft").length ?? 0

  const stats = [
    { label: "Pending Review", value: pending, colour: "text-blue-600" },
    { label: "Approved", value: approved, colour: "text-green-600" },
    { label: "Drafts", value: drafts, colour: "text-gray-500" },
  ]

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-gray-100">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {stat.label}
            </p>
            <p className={`text-2xl font-bold mt-1 ${stat.colour}`}>
              {stat.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

Render this above the expense table when at least one expense exists. Do not show it on the empty state — it would read as "0 / 0 / 0" and add no value.

---

### 3.2 Employee Dashboard — Empty State Enhancement

**Current:** Centered icon, heading, and a single line of text.

**Fix:** Give the empty state a richer feel with a brief onboarding guide below the CTA:

```tsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  {/* Icon */}
  <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-5">
    <ReceiptText className="w-7 h-7 text-indigo-400" />
  </div>

  {/* Heading + CTA */}
  <h3 className="text-base font-semibold text-gray-900 mb-1">
    No expense tickets yet
  </h3>
  <p className="text-sm text-muted-foreground mb-6">
    Submit your first expense to get started.
  </p>
  <Button onClick={openNewTicketModal}>
    <Plus className="mr-2 h-4 w-4" /> New Ticket
  </Button>

  {/* How it works — 3-step mini guide */}
  <div className="mt-10 grid grid-cols-3 gap-6 max-w-lg text-left">
    {[
      {
        icon: <FilePlus className="h-4 w-4 text-indigo-500" />,
        title: "1. Create",
        body: "Fill in the expense details and attach your receipt.",
      },
      {
        icon: <Send className="h-4 w-4 text-blue-500" />,
        title: "2. Submit",
        body: "Send it to your manager for review.",
      },
      {
        icon: <CheckCircle className="h-4 w-4 text-green-500" />,
        title: "3. Get approved",
        body: "Track status in real time — no chasing needed.",
      },
    ].map((step) => (
      <div key={step.title} className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          {step.icon}
          <span className="text-xs font-semibold text-gray-700">{step.title}</span>
        </div>
        <p className="text-xs text-muted-foreground">{step.body}</p>
      </div>
    ))}
  </div>
</div>
```

---

### 3.3 Manager Dashboard — Empty Pending Queue

**Current:** Shows a plain "No pending expenses" message that leaves the entire queue area blank.

**Fix:** Add a contextual empty state with a recent activity preview:

```tsx
// components/manager/PendingQueueEmpty.tsx
import { CheckCircle2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export function PendingQueueEmpty({ recentlyActioned }: {
  recentlyActioned: { title: string; employeeName: string; decision: string; decidedAt: number }[]
}) {
  return (
    <div className="py-16 flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mb-4">
        <CheckCircle2 className="w-6 h-6 text-green-500" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">All caught up</h3>
      <p className="text-sm text-muted-foreground mb-8">
        No expenses are waiting for review right now.
      </p>

      {recentlyActioned.length > 0 && (
        <div className="w-full max-w-md text-left">
          <Separator className="mb-4" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Recently actioned
          </p>
          <div className="space-y-2">
            {recentlyActioned.slice(0, 3).map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-gray-800">{item.title}</span>
                  <span className="text-muted-foreground ml-1">· {item.employeeName}</span>
                </div>
                <StatusBadge status={item.decision as ExpenseStatus} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

Pass the last 3 entries from `getReviewedHistory` as `recentlyActioned`.

---

### 3.4 Manager Dashboard — Reviewed History (empty state)

**Current:** Blank table area with no rows.

**Fix:**

```tsx
<div className="py-12 flex flex-col items-center text-center text-muted-foreground">
  <History className="w-8 h-8 mb-3 text-gray-300" />
  <p className="text-sm font-medium text-gray-600">No actioned expenses yet</p>
  <p className="text-xs mt-1">
    Expenses you approve, reject, or close will appear here.
  </p>
</div>
```

---

### 3.5 Expense Detail Modal — Below the Receipt

**Current:** Receipt image renders, then a gap before the version history panel. This gap is especially noticeable on short expenses.

**Fix:** Add an expense metadata summary card between the receipt and the panels. This gives the modal a sense of completeness rather than a dropped-off layout:

```tsx
// Inside ExpenseDetailModal, after the receipt block:
<Card className="bg-gray-50 border-gray-100 mt-4">
  <CardContent className="pt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
    <div>
      <span className="text-xs text-muted-foreground uppercase tracking-wide">Category</span>
      <p className="font-medium text-gray-800 mt-0.5">{categoryName}</p>
    </div>
    <div>
      <span className="text-xs text-muted-foreground uppercase tracking-wide">Amount</span>
      <p className="font-medium text-gray-800 mt-0.5">
        {amount.toFixed(2)} {currencyCode}
      </p>
    </div>
    <div>
      <span className="text-xs text-muted-foreground uppercase tracking-wide">Expense Date</span>
      <p className="font-medium text-gray-800 mt-0.5">
        {format(new Date(expenseDate), "dd MMM yyyy")}
      </p>
    </div>
    <div>
      <span className="text-xs text-muted-foreground uppercase tracking-wide">Submitted</span>
      <p className="font-medium text-gray-800 mt-0.5">
        {submittedAt ? format(new Date(submittedAt), "dd MMM yyyy") : "—"}
      </p>
    </div>
    {notes && (
      <div className="col-span-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">Notes</span>
        <p className="text-gray-700 mt-0.5">{notes}</p>
      </div>
    )}
  </CardContent>
</Card>
```

---

### 3.6 Manager Review Modal — Right Panel (before action is selected)

**Current:** The approve/reject/close buttons sit in the right panel with nothing else — the panel looks sparse before the manager clicks an action.

**Fix:** Add a brief summary of who submitted the expense and when, plus a visual emphasis on what state the ticket is in, above the action buttons:

```tsx
// Right panel — top section, above action buttons
<div className="space-y-4 mb-6">
  {/* Submitter info card */}
  <Card className="border-gray-100 bg-gray-50">
    <CardContent className="pt-3 pb-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm shrink-0">
        {submitterFirstName[0]}{submitterLastName[0]}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">
          {submitterFirstName} {submitterLastName}
        </p>
        <p className="text-xs text-muted-foreground">Employee</p>
      </div>
    </CardContent>
  </Card>

  {/* Current status */}
  <div className="flex items-center justify-between">
    <span className="text-xs text-muted-foreground uppercase tracking-wide">
      Current status
    </span>
    <StatusBadge status={expense.status} />
  </div>

  {/* Version context */}
  {expense.currentVersion > 1 && (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">
        Submission
      </span>
      <VersionBadge versionNumber={expense.currentVersion} />
    </div>
  )}

  <Separator />
</div>
```

---

### 3.7 Version History Panel — Empty / Single-Version State

**Current:** If only v1 exists (no rejection cycles), the panel may render awkwardly or just show one small row.

**Fix:** When `versions.length === 1`, instead of showing the accordion, show a simple one-liner:

```tsx
{versions.length === 1 ? (
  <p className="text-xs text-muted-foreground py-2 px-1">
    First submission — no prior versions.
  </p>
) : (
  // existing accordion
)}
```

---

### 3.8 Status Timeline — Empty State

**Current:** If history is empty (just-created draft), the timeline renders nothing.

**Fix:**

```tsx
{history.length === 0 ? (
  <p className="text-xs text-muted-foreground py-3 px-1 italic">
    No status changes recorded yet.
  </p>
) : (
  // existing timeline
)}
```

---

### 3.9 Settings / Profile Page — Sparse Layout

If the app has a Settings page (profile edit), it likely renders a bare form on a white background with large margins.

**Fix:** Wrap the form in a `<Card>` with a descriptive header:

```tsx
<div className="max-w-xl">
  <div className="mb-6">
    <h1 className="text-xl font-semibold text-gray-900">Profile Settings</h1>
    <p className="text-sm text-muted-foreground mt-1">
      Update your name and email address.
    </p>
  </div>
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Personal Information</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* form fields */}
    </CardContent>
    <CardFooter className="border-t pt-4 flex justify-end">
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save changes"}
      </Button>
    </CardFooter>
  </Card>
</div>
```

---

## HoverCard — Expense Row Preview (New Feature)

Add a `<HoverCard>` to each table row's title cell. When the user hovers the ticket title, a popover shows a compact preview without opening the full modal. This eliminates the click-to-peek workflow.

```tsx
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"

// In the table row title cell:
<HoverCard openDelay={400} closeDelay={100}>
  <HoverCardTrigger asChild>
    <button className="text-sm font-medium text-gray-900 hover:text-indigo-600 
                       transition-colors text-left truncate max-w-[200px]">
      {title}
    </button>
  </HoverCardTrigger>
  <HoverCardContent className="w-72" align="start">
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <StatusBadge status={status} />
        <VersionBadge versionNumber={currentVersion} />
      </div>
      <div className="text-sm font-medium text-gray-900 line-clamp-2">{title}</div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{categoryName}</span>
        <span>·</span>
        <span className="font-medium text-gray-700">
          {amount.toFixed(2)} {currencyCode}
        </span>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
      <p className="text-xs text-muted-foreground">
        Updated {formatDistanceToNow(updatedAt, { addSuffix: true })}
      </p>
    </div>
  </HoverCardContent>
</HoverCard>
```

Apply to both the employee dashboard table and the manager pending queue table.

---

## Constraints

- Do not change Convex mutations or queries
- Do not change `lib/validators.ts`, `lib/permissions.ts`, or `lib/constants.ts`
- Do not install npm packages other than those listed in the install commands above
- Do not touch the auth pages (login/register) — they are out of scope for this pass
- All changes must be TypeScript-clean — no new type errors
- Do not remove any existing functionality while replacing markup — only substitute the UI primitive

---

## Handoff Checklist

**Enhancement 1 — shadcn replacements:**
- [ ] All `<select>` elements replaced with shadcn `<Select>` (category, currency, rejection reason, close reason)
- [ ] All bare `<input type="text">` form fields replaced with shadcn `<Input>`
- [ ] All bare `<textarea>` fields replaced with shadcn `<Textarea>`
- [ ] All hand-rolled divider lines replaced with `<Separator>`
- [ ] All fixed-height overflow-scroll containers replaced with `<ScrollArea>`
- [ ] Tooltips added to icon-only buttons and truncated table cells
- [ ] Stats cards replaced with shadcn `<Card>`
- [ ] Expense detail info block replaced with shadcn `<Card>`
- [ ] All `animate-pulse` skeleton rows replaced with shadcn `<Skeleton>`
- [ ] File upload progress bar replaced with shadcn `<Progress>` (if upload progress exists)
- [ ] `<TooltipProvider>` added to dashboard layout root

**Enhancement 2 — Calendar date picker:**
- [ ] `DatePicker` component created at `components/ui/date-picker.tsx`
- [ ] Expense date field in `ExpenseFormModal` replaced with `<DatePicker disableFuture>`
- [ ] Start/end date filters in `ReviewedHistory` replaced with paired `<DatePicker>` components
- [ ] Date values correctly converted: `Date ↔ number (UTC ms)` at the form boundary
- [ ] Clear button works for date range filter

**Enhancement 3 — Whitespace improvements:**
- [ ] Employee dashboard summary strip (3 mini stats) added above table
- [ ] Employee empty state enhanced with 3-step onboarding guide
- [ ] Manager pending queue empty state shows "all caught up" + recent activity
- [ ] Manager reviewed history empty state added
- [ ] Expense detail modal metadata card added below receipt
- [ ] Manager review modal right panel has submitter card + status summary above action buttons
- [ ] Version history panel shows "first submission" copy when only v1 exists
- [ ] Status timeline shows empty state copy when no entries

**New feature:**
- [ ] `<HoverCard>` preview added to expense title cells in employee table
- [ ] `<HoverCard>` preview added to ticket title cells in manager pending queue

**Quality:**
- [ ] `next build` completes with zero TypeScript errors
- [ ] Zero regressions — all existing functionality still works
- [ ] No duplicate imports or unused imports introduced
