import { describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({ default: { getItem: async () => null, setItem: async () => {} } }));

import { askWindow, easterSunday, fromNager, southAfricaHolidays } from "./publicHolidays";

describe("easterSunday", () => {
  it("knows Easter", () => {
    expect(easterSunday(2026)).toEqual({ month: 4, day: 5 });
    expect(easterSunday(2027)).toEqual({ month: 3, day: 28 });
    expect(easterSunday(2025)).toEqual({ month: 4, day: 20 });
  });
});

describe("southAfricaHolidays", () => {
  it("has December's days, Old Year's Day not official", () => {
    const dec = southAfricaHolidays(2026).filter((h) => h.day.startsWith("2026-12"));
    expect(dec.map((h) => h.day)).toEqual(["2026-12-16", "2026-12-25", "2026-12-26", "2026-12-31"]);
    expect(dec.find((h) => h.day === "2026-12-31")?.official).toBe(false);
  });

  it("has Good Friday and Family Day", () => {
    const days = southAfricaHolidays(2026).map((h) => h.day);
    expect(days).toContain("2026-04-03");
    expect(days).toContain("2026-04-06");
  });

  it("moves a Sunday holiday to the Monday", () => {
    // 2026: Freedom Day 27 Apr is a Monday; Women's Day 9 Aug is a Sunday.
    const h = southAfricaHolidays(2026);
    expect(h.find((x) => x.day === "2026-08-10")?.name).toBe("National Women's Day (Monday off)");
    expect(h.find((x) => x.day === "2026-08-09")).toBeTruthy();
  });

  it("doesn't add a day when the Monday is already a holiday", () => {
    // 2022: Christmas on a Sunday, Day of Goodwill on the Monday.
    const dec = southAfricaHolidays(2022).filter((h) => h.day.startsWith("2022-12"));
    expect(dec.map((h) => h.day)).toEqual(["2022-12-16", "2022-12-25", "2022-12-26", "2022-12-31"]);
  });
});

describe("fromNager", () => {
  it("keeps whole-country holidays only", () => {
    expect(
      fromNager([
        { date: "2026-12-25", name: "Christmas Day", global: true },
        { date: "2026-03-17", name: "Saint Patrick's Day", global: false },
      ])
    ).toEqual([{ day: "2026-12-25", name: "Christmas Day", official: true }]);
  });
});

describe("askWindow", () => {
  it("is this month early on, then next month too", () => {
    expect(askWindow("2026-11-05")).toEqual({ from: "2026-11-05", until: "2026-11-30" });
    expect(askWindow("2026-11-25")).toEqual({ from: "2026-11-25", until: "2026-12-31" });
    expect(askWindow("2026-12-20")).toEqual({ from: "2026-12-20", until: "2027-01-31" });
  });
});
