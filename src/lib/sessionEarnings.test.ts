import { describe, expect, it } from "vitest";
import { shiftWeek, takings, takingsByPerson, weekDays, weekLabel, weekStart, weekTakings } from "./sessionEarnings";

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
