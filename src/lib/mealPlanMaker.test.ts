import { describe, expect, it } from "vitest";
import { dayTotals } from "./dietPlan";
import { FOODS } from "./foods";
import { carbShares, cleanTime, macroTargets, makeDay, mealLabel, mealRoles, swapItem, swapOptions } from "./mealPlanMaker";

const targets = macroTargets(2400, 80);

describe("macroTargets", () => {
  it("gives medium carbs from what's left after protein and fat", () => {
    expect(targets).toEqual({ kcal: 2400, protein: 160, carbs: 278, fat: 72 });
  });
});

describe("mealRoles", () => {
  it("finds the meal before and after training", () => {
    expect(mealRoles(["07:00", "12:00", "16:00", "19:00"], "17:30")).toEqual(["meal", "meal", "pre", "post"]);
  });
  it("has none without training", () => {
    expect(mealRoles(["07:00", "19:00"], null)).toEqual(["meal", "meal"]);
  });
  it("names meals by time and role", () => {
    expect(mealLabel("07:00", "meal")).toBe("07:00 · Breakfast");
    expect(mealLabel("19:00", "post")).toBe("19:00 · Post-workout reload");
  });
});

describe("carbShares", () => {
  it("puts most carbs around training", () => {
    const shares = carbShares(["meal", "meal", "pre", "post"], ["07:00", "12:00", "16:00", "19:00"], true);
    expect(shares[2] + shares[3]).toBeCloseTo(0.7);
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
  it("lightens the evening on a rest day", () => {
    const shares = carbShares(["meal", "meal", "meal"], ["07:00", "13:00", "19:00"], false);
    expect(shares[2]).toBeLessThan(shares[0]);
  });
});

describe("makeDay", () => {
  const settings = { meals: ["07:00", "12:00", "16:00", "19:00"], training: "17:30" };
  it("lands near the day's targets and only uses foods from the list", () => {
    for (const variety of [0, 1, 2, 3]) {
      const day = makeDay(settings, targets, true, variety);
      const totals = dayTotals(day);
      expect(Math.abs(totals.kcal - targets.kcal)).toBeLessThan(300);
      expect(Math.abs(totals.protein - targets.protein)).toBeLessThan(25);
      const names = FOODS.map((f) => f.name);
      for (const m of day.meals) for (const i of m.items) expect(names).toContain(i.food);
    }
  });
  it("keeps carbs lower away from training", () => {
    const day = makeDay(settings, targets, true);
    const carbs = day.meals.map((m) => dayTotals({ meals: [m] }).carbs);
    expect(carbs[2] + carbs[3]).toBeGreaterThan(carbs[0] + carbs[1]);
  });
});

describe("swaps", () => {
  it("keeps the protein when swapping a protein food", () => {
    const swapped = swapItem({ food: "Chicken breast (cooked)", grams: 150 }, "Ostrich steak (cooked)");
    expect(swapped).toEqual({ food: "Ostrich steak (cooked)", grams: 160 });
    expect(swapItem({ food: "Chicken breast (cooked)", grams: 150 }, "Biltong, lean, medium").grams).toBe(95);
  });
  it("offers the rest of the group", () => {
    const options = swapOptions("White rice (cooked)");
    expect(options.every((f) => f.group === "Carbs")).toBe(true);
    expect(options.some((f) => f.name === "White rice (cooked)")).toBe(false);
  });
  it("reads typed times", () => {
    expect(cleanTime("7")).toBe("07:00");
    expect(cleanTime("17:30")).toBe("17:30");
    expect(cleanTime("25:00")).toBeNull();
  });
});
