import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { fingerprintOf } from "@/lib/workoutChanges";

describe("fingerprintOf", () => {
  const a = { id: "1", workout_date: "2026-10-20", program_id: "p1" };
  const b = { id: "2", workout_date: "2026-10-21", program_id: "p2" };

  it("ignores the order rows come back in", () => {
    expect(fingerprintOf({ calendar: [a, b], program: {} })).toBe(fingerprintOf({ program: {}, calendar: [b, a] }));
  });

  it("changes when a workout is swapped, added or taken off", () => {
    const start = fingerprintOf({ calendar: [a, b] });
    expect(fingerprintOf({ calendar: [a, { ...b, program_id: "p3" }] })).not.toBe(start);
    expect(fingerprintOf({ calendar: [a, b, { id: "3", workout_date: "2026-10-22", program_id: "p1" }] })).not.toBe(start);
    expect(fingerprintOf({ calendar: [a] })).not.toBe(start);
  });
});
