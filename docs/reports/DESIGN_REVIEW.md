# Design Review Report — Agent 6

> Audit of Frontend Agent (Agent 3) output against the Design System Specification in `AGENT_6_DESIGN.md`.

---

## 1. Component Consistency

### StatusBadge
- **Colours:** All 7 statuses match the spec exactly (gray, blue, amber, green, orange, red, slate). Border classes are applied correctly via the `className` prop. ✅
- **Issue:** Missing `aria-label` for screen readers (spec requires `aria-label="Status: Under Review"` etc.).
- **Issue:** Badge uses `font-semibold` (from the shadcn `Badge` base) — spec calls for `font-medium`. Minor deviation, acceptable.

### VersionBadge
- **v1 spec:** Should be plain gray mono text (`text-xs text-gray-500 font-mono`), not a rounded badge. Currently renders as a full badge for v1. **Deviation.**
- **v2+ spec:** Should show `↩ Submission v2 — Resubmission` with amber background. Current implementation close but uses `Badge` component instead of a `<span>` with the spec's exact classes. Missing the `↩` prefix icon.

### RejectionBanner
- **Close match.** Uses `border-amber-300` instead of spec's `border-amber-200`. Minor deviation.
- Uses `AlertTriangle` icon — spec uses `⚠` text character. Acceptable equivalent.
- Structure matches spec (flex layout, heading + comment).

### StatusTimeline
- **Missing spec structure:** Spec uses `pl-6` with `absolute -left-1.5` dot positioning. Current uses `pl-4` with `-left-[21px]` — functionally similar but off-spec.
- **Missing `StatusBadge` in transitions:** Spec shows `<StatusBadge status={entry.oldStatus} /> → <StatusBadge status={entry.newStatus} />` but current just uses text labels.
- **Version badge:** Uses generic `Badge variant="outline"` instead of the `VersionBadge` component.
- **Comment styling:** Uses italic text; spec uses `bg-gray-50 rounded p-2 border border-gray-100` quote block.

---

## 2. Typography Consistency

| Element | Spec | Current | Match? |
|---|---|---|---|
| Page title | `text-xl font-semibold text-gray-900` | `text-2xl font-bold` | ❌ Too large, too heavy |
| Section heading | `text-base font-semibold text-gray-900` | Varies (`text-sm font-semibold`) | ❌ Undersized |
| Body text | `text-sm text-gray-700` | `text-sm` (uses theme foreground) | ~Partial |
| Label | `text-xs font-medium text-gray-500 uppercase tracking-wide` | `<Label>` component (no uppercase/tracking) | ❌ |
| Muted text | `text-xs text-gray-400` → should be `text-gray-500` for contrast | Uses `text-muted-foreground` (#737373) | ✅ Passes contrast |
| Danger text | `text-sm text-red-600` | `text-sm text-red-600` | ✅ |

**Key issues:** Page titles (`text-2xl font-bold`) are oversized vs spec (`text-xl font-semibold`). Form labels don't use the spec's uppercase/tracking-wide pattern.

---

## 3. Accessibility Gaps

### WCAG 2.1 AA Violations

| Component | Issue | Severity |
|---|---|---|
| `StatusBadge` | Missing `aria-label` (e.g., `aria-label="Status: Under Review"`) | Medium |
| Form error messages | Not connected via `aria-describedby` to their inputs | High |
| Table loading skeleton | Missing `aria-busy="true"` and `aria-live` region | Medium |
| Icon-only buttons (remove receipt, nav arrows) | Missing `aria-label` | High |
| Tables | Missing `<caption>` or `aria-label` | Medium |
| Sort direction changes | Not announced to screen readers | Low |
| Button loading states | Not using `aria-busy` or `aria-live="polite"` | Medium |

### Focus Management
- Modal focus trap: Handled by Radix `Dialog` primitives. ✅
- Password toggle `tabIndex={-1}`: Intentional exclusion but means keyboard users cannot toggle password visibility. Minor gap.

---

## 4. Responsive Layout Issues

| Area | Issue |
|---|---|
| Navigation bar | Height is `h-16` (spec says `h-14`). Role badge uses `Badge variant="secondary"` instead of the indigo role pill specified. |
| Manager stats row | Uses `text-blue-600` for Total; spec says `gray` for Total. `text-sm` label (spec: `text-xs uppercase tracking-wide`). |
| Manager review modal | Two-column layout with `lg:grid-cols-2` is correct. ✅ |
| Tables | No horizontal scroll wrapper at `sm:` breakpoint for narrow screens. |
| Empty states | Employee empty state is close to spec. Manager empty state is minimal text — missing the "All caught up" subtext. |

---

## 5. Empty/Loading/Error States

### Missing States
| State | Component | Status |
|---|---|---|
| Table skeleton | `ExpenseTable`, `PendingQueue`, `ReviewedHistory` | ✅ Present (single-bar skeletons) |
| Table skeleton (spec shape) | All tables | ❌ Spec wants multi-column shimmer rows, not single bars |
| Modal loading spinner | `ExpenseDetailModal`, `ReviewModal` | ✅ Present |
| Button loading spinners | Form submit/save, Approve, Reject, Close | ❌ Text-only change, no spinner icon |
| Empty state (employee) | `EmployeeDashboard` | ✅ Present |
| Empty state (manager pending) | `PendingQueue` | ✅ Present but minimal — missing heading structure |
| Empty state (manager history) | `ReviewedHistory` | ✅ Present (in-table) |

### Error States
- Form validation errors: ✅ Present below fields in `text-sm text-red-600`.
- Toast errors: ✅ Present for mutation failures.
- Banner errors: ✅ Present on auth pages.

---

## 6. Interaction Feedback

| Pattern | Status |
|---|---|
| Button loading state (spinner + disabled) | ❌ Uses text change only ("Submitting..."), no `<Loader2>` spinner |
| Disabled button when form invalid | ✅ Submit/Save disabled during mutations |
| Focus rings on buttons | ✅ Via `focus-visible:ring-2` in button variants |
| Remove receipt button aria-label | ❌ Missing — icon-only `<X>` button |
| Nav arrow buttons aria-label | ❌ Missing — icon-only `<ChevronLeft/Right>` buttons |

---

## Summary of Fixes Required (Priority Order)

1. **A11y: aria-label on StatusBadge** — add `aria-label="Status: {label}"`
2. **A11y: aria-describedby on form errors** — connect error `<p>` to input via ID
3. **A11y: aria-label on icon-only buttons** — receipt remove, nav arrows
4. **A11y: table aria-label** — add descriptive label to all `<table>` elements
5. **A11y: loading announcements** — `aria-busy` on skeletons, `aria-live` on loading regions
6. **Typography: Page titles** — `text-2xl font-bold` → `text-xl font-semibold`
7. **Typography: Stat card labels** — add `uppercase tracking-wide text-xs`
8. **Nav bar: Role pill** — switch from `Badge variant="secondary"` to indigo pill
9. **Nav bar: Height** — `h-16` → `h-14`
10. **StatusTimeline** — use StatusBadge for transitions, quote-block comments, VersionBadge
11. **VersionBadge v1** — plain mono text instead of badge
12. **Button loading states** — add `<Loader2>` spinner alongside text
13. **Table skeletons** — multi-column shimmer rows
14. **Manager empty state** — add heading + "All caught up" subtext
15. **RejectionBanner border** — `border-amber-300` → `border-amber-200`
