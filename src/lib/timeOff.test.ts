import { describe, expect, it } from "vitest";
import { blockRanges, sessionsInBlock } from "./timeOff";

const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).toISOString();

describe("block out time", () => {
  it("covers whole days", () => {
    const r = blockRanges("2026-11-04", 3, null, null, false)!;
    expect(r).toHaveLength(1);
    expect(r[0].from).toEqual(new Date(2026, 10, 4));
    expect(r[0].to).toEqual(new Date(2026, 10, 7));
  });
  it("covers some hours on each day", () => {
    const r = blockRanges("2026-11-04", 2, "06:00", "09:00", true)!;
    expect(r).toHaveLength(2);
    expect(r[1].from).toEqual(new Date(2026, 10, 5, 6));
    expect(blockRanges("2026-11-04", 1, "09:00", "06:00", true)).toBeNull();
    expect(blockRanges("2026-11-04", 1, null, "06:00", true)).toBeNull();
  });
  it("finds the booked sessions it cancels", () => {
    const list = [
      { id: "a", status: "booked" as const, starts_at: at(4, 6) },
      { id: "b", status: "booked" as const, starts_at: at(4, 10) },
      { id: "c", status: "cancelled" as const, starts_at: at(4, 7) },
      { id: "d", status: "booked" as const, starts_at: at(5, 6) },
    ];
    expect(sessionsInBlock(list, blockRanges("2026-11-04", 1, "06:00", "09:00", true)!).map((s) => s.id)).toEqual(["a"]);
    expect(sessionsInBlock(list, blockRanges("2026-11-04", 1, null, null, false)!).map((s) => s.id)).toEqual(["a", "b"]);
  });
});
