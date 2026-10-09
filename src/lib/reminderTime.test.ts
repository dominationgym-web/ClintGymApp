import { describe, expect, it } from "vitest";
import { parseReminderTime } from "./reminderTime";

describe("parseReminderTime", () => {
  it("accepts the strict HH:MM form", () => {
    expect(parseReminderTime("08:00")).toBe("08:00");
    expect(parseReminderTime("18:30")).toBe("18:30");
  });

  it("accepts the ways people actually type a time on a phone", () => {
    expect(parseReminderTime("8:00")).toBe("08:00");
    expect(parseReminderTime("8.15")).toBe("08:15");
    expect(parseReminderTime("8h30")).toBe("08:30");
    expect(parseReminderTime("18 30")).toBe("18:30");
    expect(parseReminderTime(" 7:05 ")).toBe("07:05");
    expect(parseReminderTime("8")).toBe("08:00");
    expect(parseReminderTime("18")).toBe("18:00");
    expect(parseReminderTime("830")).toBe("08:30");
    expect(parseReminderTime("0800")).toBe("08:00");
    expect(parseReminderTime("1830")).toBe("18:30");
  });

  it("rejects things that aren't a time", () => {
    expect(parseReminderTime("")).toBeNull();
    expect(parseReminderTime("abc")).toBeNull();
    expect(parseReminderTime("24:00")).toBeNull();
    expect(parseReminderTime("12:60")).toBeNull();
    expect(parseReminderTime("8:5")).toBeNull();
    expect(parseReminderTime("12345")).toBeNull();
  });
});
