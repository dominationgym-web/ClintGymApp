import { describe, expect, it } from "vitest";
import { estimateCalories, FOOD_GROUP_EXAMPLES, NUTRITION_GUIDE, parseGrams, UNDERSTANDING_CARBS } from "@/lib/nutrition";

describe("estimateCalories", () => {
  it("uses 4 kcal for protein and carbs, 2 for fibre and 9 for fat", () => {
    expect(estimateCalories({ protein: 30, carbs: 40, fibre: 5, fat: 10 })).toEqual({
      total: 380,
      parts: { protein: 120, carbs: 160, fibre: 10, fat: 90 },
    });
  });
  it("is 0 with nothing entered", () => {
    expect(estimateCalories({ protein: 0, carbs: 0, fibre: 0, fat: 0 }).total).toBe(0);
  });
});

describe("parseGrams", () => {
  it("reads numbers with a dot or comma and ignores junk", () => {
    expect(parseGrams("12,5")).toBe(12.5);
    expect(parseGrams(" 20 ")).toBe(20);
    expect(parseGrams("")).toBe(0);
    expect(parseGrams("abc")).toBe(0);
    expect(parseGrams("-3")).toBe(0);
  });
});

describe("NUTRITION_GUIDE", () => {
  it("never recommends oats", () => {
    expect(JSON.stringify([NUTRITION_GUIDE, FOOD_GROUP_EXAMPLES, UNDERSTANDING_CARBS]).toLowerCase()).not.toMatch(/\boats?\b/);
  });
});
