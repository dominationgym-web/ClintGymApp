import { describe, expect, it } from "vitest";
import { nextSwapDate, swapBlocked, swapDayName, swapLabels } from "./workoutSwaps";

const training = (id: string) => id !== "mobility";

describe("nextSwapDate", () => {
  it("picks the next training workout after today", () => {
    const rows = [
      { workout_date: "2026-10-28", program_id: "legs" },
      { workout_date: "2026-10-30", program_id: "upper" },
      { workout_date: "2026-10-29", program_id: "mobility" },
      { workout_date: "2026-10-31", program_id: "full" },
    ];
    expect(nextSwapDate("2026-10-28", rows, training)).toBe("2026-10-30");
  });
  it("only looks 7 days ahead", () => {
    expect(nextSwapDate("2026-10-28", [{ workout_date: "2026-11-05", program_id: "upper" }], training)).toBeNull();
    expect(nextSwapDate("2026-10-28", [{ workout_date: "2026-11-04", program_id: "upper" }], training)).toBe("2026-11-04");
  });
});

describe("swapDayName", () => {
  it("says tomorrow's for the next day, else the weekday", () => {
    expect(swapDayName("2026-10-28", "2026-10-29")).toBe("tomorrow's");
    expect(swapDayName("2026-10-28", "2026-10-30")).toBe("Friday's");
  });
});

describe("swapBlocked", () => {
  const swap = { swapped_on: "2026-10-27", later_date: "2026-10-28", undone_at: null };
  it("allows a swap on a fresh day", () => {
    expect(swapBlocked("2026-10-28", [], false)).toBeNull();
  });
  it("stops a workout swapped onto today moving again", () => {
    expect(swapBlocked("2026-10-28", [swap], false)).toBe("swappedIn");
  });
  it("stops a second swap the same day, and after training started", () => {
    expect(swapBlocked("2026-10-27", [swap], false)).toBe("swapped");
    expect(swapBlocked("2026-10-29", [], true)).toBe("started");
  });
  it("ignores undone swaps", () => {
    expect(swapBlocked("2026-10-28", [{ ...swap, undone_at: "2026-10-27T08:00:00Z" }], false)).toBeNull();
  });
});

describe("swapLabels", () => {
  it("labels both days", () => {
    expect(swapLabels([{ swapped_on: "2026-10-28", later_date: "2026-10-29", undone_at: null }])).toEqual({
      "2026-10-28": "🔄 Swapped with Thursday",
      "2026-10-29": "🔄 Swapped with Wednesday",
    });
  });
});
