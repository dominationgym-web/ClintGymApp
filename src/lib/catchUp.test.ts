import { describe, expect, it } from "vitest";
import { catchUpDate, isWeekend, orderByRestedMuscles } from "@/lib/catchUp";

const SAT = "2026-10-17";
const SUN = "2026-10-18";
const WED = "2026-10-14";
const THU = "2026-10-15";
const missed = [{ workout_date: WED }, { workout_date: THU }];

describe("isWeekend", () => {
  it("is true on Saturday and Sunday only", () => {
    expect(isWeekend(SAT)).toBe(true);
    expect(isWeekend(SUN)).toBe(true);
    expect(isWeekend(WED)).toBe(false);
  });
});

describe("catchUpDate", () => {
  it("opens on the first missed workout at the weekend", () => {
    expect(catchUpDate(SAT, missed, null, null)).toBe(WED);
  });

  it("never catches up on a weekday", () => {
    expect(catchUpDate(THU, [{ workout_date: WED }], null, null)).toBeNull();
  });

  it("follows the client's pick", () => {
    expect(catchUpDate(SUN, missed, null, THU)).toBe(THU);
    expect(catchUpDate(SUN, missed, null, "today")).toBeNull();
    // A pick that's no longer missed falls back to the first one.
    expect(catchUpDate(SUN, missed, null, "2026-10-13")).toBe(WED);
  });

  it("stays on what today's recorded workout made up", () => {
    expect(catchUpDate(SAT, [{ workout_date: THU }], { makeup_for: WED }, null)).toBe(WED);
    expect(catchUpDate(SAT, missed, { makeup_for: null }, null)).toBeNull();
  });

  it("shows today's own workout when nothing was missed", () => {
    expect(catchUpDate(SAT, [], null, null)).toBeNull();
  });
});

describe("orderByRestedMuscles", () => {
  const MON = "2026-10-12";
  it("puts the workout that rests yesterday's body parts first", () => {
    const parts = { [MON]: ["Legs", "Hamstrings"], [THU]: ["Chest", "Back"] };
    expect(orderByRestedMuscles([{ workout_date: MON }, { workout_date: THU }], parts, ["Legs", "Hamstrings"]).map((m) => m.workout_date)).toEqual([THU, MON]);
  });

  it("keeps the earliest first when nothing was trained yesterday", () => {
    expect(orderByRestedMuscles([{ workout_date: THU }, { workout_date: MON }], {}, []).map((m) => m.workout_date)).toEqual([MON, THU]);
  });
});
