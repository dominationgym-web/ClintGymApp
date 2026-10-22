import { describe, expect, it } from "vitest";
import { dayTotals } from "./dietPlan";
import { FOODS } from "./foods";
import { carbShares, cleanTime, dietAllows, FIBRE_TARGET, foodAllowed, goalKcal, kcalFloor, macroTargets, leaveOutEverywhere, leaveOutFood, makeDay, mealLabel, mealRoles, mealTimesFor, proteinWeight, swapItem, swapOptions, whyFoodMatters } from "./mealPlanMaker";
import { TARGET_MARGIN } from "./dietPlan";

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
  it("eats about 18% under for weight loss and over for muscle", () => {
    expect(goalKcal(2400, "lose", null)).toBe(1970);
    expect(goalKcal(2400, "maintain", null)).toBe(2400);
    expect(goalKcal(2400, "gain", null)).toBe(2700);
  });
  it("never goes under 1,200 kcal for women, 1,500 for men, or the BMR", () => {
    expect(goalKcal(1450, "lose", null, { sex: "female" })).toBe(1200);
    expect(goalKcal(1800, "lose", null, { sex: "male" })).toBe(1500);
    // 60 kg sedentary woman: needs 1,487, BMR 1,239. The cut would be 1,220.
    expect(goalKcal(1487, "lose", null, { sex: "female", bmr: 1239 })).toBe(1239);
    // Never more than what the body uses.
    expect(goalKcal(1400, "lose", null, { sex: "male" })).toBe(1400);
    expect(kcalFloor("male", 1700)).toBe(1700);
  });
  it("uses the coach's target when asked and there is one", () => {
    expect(goalKcal(2400, "coach", 2100)).toBe(2100);
    expect(goalKcal(2400, "coach", null)).toBe(2400);
  });
});

