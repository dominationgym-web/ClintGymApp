import { describe, expect, it } from "vitest";
import { monthForecast, percentOf, predicted, shiftWeek, takings, takingsByPerson, weekDays, weekForecast, weekLabel, weekStart, weekTakings } from "./sessionEarnings";

const now = new Date(2026, 10, 4, 12, 0); // Wed 4 Nov 2026, 12:00
const at = (d: number, h: number) => new Date(2026, 10, d, h, 0).toISOString();
const s = (o: Partial<Parameters<typeof takings>[0][number]> & { who?: string }) => ({
  status: "booked" as const,
  starts_at: at(4, 6),
  minutes: 40,
  charge: null,
  cancelled_by: null,
  fee: 350,
  who: "A",
  ...o,
});

describe("takings", () => {
  it("counts trained, charged cancellations and no-shows, and leaves out credits", () => {
    const t = takings(
      [
        s({ status: "done" }),
        s({ status: "booked", starts_at: at(4, 5) }), // over, not marked: counts as done
        s({ status: "cancelled", charge: "charge", cancelled_by: "client" }), // late
        s({ status: "no_show", charge: "charge" }),
        s({ status: "cancelled", charge: "credit", cancelled_by: "client" }), // in time
        s({ status: "cancelled", cancelled_by: "trainer", charge: "credit" }),
        s({ status: "cancelled", charge: null, cancelled_by: "client" }), // decide
        s({ status: "booked", starts_at: at(4, 17) }), // still to come
        s({ status: "removed" }),
      ],
      now
    );
    expect(t.made).toBe(1400);
    expect(t.trained).toBe(2);
    expect(t.charged).toBe(2);
    expect(t.fromCancellations).toBe(700);
    expect(t.credited).toBe(350);
    expect(t.creditedCount).toBe(1);
    expect(t.byCoach).toBe(350);
    expect(t.byCoachCount).toBe(1);
    expect(t.undecided).toBe(350);
    expect(t.toCome).toBe(350);
  });
  it("uses each session's own fee", () => {
    expect(takings([s({ status: "done", fee: 250 }), s({ status: "done", fee: 500 })], now).made).toBe(750);
  });
});

describe("weeks", () => {
  it("starts on Monday", () => {
    expect(weekStart(now)).toBe("2026-11-02");
    expect(weekStart(new Date(2026, 10, 8))).toBe("2026-11-02");
    expect(weekStart(new Date(2026, 10, 9))).toBe("2026-11-09");
    expect(weekDays("2026-11-02")).toHaveLength(7);
    expect(weekDays("2026-10-26")[6]).toBe("2026-11-01");
    expect(shiftWeek("2026-11-02", -1)).toBe("2026-10-26");
    expect(weekLabel("2026-11-02")).toBe("Mon 2 Nov – Sun 8 Nov");
  });
  it("adds up each day and the week", () => {
    const list = [s({ status: "done", starts_at: at(2, 6) }), s({ status: "done", starts_at: at(3, 6), who: "B" }), s({ status: "done", starts_at: at(9, 6) })];
    const w = weekTakings(list, "2026-11-02", now);
    expect(w.total.made).toBe(700);
    expect(w.days[0].takings.made).toBe(350);
    expect(w.days[2].sessions).toBe(0);
    expect(takingsByPerson(list.slice(0, 2), (x) => x.who, now).map((p) => p.name)).toEqual(["A", "B"]);
  });
});

describe("predicted income", () => {
  const p = (o: Partial<Parameters<typeof predicted>[0][number]>) => ({ ...s({}), makeup_for: null, updated_at: at(1, 9), ...o });
  const list = [
    p({ status: "done", starts_at: at(2, 6) }), // Mon, trained
    p({ status: "cancelled", charge: "credit", cancelled_by: "client", starts_at: at(3, 6) }), // in time: predicted, not made
    p({ status: "booked", starts_at: at(6, 6) }), // Fri, to come
    p({ status: "booked", starts_at: at(5, 6), makeup_for: "x", fee: 0 }), // catch-up: not predicted again
    p({ status: "removed", starts_at: at(4, 6), updated_at: at(3, 9) }), // moved before: left out
    p({ status: "removed", starts_at: at(3, 17), updated_at: at(3, 19) }), // didn't come: predicted
    p({ status: "booked", starts_at: at(10, 6) }), // next week
    p({ status: "done", starts_at: new Date(2026, 9, 30, 6).toISOString() }), // October
  ];
  it("counts what was on the calendar, whatever happened", () => {
    expect(predicted(list)).toBe(350 * 6);
  });
  it("gives the week and the month, predicted against made", () => {
    const w = weekForecast(list, "2026-11-02", now);
    expect(w).toEqual({ predicted: 1400, made: 350, toCome: 350, heading: 700, finished: false });
    expect(weekForecast(list, "2026-11-02", new Date(2026, 10, 9, 8)).finished).toBe(true);
    const m = monthForecast(list, now);
    expect(m.predicted).toBe(1750);
    expect(m.made).toBe(350);
    expect(percentOf(350, 1400)).toBe(25);
    expect(percentOf(0, 0)).toBe(0);
  });
});
