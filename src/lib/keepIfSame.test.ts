import { describe, expect, it } from "vitest";
import { keepIfSame } from "@/lib/keepIfSame";

describe("keepIfSame", () => {
  it("keeps the row on screen when a reload brings the same data", () => {
    const shown = { id: "t1", name: "GRIZZ", logo_path: "a.png" };
    expect(keepIfSame(shown, { id: "t1", name: "GRIZZ", logo_path: "a.png" })).toBe(shown);
  });

  it("takes the new row when something changed", () => {
    const next = { id: "t1", name: "GRIZZ", logo_path: "b.png" };
    expect(keepIfSame({ id: "t1", name: "GRIZZ", logo_path: "a.png" }, next)).toBe(next);
    expect(keepIfSame(null, next)).toBe(next);
    expect(keepIfSame(next, null)).toBeNull();
  });
});
