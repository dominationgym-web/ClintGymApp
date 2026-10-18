import { describe, expect, it } from "vitest";
import {
  amountLabel,
  bmr,
  intakeDetails,
  lowTargetWarning,
  referralReasons,
  dailyTarget,
  dayTotals,
  emptyWeek,
  findFood,
  gramsFor,
  normaliseWeek,
  setByFor,
  targetStatus,
} from "@/lib/dietPlan";

const food = (name: string) => {
  const f = findFood(name);
  if (!f) throw new Error(name);
  return f;
};

describe("calorie target", () => {
  const client = { weight_kg: 80, height_cm: 180, age: 35, sex: "male" as const };

  it("works out BMR with Mifflin-St Jeor", () => {
    // 800 + 1125 - 175 + 5
    expect(bmr(client)).toBe(1755);
    expect(bmr({ ...client, sex: "female" })).toBe(1589);
    expect(bmr({ ...client, height_cm: null })).toBeNull();
  });

  it("adds activity and the trainer's over or under", () => {
    expect(dailyTarget({ ...client, activity: 1, adjust_kcal: 0 })).toBe(1755);
    expect(dailyTarget({ ...client, activity: 1.375, adjust_kcal: -300 })).toBe(2413 - 300);
  });
});

describe("weights from macros", () => {
  it("works out how much food gives the macros the trainer wants", () => {
    // 40 g carbs from rice at 28 g per 100 g ≈ 143 g → 145 g
    expect(gramsFor(food("White rice (cooked)"), "carbs", 40)).toBe(145);
    // 30 g protein from chicken at 31 g per 100 g ≈ 97 g → 95 g
    expect(gramsFor(food("Chicken breast (cooked)"), "protein", 30)).toBe(95);
    expect(gramsFor(food("Broccoli"), "weight", 120)).toBe(120);
  });

  it("sets each food by its main nutrient, or by weight", () => {
    expect(setByFor(food("Chicken breast (cooked)"))).toBe("protein");
    expect(setByFor(food("Sweet potato (cooked)"))).toBe("carbs");
    expect(setByFor(food("Olive oil"))).toBe("fat");
    expect(setByFor(food("Chia seeds"))).toBe("fibre");
    expect(setByFor(food("Spinach"))).toBe("weight");
  });
});

describe("day totals and the target warning", () => {
  it("adds up a day and flags over or under", () => {
    const week = emptyWeek();
    week[0].meals[0].items.push({ food: "Chicken breast (cooked)", grams: 100 }, { food: "White rice (cooked)", grams: 100 });
    expect(dayTotals(week[0])).toEqual({ kcal: 295, protein: 34, carbs: 28, fat: 4, fibre: 0 });
    expect(targetStatus(2100, 2000)).toEqual({ state: "over", by: 100 });
    expect(targetStatus(1800, 2000)).toEqual({ state: "under", by: 200 });
    expect(targetStatus(2030, 2000).state).toBe("on");
  });

  it("shows handy measures and keeps 7 days", () => {
    expect(amountLabel({ food: "Eggs", grams: 100 })).toBe("100 g (about 2 eggs)");
    expect(amountLabel({ food: "Olive oil", grams: 10 })).toBe("10 g");
    expect(normaliseWeek(null)).toHaveLength(7);
    expect(normaliseWeek([{ meals: [] }])[0].meals).toEqual([]);
  });
});

describe("intakeDetails", () => {
  it("reads height, weight, age and activity from the intake", () => {
    expect(
      intakeDetails({
        intake_responses: { age: "34", height_cm: "180", weight_kg: "85,5", activity_level: "Active" },
        sex: "male",
      }),
    ).toEqual({ weight_kg: 85.5, height_cm: 180, age: 34, sex: "male", activity: 1.55 });
  });

  it("leaves out missing or impossible answers", () => {
    expect(intakeDetails({ intake_responses: { age: "34", height_cm: "1.75" }, sex: null })).toEqual({
      weight_kg: null,
      height_cm: null,
      age: 34,
      sex: null,
      activity: null,
    });
  });
});

describe("safety (nutrition review, 2026-10-18)", () => {
  it("warns when a target is under the floor, the BMR or 25% under need", () => {
    expect(lowTargetWarning(1100, 1300, 1800, "female")).toMatch(/under 1,200 kcal for a woman, under their BMR, more than 25%/);
    expect(lowTargetWarning(1450, 1600, 2400, "male")).toMatch(/1,500 kcal for a man/);
    expect(lowTargetWarning(1500, 1300, 1800, "female")).toBeNull();
    expect(lowTargetWarning(null, 1300, 1800, "female")).toBeNull();
  });
  it("reads health conditions and age from the intake", () => {
    const intake = (detail: string, age = "34") => ({
      intake_responses: { has_health_condition_or_medication: "Yes", health_condition_detail: detail, age },
    });
    expect(referralReasons(intake("Type 2 diabetes, on metformin"))).toEqual(["diabetes"]);
    expect(referralReasons(intake("I'm 5 months pregnant"))).toEqual(["pregnancy or breastfeeding"]);
    expect(referralReasons(intake("Had anorexia as a teen"))).toEqual(["an eating disorder, now or in the past"]);
    expect(referralReasons(intake("Chronic kidney disease"))).toEqual(["kidney disease"]);
    expect(referralReasons(intake("Asthma"))).toEqual([]);
    expect(referralReasons(intake("Asthma", "16"))).toEqual(["being under 18"]);
    expect(referralReasons({ intake_responses: { has_health_condition_or_medication: "No", health_condition_detail: "diabetes" } })).toEqual([]);
    expect(referralReasons({ intake_responses: {} }, 15)).toEqual(["being under 18"]);
  });
});
