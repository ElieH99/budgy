import { type Page, expect } from "@playwright/test";

/**
 * E2E test helpers — shared setup and utilities.
 *
 * Uses seeded test accounts from CLAUDE.md Section 7.
 */

export const TEST_ACCOUNTS = {
  employee: {
    email: "miles@employee.dev",
    password: "MilesEmployee@2026!",
    firstName: "Miles",
    lastName: "Morales",
    role: "employee",
  },
  manager: {
    email: "jack@manager.dev",
    password: "JackManager@2026!",
    firstName: "Jack",
    lastName: "Black",
    role: "manager",
  },
} as const;

/**
 * Log in as a test user. Navigates to /login, fills credentials, and waits
 * for redirect to the appropriate dashboard.
 */
export async function loginAs(page: Page, role: "employee" | "manager") {
  const account = TEST_ACCOUNTS[role];

  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  await page.fill('input#email', account.email);
  await page.fill('input#password', account.password);
  await page.click('button[type="submit"]');

  // Wait for dashboard to load (header with user name appears)
  await page.waitForSelector(`text=${account.firstName}`, { timeout: 15000 });
}

/**
 * Create a draft expense via the UI. Returns the unique title for later lookup.
 */
export async function createDraftExpense(
  page: Page,
  overrides?: {
    title?: string;
    description?: string;
    amount?: string;
    category?: string;
  }
) {
  const uniqueTitle = overrides?.title ?? `Test Expense ${Date.now()}`;

  // Click "New Ticket" button
  await page.click('button:has-text("New Ticket")');

  // Wait for modal
  await page.waitForSelector('[role="dialog"]');

  // Fill form fields
  await page.fill('input#title', uniqueTitle);
  await page.fill('#description', overrides?.description ?? "E2E test expense description for automated testing");

  // Select category
  if (overrides?.category) {
    await page.click('button:has-text("Select category")');
    await page.click(`[role="option"]:has-text("${overrides.category}")`);
  } else {
    await page.click('button:has-text("Select category")');
    await page.click('[role="option"]:first-child');
  }

  // Fill amount
  await page.fill('input#amount', overrides?.amount ?? "99.99");

  // Click "Save as Draft"
  await page.click('button:has-text("Save as Draft")');

  // Wait for modal to close
  await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 10000 });

  return uniqueTitle;
}

/**
 * Upload a test receipt image. Creates a small valid JPEG in memory.
 */
export async function uploadTestReceipt(page: Page) {
  // Create a small valid PNG image using a data URL converted to buffer
  const buffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );

  // Find the file input and set the file
  const fileInput = page.locator('input[type="file"][accept*="image"]').first();
  await fileInput.setInputFiles({
    name: "test-receipt.png",
    mimeType: "image/png",
    buffer,
  });

  // Wait for upload to complete
  await page.waitForSelector('text=Receipt uploaded', { timeout: 15000 });
}

/**
 * Create and submit an expense (saves draft with receipt, then submits).
 * Returns the unique title.
 */
export async function submitExpense(
  page: Page,
  overrides?: {
    title?: string;
    description?: string;
    amount?: string;
  }
) {
  const uniqueTitle = overrides?.title ?? `Test Expense ${Date.now()}`;

  // Click "New Ticket" button
  await page.click('button:has-text("New Ticket")');
  await page.waitForSelector('[role="dialog"]');

  // Fill form
  await page.fill('input#title', uniqueTitle);
  await page.fill('#description', overrides?.description ?? "E2E test expense for automated testing workflow");

  // Select category
  await page.click('button:has-text("Select category")');
  await page.click('[role="option"]:first-child');

  // Fill amount
  await page.fill('input#amount', overrides?.amount ?? "99.99");

  // Upload receipt
  await uploadTestReceipt(page);

  // Click "Submit for Approval"
  await page.click('button:has-text("Submit for Approval")');

  // Wait for modal to close
  await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 15000 });

  return uniqueTitle;
}

/**
 * Sign out from the current session.
 */
export async function signOut(page: Page) {
  await page.click('button:has-text("Sign out")');
  await page.waitForURL("**/login", { timeout: 10000 });
}

/**
 * Generate a unique title for test data isolation.
 */
export function uniqueTitle(prefix = "E2E") {
  return `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
