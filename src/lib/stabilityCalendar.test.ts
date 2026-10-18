import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { sameWeekdayUntil, stabilityCalendarMap, stabilityEndDate } from "@/lib/stabilityCalendar";

const knee = { id: "k", area: "knee" as const, level: "rehab" as const, ended_at: null };
const core = { id: "c", area: "core" as const, level: "beginner" as const, ended_at: null };

describe("stabilityCalendarMap", () => {
  it("marks planned days, and logged days as done", () => {
    const map = stabilityCalendarMap(
      [knee, core],
      [
        { stability_program_id: "k", day: "2026-10-20" },
        { stability_program_id: "c", day: "2026-10-20" },
        { stability_program_id: "k", day: "2026-10-22" },
      ],
      [
        { stability_program_id: "k", log_date: "2026-10-20" },
        { stability_program_id: "k", log_date: "2026-10-20" },
        { stability_program_id: "c", log_date: "2026-10-21" },
      ],
    );
    expect(map["2026-10-20"]).toEqual([
      { programId: "k", label: "Knee", done: true },
      { programId: "c", label: "Core", done: false },
    ]);
    expect(map["2026-10-21"]).toEqual([{ programId: "c", label: "Core", done: true }]);
    expect(map["2026-10-22"]).toEqual([{ programId: "k", label: "Knee", done: false }]);
  });

  it("drops days planned after a program was stopped, and unknown programs", () => {
    const stopped = { ...knee, ended_at: "2026-10-21T08:00:00Z" };
    const map = stabilityCalendarMap(
      [stopped],
      [
        { stability_program_id: "k", day: "2026-10-21" },
        { stability_program_id: "k", day: "2026-10-28" },
        { stability_program_id: "gone", day: "2026-10-21" },
      ],
      [],
    );
    expect(Object.keys(map)).toEqual(["2026-10-21"]);
  });
});

describe("weekly days", () => {
  it("ends a program on its last day", () => {
    // Rehab is 8 weeks.
    expect(stabilityEndDate({ area: "knee", level: "rehab", started_on: "2026-10-19" })).toBe("2026-12-13");
  });

  it("repeats the weekday up to the end date", () => {
    expect(sameWeekdayUntil("2026-10-20", "2026-11-10")).toEqual(["2026-10-20", "2026-10-27", "2026-11-03", "2026-11-10"]);
    expect(sameWeekdayUntil("2026-10-20", "2026-10-19")).toEqual([]);
  });
});
