import { describe, expect, it } from "vitest";
import { sessionFromWidgetLink, shortName, widgetLink, widgetView, type WidgetSession } from "./calendarWidget";

const at = (day: number, time: string) => {
  const [h, m] = time.split(":").map(Number);
  return new Date(2026, 10, day, h, m).toISOString();
};
let n = 0;
const s = (day: number, time: string, name: string, minutes = 40, more: Partial<WidgetSession> = {}): WidgetSession => ({
  id: `00000000-0000-0000-0000-${String(++n).padStart(12, "0")}`,
  starts_at: at(day, time),
  minutes,
  name,
  status: "booked",
  charge: null,
  cancelled_by: null,
  ...more,
});
// A working day of back-to-back 40 minute sessions from 05:10 to 11:20, so no gaps.
const DAY = { day_start: "05:10", day_end: "12:00", minutes: 40 };
const view = (list: WidgetSession[], now: Date, settings: Parameters<typeof widgetView>[1] = DAY) => widgetView(list, settings, now);

describe("calendar widget", () => {
  it("short names", () => {
    expect(shortName("Sarah Kruger")).toBe("Sarah K.");
    expect(shortName("Rob van Blerk")).toBe("Rob B.");
    expect(shortName("Quraish")).toBe("Quraish");
    expect(shortName("  ")).toBe("Client");
  });

  it("shows what's still to come today, the next one gold", () => {
    const v = view([s(16, "05:50", "Sarah Kruger"), s(16, "06:30", "Quraish"), s(16, "17:30", "Lerato D")], new Date(2026, 10, 16, 5, 42), { day_start: "05:50", day_end: "07:10", minutes: 40 });
    expect(v.title).toBe("Today");
    expect(v.rows.map((r) => [r.time, r.name, r.state])).toEqual([
      ["05:50", "Sarah K.", "now"],
      ["06:30", "Quraish", "later"],
      ["17:30", "Lerato D.", "later"],
    ]);
  });

  it("keeps a session that's over but not marked, with the one on now in gold", () => {
    const v = view([s(16, "06:30", "Quraish"), s(16, "07:50", "Rob V"), s(16, "08:30", "Sharde")], new Date(2026, 10, 16, 7, 55), { day_start: "06:30", day_end: "09:10", minutes: 40 });
    expect(v.rows.map((r) => [r.time, r.state])).toEqual([
      ["06:30", "over"],
      ["07:50", "now"],
      ["08:30", "later"],
    ]);
  });

  it("keeps yesterday's unmarked session on top", () => {
    const v = view([s(15, "17:30", "Lerato"), s(16, "05:50", "Sarah")], new Date(2026, 10, 16, 5, 0), { day_start: "05:50", day_end: "06:30", minutes: 40 });
    expect(v.rows.map((r) => [r.name, r.state])).toEqual([
      ["Lerato", "over"],
      ["Sarah", "now"],
    ]);
  });

  it("puts joint sessions on one line", () => {
    const v = view([s(16, "07:10", "Thandi M"), s(16, "07:10", "Jo M")], new Date(2026, 10, 16, 6, 0), { day_start: "07:10", day_end: "07:50", minutes: 40 });
    expect(v.rows).toHaveLength(1);
    expect(v.rows[0].name).toBe("Thandi & Jo");
  });

  it("shows tomorrow when today is done", () => {
    const list = ["05:10", "05:50", "06:30", "07:10", "07:50", "08:30", "09:10"].map((t, i) => s(17, t, `Client ${i}`));
    const v = view(list, new Date(2026, 10, 16, 19, 0), { day_start: "05:10", day_end: "09:50", minutes: 40 });
    expect(v.title).toBe("Tomorrow");
    expect(v.rows).toHaveLength(7);
    expect(v.sessions).toBe(7);
    expect(v.rows[0].state).toBe("now");
    expect(v.rows.every((r) => r.tomorrow)).toBe(true);
  });

  it("is empty with nothing booked", () => {
    expect(view([], new Date(2026, 10, 16, 6, 0))).toEqual({ title: "Today", rows: [], more: 0, sessions: 0 });
  });

  it("shows the same day as 1 on 1 Today (GRIZZ's Tue 17 Nov)", () => {
    const list = [
      s(17, "05:10", "Brandon"),
      s(17, "05:50", "Jade"),
      s(17, "05:50", "Camilla"),
      s(17, "06:30", "Swantish"),
      s(17, "07:10", "Steven Boyd", 40, { status: "cancelled", charge: "credit", away_id: "a1", note: "Away from 15 November until 21 November" }),
      s(17, "07:50", "Tariq"),
      s(17, "08:30", "Dave"),
      s(17, "08:30", "Sharde"),
      s(17, "09:10", "Pumeshen Bisetty"),
      s(17, "10:00", "Bianca", 40, { status: "cancelled", charge: "makeup", away_id: "a2", note: "Away from 17 November until 4 January" }),
      s(17, "10:00", "Divyesh", 40, { makeup_for: "s9" }),
      s(17, "10:40", "STACY GREEN"),
      s(17, "11:20", "Kubs"),
      s(16, "10:00", "Trained Yesterday", 40, { status: "done" }),
    ];
    const v = view(list, new Date(2026, 10, 17, 3, 57));
    expect(v.title).toBe("Today");
    expect(v.rows.map((r) => [r.time, r.name, r.state, r.catchUp, r.note, r.out])).toEqual([
      ["05:10", "Brandon", "now", false, null, null],
      ["05:50", "Jade & Camilla", "later", false, null, null],
      ["06:30", "Swantish", "later", false, null, null],
      ["07:10", "Steven B.", "free", false, "Away · free", null],
      ["07:50", "Tariq", "later", false, null, null],
      ["08:30", "Dave & Sharde", "later", false, null, null],
      ["09:10", "Pumeshen B.", "later", false, null, null],
      ["10:00", "Divyesh", "later", true, null, "Bianca away"],
      ["10:40", "STACY G.", "later", false, null, null],
      ["11:20", "Kubs", "later", false, null, null],
    ]);
    expect(v.sessions).toBe(9);
  });

  it("shows the green Available gaps still to come, like Today", () => {
    const list = [s(17, "05:10", "Brandon"), s(17, "06:30", "Swantish")];
    const v = view(list, new Date(2026, 10, 17, 5, 30), { day_start: "05:10", day_end: "07:50", minutes: 40 });
    expect(v.rows.map((r) => [r.time, r.name, r.state])).toEqual([
      ["05:10", "Brandon", "now"],
      ["05:50", "Available", "open"],
      ["06:30", "Swantish", "later"],
      ["07:10", "Available", "open"],
    ]);
  });

  it("drops a name once it's trained, and a cancelled slot shows green until its time", () => {
    const list = [
      s(17, "05:10", "Brandon", 40, { status: "done" }),
      s(17, "05:50", "Jade", 40, { status: "cancelled", charge: "credit", cancelled_by: "client" }),
      s(17, "06:30", "Swantish"),
    ];
    const v = view(list, new Date(2026, 10, 17, 5, 30), { day_start: "05:10", day_end: "07:10", minutes: 40 });
    expect(v.rows.map((r) => [r.time, r.name, r.state, r.note])).toEqual([
      ["05:50", "Jade", "free", "Cancelled · free"],
      ["06:30", "Swantish", "now", null],
    ]);
  });

  it("links", () => {
    const id = "6d1f8a4e-1c2b-4d3e-9f00-1234567890ab";
    expect(sessionFromWidgetLink(widgetLink(id))).toBe(id);
    expect(sessionFromWidgetLink(widgetLink())).toBe("");
    expect(sessionFromWidgetLink("consistentchange://other")).toBeNull();
    expect(sessionFromWidgetLink(null)).toBeNull();
  });
});
