import { describe, expect, it } from "vitest";
import { isBodyweight, parseWeight } from "./weightInput";

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

describe("isBodyweight", () => {
  it("accepts 0 for a bodyweight exercise, but not blank or a weight", () => {
    expect(isBodyweight("0")).toBe(true);
    expect(isBodyweight("0,0")).toBe(true);
    expect(isBodyweight("")).toBe(false);
    expect(isBodyweight("5")).toBe(false);
  });
});
