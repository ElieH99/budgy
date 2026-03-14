import { describe, it, expect } from "vitest";
import { hasPermission, getPermissions } from "@/lib/permissions";
import type { Permission } from "@/lib/permissions";

// ── Employee Permissions ───────────────────────────────────────────────────

describe("Employee permissions", () => {
  it("has expense:submit", () => {
    expect(hasPermission("employee", "expense:submit")).toBe(true);
  });

  it("has expense:view_own", () => {
    expect(hasPermission("employee", "expense:view_own")).toBe(true);
  });

  it("has expense:withdraw_own", () => {
    expect(hasPermission("employee", "expense:withdraw_own")).toBe(true);
  });

  it("has expense:resubmit_rejected", () => {
    expect(hasPermission("employee", "expense:resubmit_rejected")).toBe(true);
  });

  it("does NOT have expense:approve", () => {
    expect(hasPermission("employee", "expense:approve")).toBe(false);
  });

  it("does NOT have expense:reject", () => {
    expect(hasPermission("employee", "expense:reject")).toBe(false);
  });

  it("does NOT have expense:close", () => {
    expect(hasPermission("employee", "expense:close")).toBe(false);
  });

  it("does NOT have expense:view_all", () => {
    expect(hasPermission("employee", "expense:view_all")).toBe(false);
  });
});

// ── Manager Permissions ────────────────────────────────────────────────────

describe("Manager permissions", () => {
  it("has expense:approve", () => {
    expect(hasPermission("manager", "expense:approve")).toBe(true);
  });

  it("has expense:reject", () => {
    expect(hasPermission("manager", "expense:reject")).toBe(true);
  });

  it("has expense:close", () => {
    expect(hasPermission("manager", "expense:close")).toBe(true);
  });

  it("has expense:view_all", () => {
    expect(hasPermission("manager", "expense:view_all")).toBe(true);
  });

  it("has expense:submit (managers can submit own expenses)", () => {
    expect(hasPermission("manager", "expense:submit")).toBe(true);
  });

  it("has expense:view_own", () => {
    expect(hasPermission("manager", "expense:view_own")).toBe(true);
  });

  it("has expense:withdraw_own", () => {
    expect(hasPermission("manager", "expense:withdraw_own")).toBe(true);
  });

  it("has expense:edit_draft", () => {
    expect(hasPermission("manager", "expense:edit_draft")).toBe(true);
  });

  it("has expense:resubmit_rejected", () => {
    expect(hasPermission("manager", "expense:resubmit_rejected")).toBe(true);
  });
});

// ── getPermissions ─────────────────────────────────────────────────────────

describe("getPermissions", () => {
  it("returns all employee permissions", () => {
    const perms = getPermissions("employee");
    expect(perms).toContain("expense:submit");
    expect(perms).toContain("expense:view_own");
    expect(perms).toContain("expense:withdraw_own");
    expect(perms).toContain("expense:edit_draft");
    expect(perms).toContain("expense:resubmit_rejected");
    expect(perms).toHaveLength(5);
  });

  it("returns all manager permissions", () => {
    const perms = getPermissions("manager");
    expect(perms).toContain("expense:approve");
    expect(perms).toContain("expense:reject");
    expect(perms).toContain("expense:close");
    expect(perms).toContain("expense:view_all");
    expect(perms).toHaveLength(9);
  });

  it("returns a copy (not a reference)", () => {
    const perms1 = getPermissions("employee");
    const perms2 = getPermissions("employee");
    expect(perms1).toEqual(perms2);
    expect(perms1).not.toBe(perms2);
  });
});
