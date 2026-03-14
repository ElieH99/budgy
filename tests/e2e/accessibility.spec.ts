import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { loginAs } from "./setup";

test.describe("Accessibility Spot-Checks", () => {
  test("login page — no critical violations", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page }).analyze();
    const critical = results.violations.filter((v) => v.impact === "critical");
    expect(critical).toHaveLength(0);
  });

  test("employee dashboard — no critical violations", async ({ page }) => {
    await loginAs(page, "employee");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page }).analyze();
    const critical = results.violations.filter((v) => v.impact === "critical");
    expect(critical).toHaveLength(0);
  });

  test("new ticket modal — no critical violations", async ({ page }) => {
    await loginAs(page, "employee");
    await page.click('button:has-text("New Ticket")');
    await page.waitForSelector('[role="dialog"]');

    const results = await new AxeBuilder({ page }).analyze();
    const critical = results.violations.filter((v) => v.impact === "critical");
    expect(critical).toHaveLength(0);
  });

  test("manager dashboard — no critical violations", async ({ page }) => {
    await loginAs(page, "manager");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page }).analyze();
    const critical = results.violations.filter((v) => v.impact === "critical");
    expect(critical).toHaveLength(0);
  });
});
