import { describe, expect, it } from "vitest";
import { catchUpCharge, catchUpRoot, type CatchUpSession } from "./catchUpPrice";

const opts = { money: (n: number) => `R${n}`, day: (iso: string) => iso.slice(0, 10) };
const s = (x: Partial<CatchUpSession> & { id: string }): CatchUpSession => ({ starts_at: "2026-11-11T08:00:00Z", fee: 650, ...x });

describe("catchUpCharge", () => {
  it("is free when the client cancelled in time", () => {
    const missed = s({ id: "a", cancelled_by: "client" });
    expect(catchUpCharge(missed, [missed], opts).price).toBe(0);
  });

  it("charges the session's price when the trainer cancelled", () => {
    const missed = s({ id: "a", cancelled_by: "trainer" });
    const r = catchUpCharge(missed, [missed], opts);
    expect(r.price).toBe(650);
    expect(r.why).toContain("You cancelled");
  });

  it("ignores another client training in the same slot (Jordan, 2026-11-22)", () => {
    // Jordan: Wed 11 Nov cancelled by the trainer, free catch-up on Mon 16 Nov
    // next to Luanne, which Jordan cancelled. The new catch-up is his R650.
    const orig = s({ id: "o", cancelled_by: "trainer", fee: 650 });
    const missedCatchUp = s({ id: "m", starts_at: "2026-11-16T07:10:00Z", fee: 0, cancelled_by: "client", makeup_for: "o" });
    const luanne = s({ id: "l", starts_at: "2026-11-16T07:10:00Z", fee: 550, status: "done" });
    const r = catchUpCharge(missedCatchUp, [orig, missedCatchUp, luanne], opts);
    expect(r.price).toBe(650);
    expect(r.why).toContain("missed the catch-up");
  });

  it("is free when a paid catch-up was missed (already charged once)", () => {
    const orig = s({ id: "o", cancelled_by: "trainer" });
    const missedCatchUp = s({ id: "m", fee: 650, cancelled_by: "client", makeup_for: "o" });
    expect(catchUpCharge(missedCatchUp, [orig, missedCatchUp], opts).price).toBe(0);
  });

  it("uses the alone price for a pair", () => {
    const missed = s({ id: "a", cancelled_by: "client", fee: 500 });
    expect(catchUpCharge(missed, [missed], { ...opts, plan: { fee: 500, group_size: 2, solo_fee: 750 } }).price).toBe(750);
  });

  it("stops on a loop", () => {
    const a = s({ id: "a", fee: 0, makeup_for: "b" });
    const b = s({ id: "b", fee: 0, makeup_for: "a" });
    expect(catchUpRoot(a, [a, b]).id).toBe("b");
  });
});
