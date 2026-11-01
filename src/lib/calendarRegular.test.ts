import { describe, expect, it } from "vitest";
import { firstStarts, regularFromCalendar } from "./calendarRegular";

const now = new Date(2026, 10, 1, 9, 0); // Sun 1 Nov 2026
const s = (d: number, h: number, m: number, o: Partial<{ client_id: string; status: "booked" | "removed" | "done"; repeat_id: string | null; minutes: number }> = {}) => ({
  client_id: "c1",
  starts_at: new Date(2026, 10, d, h, m).toISOString(),
  status: "booked" as const,
  minutes: 40,
  repeat_id: null as string | null,
  ...o,
});

describe("regular times from the calendar", () => {
  it("takes weekly sessions straight away, Monday first", () => {
    const r = regularFromCalendar([s(4, 5, 10, { repeat_id: "r" }), s(2, 5, 50, { repeat_id: "r2" })], "c1", now);
    expect(r.regular).toEqual([
      { weekday: 1, time: "05:50" },
      { weekday: 3, time: "05:10" },
    ]);
    expect(r.minutes).toBe(40);
  });
  it("needs the same day and time twice for one-off sessions", () => {
    expect(regularFromCalendar([s(3, 6, 30)], "c1", now).regular).toEqual([]);
    expect(regularFromCalendar([s(3, 6, 30), s(10, 6, 30)], "c1", now).regular).toEqual([{ weekday: 2, time: "06:30" }]);
  });
  it("leaves out other people and removed sessions", () => {
    expect(regularFromCalendar([s(4, 5, 10, { repeat_id: "r", client_id: "c2" }), s(5, 5, 10, { repeat_id: "r", status: "removed" })], "c1", now).regular).toEqual([]);
  });
  it("works for diary-only names", () => {
    const g = (d: number) => ({ ...s(d, 7, 10, { repeat_id: "r" }), client_id: null as unknown as string, guest_name: d === 4 ? "Pieter " : "pieter" });
    expect(regularFromCalendar([g(4), g(5)], { name: "Pieter" }, now).regular).toEqual([
      { weekday: 3, time: "07:10" },
      { weekday: 4, time: "07:10" },
    ]);
  });
});

describe("firstStarts", () => {
  it("books today when the time is still to come, else next week", () => {
    const got = firstStarts(
      [
        { weekday: 0, time: "17:00" }, // Sunday later today
        { weekday: 0, time: "06:00" }, // Sunday, already past
        { weekday: 2, time: "05:50" }, // Tuesday
      ],
      now,
    ).map((iso) => new Date(iso));
    expect(got.map((d) => [d.getDate(), d.getHours(), d.getMinutes()])).toEqual([
      [1, 17, 0],
      [8, 6, 0],
      [3, 5, 50],
    ]);
  });
});
