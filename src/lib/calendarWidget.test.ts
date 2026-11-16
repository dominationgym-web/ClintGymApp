import { describe, expect, it } from "vitest";
import { sessionFromWidgetLink, shortName, widgetLink, widgetView, type WidgetSession } from "./calendarWidget";

const at = (day: number, time: string) => {
  const [h, m] = time.split(":").map(Number);
  return new Date(2026, 10, day, h, m).toISOString();
};
let n = 0;
const s = (day: number, time: string, name: string, minutes = 40): WidgetSession => ({
  id: `00000000-0000-0000-0000-${String(++n).padStart(12, "0")}`,
  starts_at: at(day, time),
  minutes,
  name,
});

describe("calendar widget", () => {
  it("short names", () => {
    expect(shortName("Sarah Kruger")).toBe("Sarah K.");
    expect(shortName("Rob van Blerk")).toBe("Rob B.");
    expect(shortName("Quraish")).toBe("Quraish");
    expect(shortName("  ")).toBe("Client");
  });

  it("shows what's still to come today, the next one gold", () => {
    const v = widgetView([s(16, "05:50", "Sarah Kruger"), s(16, "06:30", "Quraish"), s(16, "17:30", "Lerato D")], new Date(2026, 10, 16, 5, 42));
    expect(v.title).toBe("Today");
    expect(v.rows.map((r) => [r.time, r.name, r.state])).toEqual([
      ["05:50", "Sarah K.", "now"],
      ["06:30", "Quraish", "later"],
      ["17:30", "Lerato D.", "later"],
    ]);
  });

  it("keeps a session that's over but not marked, with the one on now in gold", () => {
    const v = widgetView([s(16, "06:30", "Quraish"), s(16, "07:50", "Rob V"), s(16, "08:30", "Sharde")], new Date(2026, 10, 16, 7, 55));
    expect(v.rows.map((r) => [r.time, r.state])).toEqual([
      ["06:30", "over"],
      ["07:50", "now"],
      ["08:30", "later"],
    ]);
  });

  it("keeps yesterday's unmarked session on top", () => {
    const v = widgetView([s(15, "17:30", "Lerato"), s(16, "05:50", "Sarah")], new Date(2026, 10, 16, 5, 0));
    expect(v.rows.map((r) => [r.name, r.state])).toEqual([
      ["Lerato", "over"],
      ["Sarah", "now"],
    ]);
  });

  it("puts joint sessions on one line", () => {
    const v = widgetView([s(16, "07:10", "Thandi M"), s(16, "07:10", "Jo M")], new Date(2026, 10, 16, 6, 0));
    expect(v.rows).toHaveLength(1);
    expect(v.rows[0].name).toBe("Jo & Thandi");
  });

  it("shows tomorrow when today is done, and at most 6", () => {
    const list = ["05:10", "05:50", "06:30", "07:10", "07:50", "08:30", "09:10"].map((t, i) => s(17, t, `Client ${i}`));
    const v = widgetView(list, new Date(2026, 10, 16, 19, 0));
    expect(v.title).toBe("Tomorrow");
    expect(v.rows).toHaveLength(6);
    expect(v.more).toBe(1);
    expect(v.rows[0].state).toBe("now");
    expect(v.rows.every((r) => r.tomorrow)).toBe(true);
  });

  it("is empty with nothing booked", () => {
    expect(widgetView([], new Date(2026, 10, 16, 6, 0))).toEqual({ title: "Today", rows: [], more: 0 });
  });

  it("links", () => {
    const id = "6d1f8a4e-1c2b-4d3e-9f00-1234567890ab";
    expect(sessionFromWidgetLink(widgetLink(id))).toBe(id);
    expect(sessionFromWidgetLink(widgetLink())).toBe("");
    expect(sessionFromWidgetLink("consistentchange://other")).toBeNull();
    expect(sessionFromWidgetLink(null)).toBeNull();
  });
});
