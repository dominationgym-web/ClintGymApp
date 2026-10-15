import { describe, expect, it } from "vitest";
import {
  NIGHTLY_TIPS,
  SLEEP_GUIDELINES,
  currentNightTip,
  isWindDownTime,
  nightlyTipFor,
  upcomingSleepReminders,
} from "@/lib/sleep";

describe("sleep guidelines", () => {
  it("has points under every heading", () => {
    for (const group of SLEEP_GUIDELINES) expect(group.points.length).toBeGreaterThan(0);
  });
});

describe("nightlyTipFor", () => {
  it("gives a different tip on consecutive nights", () => {
    expect(nightlyTipFor(new Date(2026, 9, 9, 18))).not.toBe(nightlyTipFor(new Date(2026, 9, 10, 18)));
  });

  it("is the same all day long", () => {
    expect(nightlyTipFor(new Date(2026, 9, 9, 0, 1))).toBe(nightlyTipFor(new Date(2026, 9, 9, 23, 59)));
  });

  it("cycles through every tip", () => {
    const seen = new Set<string>();
    for (let d = 0; d < NIGHTLY_TIPS.length; d++) seen.add(nightlyTipFor(new Date(2026, 9, 1 + d)));
    expect(seen.size).toBe(NIGHTLY_TIPS.length);
  });

  it("works for dates before the reference date", () => {
    expect(NIGHTLY_TIPS).toContain(nightlyTipFor(new Date(2025, 5, 1)));
  });
});

describe("upcomingSleepReminders", () => {
  it("starts tonight at 6pm when it's still before 6pm", () => {
    const [first] = upcomingSleepReminders(new Date(2026, 9, 9, 9, 0), 3);
    expect(first.at).toEqual(new Date(2026, 9, 9, 18, 0));
    expect(first.id).toBe("sleep-reminder-2026-10-09");
  });

  it("starts tomorrow once 6pm has passed", () => {
    const [first] = upcomingSleepReminders(new Date(2026, 9, 9, 18, 30), 3);
    expect(first.at).toEqual(new Date(2026, 9, 10, 18, 0));
  });

  it("gives one reminder per night with that night's tip", () => {
    const reminders = upcomingSleepReminders(new Date(2026, 9, 9, 9, 0), 14);
    expect(reminders).toHaveLength(14);
    expect(reminders[13].at).toEqual(new Date(2026, 9, 22, 18, 0));
    for (const r of reminders) expect(r.tip).toBe(nightlyTipFor(r.at));
  });
});

describe("isWindDownTime and currentNightTip", () => {
  it("is wind-down time from 6pm to 4am", () => {
    expect(isWindDownTime(new Date(2026, 9, 9, 17, 59))).toBe(false);
    expect(isWindDownTime(new Date(2026, 9, 9, 18, 0))).toBe(true);
    expect(isWindDownTime(new Date(2026, 9, 10, 1, 0))).toBe(true);
    expect(isWindDownTime(new Date(2026, 9, 10, 4, 0))).toBe(false);
  });

  it("keeps showing last night's tip after midnight", () => {
    expect(currentNightTip(new Date(2026, 9, 10, 1, 0))).toBe(nightlyTipFor(new Date(2026, 9, 9)));
  });
});
