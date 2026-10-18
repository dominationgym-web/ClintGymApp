import { describe, expect, it } from "vitest";
import { habitEndDate, habitLengthLabel, habitStartChoices } from "@/lib/habitDates";

describe("habit dates", () => {
  it("offers today and next Monday", () => {
    // 2026-10-18 is a Sunday.
    expect(habitStartChoices("2026-10-18").map((c) => c.date)).toEqual(["2026-10-18", "2026-10-19"]);
    // From a Monday, next Monday is a week on.
    expect(habitStartChoices("2026-10-19")[1].date).toBe("2026-10-26");
  });

  it("ends the day before the same weekday N weeks on", () => {
    expect(habitEndDate("2026-10-19", 2)).toBe("2026-11-01");
    expect(habitEndDate("2026-10-19", null)).toBeNull();
    expect(habitLengthLabel(null)).toBe("No end");
    expect(habitLengthLabel(4)).toBe("4 weeks");
  });
});