describe("goals, snack and diets (GRIZZ, 2026-10-12)", () => {
  it("keeps protein high for weight loss, with enough carbs left for whole foods", () => {
    const lose = macroTargets(1600, 70, "lose");
    expect(lose.protein).toBe(154);
    expect(lose.carbs).toBeGreaterThanOrEqual(80);
    expect(lose.protein * 4 + lose.carbs * 4 + lose.fat * 9).toBeLessThanOrEqual(1620);
  });
  it("bases protein on the weight at a BMI of 25 when BMI is over 30 (nutrition review, 2026-10-18)", () => {
    expect(proteinWeight(110, 165)).toBe(68);
    expect(proteinWeight(70, 175)).toBe(70);
    expect(proteinWeight(110)).toBe(110);
    expect(macroTargets(1700, 110, "lose", 165).protein).toBe(150);
  });
  const settings = { meals: mealTimesFor(4, "17:30"), training: "17:30" };
  it("adds a biltong snack for meat eaters", () => {
    const day = makeDay(settings, targets, true);
    const snack = day.meals.find((m) => m.name.includes("Protein snack"));
    expect(snack?.items[0].food).toBe("Biltong, lean, medium");
    expect(day.meals).toHaveLength(5);
  });
  it("has biltong at most once a day", () => {
    for (const variety of [0, 1, 2, 3, 4, 5]) {
      for (const td of [true, false]) {
        const day = makeDay(settings, macroTargets(1520, 65, "lose", 165), td, variety);
        expect(day.meals.flatMap((m) => m.items).filter((i) => /biltong/i.test(i.food))).toHaveLength(1);
      }
    }
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

describe("plan quality (nutrition review, 2026-10-18)", () => {
  const people = [
    { kcal: 1520, weight: 65, height: 165, diet: "everything" as const },
    { kcal: 1770, weight: 110, height: 165, diet: "everything" as const },
    { kcal: 1470, weight: 60, height: 162, diet: "vegetarian" as const },
    { kcal: 1289, weight: 60, height: 160, diet: "everything" as const, dairyFree: true },
    { kcal: 1500, weight: 62, height: 165, diet: "pescatarian" as const },
  ];
  const groups = (day: ReturnType<typeof makeDay>) => day.meals.flatMap((m) => m.items).map((i) => FOODS.find((f) => f.name === i.food));
  it("weight-loss days land on target with 25 g of fibre, fruit, legumes and dairy", () => {
    for (const p of people) {
      const targets = macroTargets(p.kcal, p.weight, "lose", p.height);
      for (const count of [2, 3, 4, 5]) {
        for (const training of ["06:30", "17:30", null]) {
          for (const variety of [0, 1, 2, 3]) {
            for (const td of [true, false]) {
              const settings = { meals: mealTimesFor(count, training), training, goal: "lose" as const, diet: p.diet, dairyFree: p.dairyFree };
              const day = makeDay(settings, targets, td, variety);
              const totals = dayTotals(day);
              expect(Math.abs(totals.kcal - p.kcal)).toBeLessThanOrEqual(TARGET_MARGIN);
              expect(totals.fibre).toBeGreaterThanOrEqual(FIBRE_TARGET);
              expect(Math.abs(totals.protein - targets.protein)).toBeLessThan(25);
              const foods = groups(day);
              expect(foods.some((f) => /apple|pear|berries|banana|raspberries/i.test(f?.name ?? ""))).toBe(true);
              for (const m of day.meals) for (const i of m.items) expect(foodAllowed(i.food, p.diet, p.dairyFree)).toBe(true);
              if (!p.dairyFree) expect(foods.some((f) => /milk|yoghurt|cottage/i.test(f?.name ?? ""))).toBe(true);
            }
          }
        }
      }
    }
  });
  it("puts legumes in the main meals", () => {
    const settings = { meals: mealTimesFor(4, "17:30"), training: "17:30", goal: "lose" as const };
    const legumes = [0, 1, 2, 3].some((v) =>
      makeDay(settings, macroTargets(1520, 65, "lose", 165), false, v).meals.some((m) => m.items.some((i) => /lentil|chickpea|bean/i.test(i.food))),
    );
    expect(legumes).toBe(true);
  });
  it("keeps dairy out when dairy-free", () => {
    expect(foodAllowed("Whey protein powder", "everything", true)).toBe(false);
    expect(foodAllowed("Greek yoghurt, plain", "vegetarian", true)).toBe(false);
    expect(foodAllowed("Eggs", "vegetarian", true)).toBe(true);
    expect(swapOptions("Chicken breast (cooked)", "everything", true).some((f) => /whey/i.test(f.name))).toBe(false);
  });
});

describe("leaving a food out", () => {
  const day = {
    meals: [
      { name: "Lunch", items: [{ food: "Chicken breast (cooked)", grams: 150 }, { food: "Broccoli", grams: 100 }] },
      { name: "Dinner", items: [{ food: "Beef steak (cooked)", grams: 150 }, { food: "Green beans", grams: 100 }, { food: "Apple", grams: 150 }] },
    ],
  };

  it("says why the food is there", () => {
    expect(whyFoodMatters("Broccoli")).toMatch(/fibre, vitamins/);
    expect(whyFoodMatters("Chicken breast (cooked)")).toMatch(/muscle/);
    expect(whyFoodMatters("Apple")).toMatch(/Fruit/);
    expect(whyFoodMatters("Greek yoghurt, plain")).toMatch(/calcium/);
  });

  it("can leave it out with nothing else changed", () => {
    const { day: out, rebalanced } = leaveOutFood(day, 0, 1, false);
    expect(rebalanced).toBe(false);
    expect(out.meals[0].items.map((i) => i.food)).toEqual(["Chicken breast (cooked)"]);
    expect(out.meals[1]).toEqual(day.meals[1]);
  });

  it("tops up the fibre from the other vegetables and fruit when a vegetable goes", () => {
    const before = dayTotals(day).fibre;
    const { day: out, rebalanced } = leaveOutFood(day, 0, 1, true);
    expect(rebalanced).toBe(true);
    expect(Math.abs(dayTotals(out).fibre - before)).toBeLessThanOrEqual(1);
    // The meat isn't touched.
    expect(out.meals[1].items[0]).toEqual({ food: "Beef steak (cooked)", grams: 150 });
  });

  it("tops up the protein from the other protein foods", () => {
    const before = dayTotals(day).protein;
    const { day: out } = leaveOutFood(day, 0, 0, true);
    expect(Math.abs(dayTotals(out).protein - before)).toBeLessThanOrEqual(2);
    expect(out.meals[1].items[1]).toEqual({ food: "Green beans", grams: 100 });
  });

  it("says when nothing else can make it up", () => {
    const single = { meals: [{ name: "Lunch", items: [{ food: "Chicken breast (cooked)", grams: 150 }, { food: "Broccoli", grams: 100 }] }] };
    expect(leaveOutFood(single, 0, 0, true).rebalanced).toBe(false);
  });
});

describe("foods the client doesn't eat", () => {
  const settings = { meals: ["07:00", "12:30", "18:30"], training: "17:00", goal: "maintain" as const, diet: "everything" as const };
  const foods = (d: ReturnType<typeof makeDay>) => d.meals.flatMap((m) => m.items.map((i) => i.food));

  it("leaves a food out of every meal and makes up what it gave", () => {
    const day = makeDay({ ...settings, avoid: [] }, targets, true, 0);
    const veg = foods(day).find((f) => ["Broccoli", "Green beans", "Spinach", "Cauliflower", "Mixed salad leaves", "Peppers", "Baby marrow", "Butternut", "Cabbage", "Carrots", "Tomato", "Mushrooms"].includes(f)) as string;
    expect(veg).toBeTruthy();
    const before = dayTotals(day).fibre;
    const { day: out, rebalanced } = leaveOutEverywhere(day, veg);
    expect(rebalanced).toBe(true);
    expect(foods(out)).not.toContain(veg);
    expect(dayTotals(out).fibre).toBeGreaterThanOrEqual(before - 3);
  });

  it("never puts a left-out food in a new plan", () => {
    for (let variety = 0; variety < 6; variety++) {
      const avoid = ["Broccoli", "Chicken breast (cooked)", "Biltong, lean, medium", "Apple", "Avocado"];
      const all = [...foods(makeDay({ ...settings, avoid }, targets, true, variety)), ...foods(makeDay({ ...settings, avoid }, targets, false, variety))];
      for (const f of avoid) expect(all).not.toContain(f);
      expect(all.length).toBeGreaterThan(5);
    }
  });
});
