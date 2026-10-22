import { describe, expect, it } from "vitest";
import { workoutAddOns } from "@/lib/workoutAddOns";

const upper = { name: "Upper Body 1", trainer_id: null, abs_between_sets: true };
const legs = { name: "Legs 2", trainer_id: null, abs_between_sets: false };

describe("workoutAddOns", () => {
  it("lists abs and the client's cardio for the trainer's calendar", () => {
    const client = { abs_between_sets: true, abs_all: false, extra_cardio: [{ after: 2, name: "Assault bike", reps: "30 sec" }, { after: null, name: "Treadmill", reps: "10 min" }] };
    expect(workoutAddOns(upper, client)).toBe("💪 Abs between sets · 🔥 Assault bike · 30 sec after exercise 2 · 🔥 Treadmill · 10 min at the end");
  });

  it("shows nothing extra when there is none", () => {
    expect(workoutAddOns(legs, { abs_between_sets: true, abs_all: false, extra_cardio: [] })).toBe("");
    expect(workoutAddOns(upper, { abs_between_sets: false })).toBe("");
  });

  it("shows abs on every workout when the trainer turned them on for all", () => {
    expect(workoutAddOns(legs, { abs_all: true })).toBe("💪 Abs between sets");
  });
});
