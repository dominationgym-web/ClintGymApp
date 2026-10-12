import { describe, expect, it } from "vitest";
import { dayTotals } from "./dietPlan";
import { FOODS } from "./foods";
import { carbShares, cleanTime, dietAllows, goalKcal, macroTargets, makeDay, mealLabel, mealRoles, mealTimesFor, swapItem, swapOptions } from "./mealPlanMaker";

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

describe("goalKcal", () => {
  it("eats under for weight loss and over for muscle, never below the floor", () => {
    expect(goalKcal(2400, "lose", null)).toBe(2000);
    expect(goalKcal(2400, "maintain", null)).toBe(2400);
    expect(goalKcal(2400, "gain", null)).toBe(2700);
    expect(goalKcal(1450, "lose", null)).toBe(1200);
  });
  it("uses the coach's target when asked and there is one", () => {
    expect(goalKcal(2400, "coach", 2100)).toBe(2100);
    expect(goalKcal(2400, "coach", null)).toBe(2400);
  });
});

describe("goals, snack and diets (GRIZZ, 2026-10-12)", () => {
  it("is low carb for weight loss", () => {
    const lose = macroTargets(1600, 70, "lose");
    const keep = macroTargets(1600, 70, "maintain");
    expect(lose.carbs).toBeLessThan(keep.carbs);
    expect(lose.carbs).toBeLessThanOrEqual(150);
    expect(lose.protein).toBe(154);
  });
  const settings = { meals: mealTimesFor(4, "17:30"), training: "17:30" };
  it("adds a biltong snack for meat eaters", () => {
    const day = makeDay(settings, targets, true);
    const snack = day.meals.find((m) => m.name.includes("Protein snack"));
    expect(snack?.items[0].food).toBe("Biltong, lean, medium");
    expect(day.meals).toHaveLength(5);
  });
  it("keeps meat out for vegetarians and meat out but fish in for pescatarians", () => {
    for (const variety of [0, 1, 2, 3]) {
      const veg = makeDay({ ...settings, diet: "vegetarian" as const }, targets, true, variety);
      const pesc = makeDay({ ...settings, diet: "pescatarian" as const }, targets, true, variety);
      for (const m of veg.meals) for (const i of m.items) expect(dietAllows(i.food, "vegetarian")).toBe(true);
      for (const m of pesc.meals) for (const i of m.items) expect(dietAllows(i.food, "pescatarian")).toBe(true);
    }
    expect(dietAllows("Biltong, lean, medium", "pescatarian")).toBe(false);
    expect(dietAllows("Salmon (cooked)", "pescatarian")).toBe(true);
    expect(dietAllows("Salmon (cooked)", "vegetarian")).toBe(false);
    expect(swapOptions("Eggs", "vegetarian").some((f) => /chicken|tuna/i.test(f.name))).toBe(false);
  });
  it("sets meal times around training", () => {
    expect(mealTimesFor(4, "06:30")[0]).toBe("05:45");
    const evening = mealTimesFor(4, "17:30");
    expect(evening).toContain("16:00");
    expect(evening).toContain("18:45");
    expect(mealTimesFor(3, null)).toEqual(["07:00", "13:00", "19:00"]);
  });
  it("splits a big carb meal over two foods", () => {
    const big = makeDay(settings, macroTargets(3200, 70, "gain"), true);
    const carbFoods = new Set(FOODS.filter((f) => f.group === "Carbs").map((f) => f.name));
    for (const m of big.meals) {
      const carbs = m.items.filter((i) => carbFoods.has(i.food));
      if (carbs.length) expect(carbs[0].grams).toBeLessThanOrEqual(300);
    }
    expect(big.meals.some((m) => m.items.filter((i) => carbFoods.has(i.food)).length === 2)).toBe(true);
  });
});
