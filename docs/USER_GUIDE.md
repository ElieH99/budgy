# User Guide — Internal Expense Tracker

This guide covers everything employees and managers need to know to use the expense tracker day-to-day.

---

## Getting Started

### Registering an account

Navigate to `/register`. Fill in your first name, last name, email address, and a password (minimum 8 characters). Your account role (employee or manager) is assigned by your administrator.

### Logging in

Navigate to `/login` and enter your email and password. You will be redirected to your dashboard automatically.

### Automatic sign-out

For security, you will be signed out automatically after 15 minutes of inactivity.

---

## Employee Workflows

### Submitting an expense

1. From your dashboard, click **New Ticket**.
2. Fill in all required fields:
   - **Title** — a short description of the expense (e.g. "Client lunch — March 2026")
   - **Description** — a fuller explanation
   - **Amount** — the expense amount
   - **Currency** — select from the supported list (USD, EUR, GBP, and others)
   - **Category** — choose the most appropriate category
   - **Date** — the date the expense was incurred
   - **Receipt** — upload a JPEG, PNG, or WEBP image (max 5 MB). Required before you can submit.
   - **Notes** — optional additional context
3. Click **Save as Draft** at any time to save your progress.
4. Click **Submit for Approval** when you are ready to send the expense to a manager.

> A receipt is required. The form will not allow you to submit without one.

### Tracking your expenses

Your dashboard lists all your expenses sorted by most recently updated. Each row shows the current status, amount, and category. Click any row to open the full expense detail, including the version history and audit timeline.

### Withdrawing a submitted expense

If you submitted an expense by mistake and a manager has not yet opened it, you can withdraw it:

1. Open the expense detail.
2. Click **Withdraw**.

A withdrawn expense is permanent — it cannot be resubmitted. If you need to make corrections before a manager reviews it, withdraw and create a new expense.

> Withdrawal is only available while the status is **Submitted**. Once a manager opens the expense (status changes to **Under Review**), withdrawal is locked.

### Resubmitting after rejection

When a manager rejects an expense, you will see the rejection reason and a comment explaining what was wrong. To resubmit:

1. Open the rejected expense.
2. Click **Edit & Resubmit** — this returns the expense to **Draft** status with your previous data pre-populated.
3. Make the required corrections (update the receipt, amount, or other fields as needed).
4. Click **Submit for Approval** to send the revised expense back for review.

A new version snapshot is created on every resubmission. The manager can see all previous versions.

---

## Manager Workflows

Managers can see all expenses submitted by other employees. A manager cannot approve, reject, or close their own expense.

### Review queue

The **Pending** tab shows all expenses with status **Submitted** or **Under Review** (excluding your own). Expenses are sorted by submission date — oldest first — so you process the queue in order.

Click any expense to open the review modal.

### Opening an expense for review

When you click an expense in the pending queue, it automatically moves from **Submitted** to **Under Review**. This signals to the employee (and other managers) that someone is actively reviewing it.

### Approving an expense

In the review modal:

1. Review the expense details, category, amount, and receipt.
2. Optionally add an approval note.
3. Click **Approve**.

The expense moves to **Approved** (terminal — no further changes possible).

### Rejecting an expense

In the review modal:

1. Select a rejection reason from the dropdown:
   - Missing receipt
   - Incorrect amount
   - Out of policy
   - Duplicate
   - Other
2. Write a rejection comment (minimum 10 characters) explaining the issue clearly.
3. Click **Reject**.

The expense moves to **Rejected**. The employee can then edit and resubmit.

### Closing an expense

Close is a permanent, irreversible action used for cases where the expense should never proceed (e.g. fraudulent receipt, employee no longer with the company).

In the review modal:

1. Select a close reason:
   - Duplicate submission
   - Fraudulent receipt
   - Permanently out of policy
   - Employee no longer with company
   - Other
2. Write a close comment (minimum 10 characters).
3. Once the comment is at least 10 characters, the **Close Permanently** button becomes active. Click it to open a confirmation dialog naming the employee and stating the action cannot be undone.
4. Click **Close permanently** to confirm.

The expense moves to **Closed** (terminal — no further changes possible).

### Reviewed history

The **History** tab shows all expenses you have actioned: approved, rejected, and closed. You can filter by status, category, and employee.

---

## Expense Statuses

| Status | Colour | Meaning |
|---|---|---|
| Draft | Grey | Saved but not yet submitted |
| Submitted | Blue | Waiting for a manager to open |
| Under Review | Amber | A manager has opened it and is reviewing |
| Approved | Green | Approved — no further action required |
| Rejected | Orange | Rejected — employee can edit and resubmit |
| Closed | Dark Red | Permanently closed — no further action possible |
| Withdrawn | Slate | Withdrawn by the employee before review |

**Approved**, **Closed**, and **Withdrawn** are terminal statuses — no transitions are possible from these states.

---

## Receipt Requirements

- **Accepted formats:** JPEG, PNG, WEBP
- **Maximum file size:** 5 MB
- **Required:** You cannot submit an expense without a receipt

---

## FAQ

**Can I edit an expense after submitting it?**
No — once submitted, you can only withdraw it (if it hasn't been reviewed yet) or wait for the manager's decision. If rejected, you can edit and resubmit.

**What happens after rejection?**
You will see the rejection reason and comment on your expense. Click **Edit & Resubmit** to correct the expense and send it back for review. Your original data is pre-filled so you only need to change what was flagged.

**Can I withdraw an expense that is Under Review?**
No. Withdrawal is only possible while the status is **Submitted**. Once a manager opens it, the expense is locked for withdrawal.

**Can I see who approved or rejected my expense?**
Yes. Open the expense detail and scroll to the status timeline — it shows every status change, who made it, and when.

**Can a manager approve their own expense?**
No. Managers can submit expenses but cannot approve, reject, or close their own submissions. The action buttons are hidden for their own expenses.

**What currencies are supported?**
USD, EUR, GBP, CAD, AUD, CHF, SEK, NOK, DKK, SGD, HKD, NZD, INR, MXN.

**Is there a draft auto-save?**
No — drafts are saved manually. Click **Save as Draft** in the form to preserve your progress. If you close the browser without saving, unsaved changes will be lost. You can reopen your saved draft at any time from your dashboard.