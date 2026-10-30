import { describe, expect, it } from "vitest";
import { firstIntakeProblem, INTAKE_PAGES, intakePageProblem, intakeTrainingDays, type IntakeRequired } from "@/lib/intakePages";

const done: IntakeRequired = {
  sex: "Female",
  age: "34",
  heightCm: "165,5",
  weightKg: "70",
  activity: "Lightly active",
  goals: ["Get stronger"],
  experience: "Beginner",
  occupationType: "Desk / office",
  eatsBreakfast: false,
  currentlyTraining: true,
  trainingDays: ["Monday", "Thursday"],
  hasInjury: false,
};

describe("intake pages", () => {
  it("ends with its own injuries page", () => {
    expect(INTAKE_PAGES[INTAKE_PAGES.length - 1]).toBe("Injuries");
  });
  it("lets a finished form through, with a comma in the height", () => {
    expect(firstIntakeProblem(done)).toBeNull();
  });
  it("checks each page on its own", () => {
    expect(intakePageProblem(0, { ...done, heightCm: "17" })?.title).toBe("Your height");
    expect(intakePageProblem(1, { ...done, goals: [] })?.title).toBe("Your goals");
    expect(intakePageProblem(4, { ...done, eatsBreakfast: null })).toBeNull();
    expect(intakePageProblem(7, { ...done, hasInjury: null })?.title).toBe("Any injuries or pain?");
  });
  it("points Submit at the first page with a gap", () => {
    expect(firstIntakeProblem({ ...done, currentlyTraining: null, hasInjury: null })?.page).toBe(5);
  });

  it("asks which days they train", () => {
    expect(intakePageProblem(5, { ...done, trainingDays: [] })?.title).toBe("Your training days");
  });
  it("reads their days back as weekday numbers", () => {
    expect(intakeTrainingDays({ training_days: "Monday, Wednesday, Sunday" })).toEqual([1, 3, 7]);
    expect(intakeTrainingDays({})).toEqual([]);
    expect(intakeTrainingDays(null)).toEqual([]);
  });
});
