import { describe, expect, it } from "vitest";
import { DAILY_QUOTES, quoteForDate } from "@/lib/dailyQuotes";

describe("DAILY_QUOTES", () => {
  it("has exactly 365 entries", () => {
    expect(DAILY_QUOTES).toHaveLength(365);
  });

  it("has no duplicates", () => {
    expect(new Set(DAILY_QUOTES).size).toBe(DAILY_QUOTES.length);
  });

  it("has only non-empty quotes under 140 characters", () => {
    for (const quote of DAILY_QUOTES) {
      expect(quote.trim().length).toBeGreaterThan(0);
      expect(quote.length).toBeLessThan(140);
    }
  });
});

describe("quoteForDate", () => {
  it("gives the first quote on 1 January", () => {
    expect(quoteForDate(new Date(2026, 0, 1, 15, 30))).toBe(DAILY_QUOTES[0]);
  });

  it("gives the last quote on 31 December 2026", () => {
    expect(quoteForDate(new Date(2026, 11, 31, 23, 59))).toBe(DAILY_QUOTES[364]);
  });

  it("wraps day 366 of a leap year (31 December 2028) to the first quote", () => {
    expect(quoteForDate(new Date(2028, 11, 31, 8, 0))).toBe(DAILY_QUOTES[0]);
  });
});
