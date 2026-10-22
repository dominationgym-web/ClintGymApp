import { describe, expect, it } from "vitest";
import { cardioKey, withoutSkippedCardio } from "@/lib/cardioSkips";
import type { ProgramExercise } from "@/types/database";

const row = (id: string, name: string, kind: "exercise" | "cardio" = "cardio"): ProgramExercise => ({
  id,
  program_id: "p",
  day_number: 1,
  week_number: 1,
  sort_order: 0,
  exercise_id: null,
  exercise_name: name,
  sets: 1,
  reps: kind === "cardio" ? "20 min" : "10",
  rest_seconds: 0,
  kind,
});

describe("cardio taken off a workout", () => {
  const day = [row("a", "Squat", "exercise"), row("b", "Assault bike"), row("extra-cardio-0-day-1", "Treadmill")];

  it("names program cardio by its row and the client's own cardio by what it is", () => {
    expect(cardioKey(day[1])).toBe("row:b");
    expect(cardioKey(day[2])).toBe("extra:Treadmill|20 min");
  });

  it("takes a block off just that day", () => {
    const skips = [{ workout_date: "2026-10-22", cardio_key: "extra:Treadmill|20 min" }];
    expect(withoutSkippedCardio(day, skips, "2026-10-22").map((r) => r.exercise_name)).toEqual(["Squat", "Assault bike"]);
    expect(withoutSkippedCardio(day, skips, "2026-10-29")).toHaveLength(3);
  });

  it("takes a block off every week, never an exercise", () => {
    const skips = [{ workout_date: null, cardio_key: "row:b" }, { workout_date: null, cardio_key: "row:a" }];
    expect(withoutSkippedCardio(day, skips, "2026-11-05").map((r) => r.exercise_name)).toEqual(["Squat", "Treadmill"]);
  });
});
