import { describe, expect, it } from "vitest";
import { parseWeight } from "./weightInput";

describe("parseWeight", () => {
  it("reads a comma as the decimal mark", () => {
    expect(parseWeight("22,5")).toBe(22.5);
    expect(parseWeight(" 22.5 ")).toBe(22.5);
    expect(parseWeight("40")).toBe(40);
  });

  it("treats blank, zero and nonsense as no weight", () => {
    expect(parseWeight("")).toBeNull();
    expect(parseWeight(undefined)).toBeNull();
    expect(parseWeight("0")).toBeNull();
    expect(parseWeight("abc")).toBeNull();
    expect(parseWeight("2,2,5")).toBeNull();
  });
});
