import { describe, it, expect } from "vitest";
import {
  EXPENSE_STATUSES,
  REJECTION_REASONS,
  CLOSE_REASONS,
  MAX_RECEIPT_SIZE_BYTES,
  ACCEPTED_RECEIPT_TYPES,
  CURRENCIES,
} from "@/lib/constants";

describe("EXPENSE_STATUSES", () => {
  it("has exactly 7 values", () => {
    expect(EXPENSE_STATUSES).toHaveLength(7);
  });

  it("all values are unique strings", () => {
    const unique = new Set(EXPENSE_STATUSES);
    expect(unique.size).toBe(EXPENSE_STATUSES.length);
    for (const status of EXPENSE_STATUSES) {
      expect(typeof status).toBe("string");
      expect(status.length).toBeGreaterThan(0);
    }
  });

  it("contains expected statuses", () => {
    expect(EXPENSE_STATUSES).toContain("Draft");
    expect(EXPENSE_STATUSES).toContain("Submitted");
    expect(EXPENSE_STATUSES).toContain("UnderReview");
    expect(EXPENSE_STATUSES).toContain("Approved");
    expect(EXPENSE_STATUSES).toContain("Rejected");
    expect(EXPENSE_STATUSES).toContain("Closed");
    expect(EXPENSE_STATUSES).toContain("Withdrawn");
  });
});

describe("REJECTION_REASONS", () => {
  it("has exactly 5 values", () => {
    expect(REJECTION_REASONS).toHaveLength(5);
  });

  it("all values are unique, non-empty strings", () => {
    const unique = new Set(REJECTION_REASONS);
    expect(unique.size).toBe(REJECTION_REASONS.length);
    for (const reason of REJECTION_REASONS) {
      expect(typeof reason).toBe("string");
      expect(reason.length).toBeGreaterThan(0);
    }
  });
});

describe("CLOSE_REASONS", () => {
  it("has exactly 5 values", () => {
    expect(CLOSE_REASONS).toHaveLength(5);
  });

  it("all values are unique, non-empty strings", () => {
    const unique = new Set(CLOSE_REASONS);
    expect(unique.size).toBe(CLOSE_REASONS.length);
    for (const reason of CLOSE_REASONS) {
      expect(typeof reason).toBe("string");
      expect(reason.length).toBeGreaterThan(0);
    }
  });
});

describe("MAX_RECEIPT_SIZE_BYTES", () => {
  it("equals 5,242,880 (5 MB exactly)", () => {
    expect(MAX_RECEIPT_SIZE_BYTES).toBe(5_242_880);
  });
});

describe("ACCEPTED_RECEIPT_TYPES", () => {
  it("contains exactly image/jpeg, image/png, image/webp", () => {
    expect([...ACCEPTED_RECEIPT_TYPES]).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
  });
});

describe("CURRENCIES", () => {
  it("has at least 14 entries", () => {
    expect(CURRENCIES.length).toBeGreaterThanOrEqual(14);
  });

  it("each entry has code and label properties", () => {
    for (const currency of CURRENCIES) {
      expect(currency).toHaveProperty("code");
      expect(currency).toHaveProperty("label");
      expect(typeof currency.code).toBe("string");
      expect(typeof currency.label).toBe("string");
    }
  });

  it("all codes are uppercase", () => {
    for (const currency of CURRENCIES) {
      expect(currency.code).toBe(currency.code.toUpperCase());
    }
  });

  it("all codes are unique", () => {
    const codes = CURRENCIES.map((c) => c.code);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });
});
