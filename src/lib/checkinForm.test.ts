import { describe, expect, it } from "vitest";
import {
  EMPTY_CHECKIN_FORM,
  formFromCheckin,
  parseAmount,
  parseTime,
  unansweredSections,
  validateCheckinForm,
  type CheckinForm,
} from "@/lib/checkinForm";
import type { Checkin } from "@/types/database";

describe("parseAmount", () => {
  it("reads a comma as a decimal mark, as South African keyboards type it", () => {
    expect(parseAmount("1,5")).toBe(1.5);
    expect(parseAmount("1.5")).toBe(1.5);
    expect(parseAmount(" 3 ")).toBe(3);
  });

  it("treats blank as 0 and rejects anything that isn't a number", () => {
    expect(parseAmount("")).toBe(0);
    expect(parseAmount("two")).toBeNull();
    expect(parseAmount("1.5.2")).toBeNull();
    expect(parseAmount("-1")).toBeNull();
  });
});

describe("parseTime", () => {
  it("accepts the ways people write a 24-hour time", () => {
    expect(parseTime("22:30")).toBe("22:30");
    expect(parseTime("22.30")).toBe("22:30");
    expect(parseTime("22h30")).toBe("22:30");
    expect(parseTime("2230")).toBe("22:30");
    expect(parseTime("930")).toBe("09:30");
    expect(parseTime("6:05")).toBe("06:05");
    expect(parseTime("22")).toBe("22:00");
  });

  it("returns blank for blank and null for something that isn't a time", () => {
    expect(parseTime("  ")).toBe("");
    expect(parseTime("25:00")).toBeNull();
    expect(parseTime("10:75")).toBeNull();
    expect(parseTime("10pm")).toBeNull();
  });
});

const savedCheckin: Checkin = {
  id: "c1",
  client_id: "client",
  checkin_date: "2026-10-08",
  alcohol_units: 2,
  sleep_bed_time: "22:30:00",
  sleep_asleep_time: "23:00:00",
  sleep_wake_time: null,
  sleep_quality: 4,
  water_litres: 1.5,
  electrolytes: true,
  meals_total: 3,
  high_gi_count: 1,
  high_gi_timing: ["before_bed"],
  screen_time_before_bed_minutes: 0,
  read_non_backlit_device: false,
  breathing_or_stretching_done: true,
  distress_flag: false,
  wound_down: true,
  distress_notes: null,
  created_at: "2026-10-08T05:00:00Z",
};

describe("formFromCheckin", () => {
  it("fills the form back in so a saved check-in can be changed", () => {
    const form = formFromCheckin(savedCheckin);
    expect(form.bedTime).toBe("22:30");
    expect(form.wakeTime).toBe("");
    expect(form.waterLitres).toBe("1.5");
    expect(form.woundDown).toBe(true);
  });

  it("round-trips through validation to the same saved values", () => {
    const result = validateCheckinForm(formFromCheckin(savedCheckin));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.values).toEqual({
      alcohol_units: 2,
      sleep_bed_time: "22:30",
      sleep_wake_time: null,
      sleep_quality: 4,
      water_litres: 1.5,
      meals_total: 3,
      high_gi_count: 1,
      wound_down: true,
      distress_flag: false,
      distress_notes: null,
    });
  });
});

describe("validateCheckinForm", () => {
  const form = (changes: Partial<CheckinForm>): CheckinForm => ({ ...EMPTY_CHECKIN_FORM, ...changes });

  it("saves water typed with a comma instead of silently saving 0", () => {
    const result = validateCheckinForm(form({ waterLitres: "2,5" }));
    expect(result.ok && result.values.water_litres).toBe(2.5);
  });

  it("explains a bad time instead of failing on the database", () => {
    const result = validateCheckinForm(form({ bedTime: "10pm" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.title).toBe("Check Bed time");
  });

  it("catches typos that are too big to be real", () => {
    expect(validateCheckinForm(form({ waterLitres: "25" })).ok).toBe(false);
    expect(validateCheckinForm(form({ mealsTotal: "2.5" })).ok).toBe(false);
  });

  it("asks for a note when distress is flagged", () => {
    const result = validateCheckinForm(form({ distressFlag: true, distressNotes: " " }));
    expect(result.ok).toBe(false);
  });

  it("only saves the questions the trimmed check-in still asks", () => {
    const result = validateCheckinForm(form({ woundDown: false }));
    expect(result.ok && Object.keys(result.values).sort()).toEqual([
      "alcohol_units",
      "distress_flag",
      "distress_notes",
      "high_gi_count",
      "meals_total",
      "sleep_bed_time",
      "sleep_quality",
      "sleep_wake_time",
      "water_litres",
      "wound_down",
    ]);
    expect(result.ok && result.values.wound_down).toBe(false);
  });

  it("flags more high-GI meals than meals", () => {
    expect(validateCheckinForm(form({ mealsTotal: "2", highGiCount: "3" })).ok).toBe(false);
  });
});

describe("unansweredSections", () => {
  it("lists what is still blank", () => {
    expect(unansweredSections(EMPTY_CHECKIN_FORM)).toEqual(["sleep times", "sleep quality", "water", "meals", "wind-down"]);
    expect(unansweredSections(formFromCheckin(savedCheckin))).toEqual(["sleep times"]);
  });
});
