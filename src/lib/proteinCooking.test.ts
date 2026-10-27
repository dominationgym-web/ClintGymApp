import { describe, expect, it } from "vitest";
import { cookingIdeasFor, LIGHT_SAUCES, PROTEIN_COOKING, proteinFoodNames } from "@/lib/proteinCooking";
import { FOODS } from "@/lib/foods";

describe("protein cooking ideas", () => {
  it("has five ideas, each with steps, for every protein food in the food list", () => {
    for (const name of proteinFoodNames()) {
      const set = cookingIdeasFor(name);
      expect(set, name).toBeDefined();
      expect(set!.ideas).toHaveLength(5);
      for (const idea of set!.ideas) expect(idea.steps.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("only names foods that are in the food list, each in one set", () => {
    const all = PROTEIN_COOKING.flatMap((p) => p.foods);
    for (const name of all) expect(FOODS.some((f) => f.name === name), name).toBe(true);
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(PROTEIN_COOKING.map((p) => p.key)).size).toBe(PROTEIN_COOKING.length);
  });

  it("covers the high-protein dairy too", () => {
    expect(cookingIdeasFor("Cottage cheese, low fat")?.key).toBe("dairy");
    expect(cookingIdeasFor("Banana")).toBeUndefined();
  });

  it("has a few low-calorie sauces with ingredients and steps", () => {
    expect(LIGHT_SAUCES.length).toBeGreaterThanOrEqual(3);
    for (const s of LIGHT_SAUCES) {
      expect(s.kcal).toBeLessThanOrEqual(50);
      expect(s.ingredients.length).toBeGreaterThan(0);
      expect(s.steps.length).toBeGreaterThan(0);
    }
  });

  it("never suggests oats and uses no em-dashes", () => {
    const text = JSON.stringify([PROTEIN_COOKING, LIGHT_SAUCES]);
    expect(text.toLowerCase()).not.toMatch(/\boats?\b/);
    expect(text).not.toMatch(/—/);
  });
});
