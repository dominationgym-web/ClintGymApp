import { describe, expect, it } from "vitest";
import { NO_END, swapActive, swapUntil, withTemporarySwaps } from "@/lib/programSwaps";
import type { ProgramExercise } from "@/types/database";

const row = (extra: Partial<ProgramExercise> = {}): ProgramExercise => ({
  id: "r1",
  program_id: "p1",
  day_number: 1,
  week_number: 1,
  sort_order: 0,
  exercise_id: "bench",
  exercise_name: "Bench press",
  sets: 3,
  reps: "8-12",
  rest_seconds: 120,
  kind: "exercise",
  ...extra,
});

describe("program swaps", () => {
  // 2026-10-21 is a Wednesday.
  it("works out the last day of a swap", () => {
    expect(swapUntil("week", "2026-10-21")).toBe("2026-10-25");
    expect(swapUntil("twoWeeks", "2026-10-21")).toBe("2026-11-03");
    expect(swapUntil("fourWeeks", "2026-10-21")).toBe("2026-11-17");
    expect(swapUntil("open", "2026-10-21")).toBe(NO_END);
  });

  it("puts the stand-in in up to its last day, then the original is back", () => {
    const swapped = row({ swap_exercise_id: "db", swap_exercise_name: "Dumbbell press", swap_until: "2026-10-25" });
    const [during] = withTemporarySwaps([swapped], "2026-10-25");
    expect(during.exercise_name).toBe("Dumbbell press");
    expect(during.exercise_id).toBe("db");
    expect(during.swapped_from).toEqual({ exercise_id: "bench", exercise_name: "Bench press" });
    const [after] = withTemporarySwaps([swapped], "2026-10-26");
    expect(after.exercise_name).toBe("Bench press");
    expect(after.swapped_from).toBeUndefined();
  });

  it("leaves rows without a swap alone", () => {
    const plain = row();
    expect(withTemporarySwaps([plain], "2026-10-21")[0]).toBe(plain);
    expect(swapActive(row({ swap_exercise_name: "Dumbbell press", swap_until: null }), "2026-10-21")).toBe(false);
  });
});
