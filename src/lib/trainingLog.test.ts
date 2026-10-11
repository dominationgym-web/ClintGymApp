import { describe, expect, it } from "vitest";
import { dayLabel, groupTrainingLog, trainingLogStart } from "@/lib/trainingLog";
import type { WorkoutLog } from "@/types/database";

function log(date: string, name: string, set: number, created: string): WorkoutLog {
  return {
    id: `${date}-${name}-${set}`,
    client_id: "c",
    exercise_id: null,
    exercise_name: name,
    log_date: date,
    set_number: set,
    weight_kg: 20,
    reps: 10,
    effort: "comfortable",
    created_at: created,
  };
}

describe("training log by day", () => {
  it("labels days like Mon 12 Oct", () => {
    expect(dayLabel("2026-10-12")).toBe("Mon 12 Oct");
    expect(dayLabel("2026-10-13")).toBe("Tue 13 Oct");
  });

  it("starts two weeks back, today included", () => {
    expect(trainingLogStart("2026-10-14")).toBe("2026-10-01");
    expect(trainingLogStart("2026-03-02")).toBe("2026-02-17");
  });

  it("shows 14 days newest first, with empty days kept", () => {
    const days = groupTrainingLog([log("2026-10-12", "Squat", 1, "2026-10-12T08:00:00Z")], "2026-10-14");
    expect(days).toHaveLength(14);
    expect(days[0].date).toBe("2026-10-14");
    expect(days[13].date).toBe("2026-10-01");
    expect(days[0].setCount).toBe(0);
    expect(days[2].label).toBe("Mon 12 Oct");
    expect(days[2].setCount).toBe(1);
  });

  it("groups sets by exercise in the order they were done", () => {
    const days = groupTrainingLog(
      [
        log("2026-10-12", "Row", 1, "2026-10-12T08:10:00Z"),
        log("2026-10-12", "Squat", 2, "2026-10-12T08:05:00Z"),
        log("2026-10-12", "Squat", 1, "2026-10-12T08:00:00Z"),
        log("2026-09-01", "Old", 1, "2026-09-01T08:00:00Z"),
      ],
      "2026-10-12",
    );
    expect(days[0].exercises.map((e) => e.name)).toEqual(["Squat", "Row"]);
    expect(days[0].exercises[0].sets.map((s) => s.set_number)).toEqual([1, 2]);
    expect(days.some((d) => d.exercises.some((e) => e.name === "Old"))).toBe(false);
  });
});
