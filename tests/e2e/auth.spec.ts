import { test, expect } from "@playwright/test";
import { loginAs, signOut, TEST_ACCOUNTS } from "./setup";

test.describe("Authentication", () => {
  test.describe("Login", () => {
    test("employee can log in with valid credentials → redirected to employee dashboard", async ({
      page,
    }) => {
      await loginAs(page, "employee");

      // Should be on the employee dashboard (root /)
      await expect(page).toHaveURL(/\/$/);
      await expect(page.locator("text=My Expenses")).toBeVisible();
    });

    test("manager can log in with valid credentials → redirected to manager dashboard", async ({
      page,
    }) => {
      await loginAs(page, "manager");

      // Should be on the manager dashboard
      await expect(page).toHaveURL(/\/manager/);
    });

    test("wrong password → shows error message, stays on login page", async ({
      page,
    }) => {
      await page.goto("/login");
      await page.fill("input#email", TEST_ACCOUNTS.employee.email);
      await page.fill("input#password", "WrongPassword123!");
      await page.click('button[type="submit"]');

      // Should show an error message
      await expect(
        page.locator("text=Invalid email or password")
      ).toBeVisible({ timeout: 10000 });

      // Should still be on login page
      await expect(page).toHaveURL(/\/login/);
    });

    test("unknown email → shows error message", async ({ page }) => {
      await page.goto("/login");
      await page.fill("input#email", "nonexistent@test.dev");
      await page.fill("input#password", "SomePassword123!");
      await page.click('button[type="submit"]');

      // Should show error
      await expect(
        page.locator("text=Invalid email or password")
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Route protection", () => {
    test("unauthenticated user visiting / → redirected to /login", async ({
      page,
    }) => {
      await page.goto("/");
      await page.waitForURL("**/login", { timeout: 15000 });
      await expect(page).toHaveURL(/\/login/);
    });

    test("unauthenticated user visiting /manager → redirected to /login", async ({
      page,
    }) => {
      await page.goto("/manager");
      await page.waitForURL("**/login", { timeout: 15000 });
      await expect(page).toHaveURL(/\/login/);
    });

    test("authenticated employee visiting /manager → redirected", async ({
      page,
    }) => {
      await loginAs(page, "employee");
      await page.goto("/manager");

      // Should be redirected away from /manager (to / or /login)
      await page.waitForTimeout(3000);
      const url = page.url();
      expect(url).not.toMatch(/\/manager$/);
    });
  });

  test.describe("Sign out", () => {
    test("user clicks sign out → redirected to login page", async ({
      page,
    }) => {
      await loginAs(page, "employee");
      await signOut(page);

      await expect(page).toHaveURL(/\/login/);

      // Attempting to go back to dashboard should redirect to login
      await page.goto("/");
      await page.waitForURL("**/login", { timeout: 15000 });
      await expect(page).toHaveURL(/\/login/);
    });
  });
});
