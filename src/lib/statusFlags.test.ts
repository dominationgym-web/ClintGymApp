import { describe, expect, it } from "vitest";
import { answeredStatusToday } from "@/lib/statusFlags";

describe("answeredStatusToday", () => {
  const now = new Date(2026, 9, 14, 7, 30);

  it("asks when nothing has been answered", () => {
    expect(answeredStatusToday(null, null, now)).toBe(false);
  });

  it("skips when this phone answered today", () => {
    expect(answeredStatusToday(null, "2026-10-14", now)).toBe(true);
  });

  it("asks again when the phone's answer was yesterday", () => {
    expect(answeredStatusToday(null, "2026-10-13", now)).toBe(false);
  });

  it("skips when the flag changed earlier today", () => {
    expect(answeredStatusToday(new Date(2026, 9, 14, 0, 5).toISOString(), null, now)).toBe(true);
  });

  it("asks when the flag last changed yesterday", () => {
    expect(answeredStatusToday(new Date(2026, 9, 13, 23, 55).toISOString(), null, now)).toBe(false);
  });
});
