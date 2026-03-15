// ── Expense Statuses ────────────────────────────────────────────────────────

export const EXPENSE_STATUSES = [
  "Draft",
  "Submitted",
  "UnderReview",
  "Approved",
  "Rejected",
  "Closed",
  "Withdrawn",
] as const;

export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

/** Statuses from which no further transitions are possible */
export const TERMINAL_STATUSES: readonly ExpenseStatus[] = [
  "Approved",
  "Closed",
  "Withdrawn",
] as const;

// ── Rejection Reasons (dropdown options) ────────────────────────────────────

export const REJECTION_REASONS = [
  "Missing receipt",
  "Incorrect amount",
  "Out of policy",
  "Duplicate",
  "Other",
] as const;

export type RejectionReason = (typeof REJECTION_REASONS)[number];

// ── Close Reasons (dropdown options) ────────────────────────────────────────

export const CLOSE_REASONS = [
  "Duplicate submission",
  "Fraudulent receipt",
  "Permanently out of policy",
  "Employee no longer with company",
  "Other",
] as const;

export type CloseReason = (typeof CLOSE_REASONS)[number];

// ── Receipt File Constraints ────────────────────────────────────────────────

export const ACCEPTED_RECEIPT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_RECEIPT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// ── Currencies (ISO 4217) ───────────────────────────────────────────────────

export const CURRENCIES = [
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "CHF", label: "CHF — Swiss Franc" },
  { code: "SEK", label: "SEK — Swedish Krona" },
  { code: "NOK", label: "NOK — Norwegian Krone" },
  { code: "DKK", label: "DKK — Danish Krone" },
  { code: "SGD", label: "SGD — Singapore Dollar" },
  { code: "HKD", label: "HKD — Hong Kong Dollar" },
  { code: "NZD", label: "NZD — New Zealand Dollar" },
  { code: "INR", label: "INR — Indian Rupee" },
  { code: "MXN", label: "MXN — Mexican Peso" },
] as const;

export const CURRENCY_CODES = [
  "USD", "EUR", "GBP", "CAD", "AUD", "CHF", "SEK",
  "NOK", "DKK", "SGD", "HKD", "NZD", "INR", "MXN",
] as const;

// ── Idle Timeout ────────────────────────────────────────────────────────────

/** 15 minutes of inactivity before automatic sign-out */
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

// ── Status Display Labels ───────────────────────────────────────────────────

export const STATUS_DISPLAY_LABELS: Record<ExpenseStatus, string> = {
  Draft: "Draft",
  Submitted: "Submitted",
  UnderReview: "Under Review",
  Approved: "Approved",
  Rejected: "Rejected",
  Closed: "Closed",
  Withdrawn: "Withdrawn",
};
