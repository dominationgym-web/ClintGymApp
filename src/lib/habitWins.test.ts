import { describe, expect, it } from "vitest";
import { habitsLine, isPersonalMessage, winsShownFrom, winWeekLabel } from "./habitWins";

describe("habit wins", () => {
  it("shows wins from the Monday of last week", () => {
    expect(winsShownFrom("2026-10-12")).toBe("2026-10-05"); // a Monday
    expect(winsShownFrom("2026-10-18")).toBe("2026-10-05"); // a Sunday
  });
  it("labels this week and last week", () => {
    expect(winWeekLabel("2026-10-12", "2026-10-14")).toBe("This week");
    expect(winWeekLabel("2026-10-05", "2026-10-14")).toBe("Last week");
  });
  it("lists each habit with its days", () => {
    expect(habitsLine([{ habit_id: "a", name: "Water", days: 6 }, { habit_id: "b", name: "Steps", days: 5 }])).toBe("Water 6/7 · Steps 5/7");
  });
  it("needs the trainer's own words", () => {
    expect(isPersonalMessage("  ")).toBe(false);
    expect(isPersonalMessage("Proud of you Sam!")).toBe(true);
  });
});
