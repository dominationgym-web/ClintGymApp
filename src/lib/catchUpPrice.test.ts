import { describe, expect, it } from "vitest";
import { catchUpCharge } from "./catchUpPrice";

const day = (iso: string) => iso.slice(0, 10);

describe("catchUpCharge", () => {
  it("is always free, whoever cancelled (GRIZZ 2026-11-22)", () => {
    for (const by of ["client", "trainer"]) {
      const r = catchUpCharge({ id: "a", starts_at: "2026-11-11T08:00:00Z", cancelled_by: by }, { day });
      expect(r.price).toBe(0);
      expect(r.why).toContain("Free");
    }
  });
  it("says who cancelled", () => {
    expect(catchUpCharge({ id: "a", starts_at: "2026-11-11T08:00:00Z", cancelled_by: "trainer" }, { day }).why).toContain("you cancelled");
    expect(catchUpCharge({ id: "a", starts_at: "2026-11-11T08:00:00Z", away_id: "x" }, { day }).why).toContain("away");
  });
});
