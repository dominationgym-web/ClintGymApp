import { describe, expect, it } from "vitest";
import { equipmentList, equipmentSummary, exerciseNeeds, fitsEquipment, homeFit, type EquipmentItem } from "./equipment";
import { forPlace, withHomeAlternatives } from "./exerciseFilter";

const item = (type: EquipmentItem["type"], extra: Partial<EquipmentItem> = {}): EquipmentItem => ({ id: type, type, ...extra });
const home = (name: string) => ({ name, home_friendly: true });

describe("exerciseNeeds", () => {
  it("reads the equipment from the name", () => {
    expect(exerciseNeeds("Dumbbell Curl")).toEqual([["dumbbells"]]);
    expect(exerciseNeeds("Kettlebell Swing")).toEqual([["kettlebells"]]);
    expect(exerciseNeeds("Band Row")).toEqual([["bands"]]);
    expect(exerciseNeeds("Barbell Back Squat")).toEqual([["barbell"]]);
    expect(exerciseNeeds("Goblet Squat")).toEqual([["dumbbells", "kettlebells"]]);
    expect(exerciseNeeds("Push-Up")).toEqual([]);
    expect(exerciseNeeds("Hammer Curl")).toEqual([["dumbbells"]]);
  });
  it("adds a bench, an incline bench or a pull-up bar where needed", () => {
    expect(exerciseNeeds("Bench Press")).toEqual([["barbell"], ["bench"]]);
    expect(exerciseNeeds("Incline Dumbbell Press")).toEqual([["dumbbells"], ["bench_incline"]]);
    expect(exerciseNeeds("Pull-Up")).toEqual([["pullup_bar"]]);
    expect(exerciseNeeds("Band Assisted Pull-Up")).toEqual([["bands"], ["pullup_bar"]]);
    expect(exerciseNeeds("Decline Push-Up")).toEqual([]);
    expect(exerciseNeeds("Barbell Pullover")).toEqual([["barbell"]]);
  });
});

describe("fitsEquipment", () => {
  const dumbbellsOnly = [item("dumbbells", { count: 2, weight: "10 kg" })];
  it("only allows exercises the list covers", () => {
    expect(fitsEquipment(home("Dumbbell Curl"), dumbbellsOnly)).toBe(true);
    expect(fitsEquipment(home("Barbell Curl"), dumbbellsOnly)).toBe(false);
    expect(fitsEquipment(home("Goblet Squat"), dumbbellsOnly)).toBe(true);
    expect(fitsEquipment(home("Push-Up"), dumbbellsOnly)).toBe(true);
    expect(fitsEquipment(home("Flat Dumbbell Press"), dumbbellsOnly)).toBe(false);
  });
  it("needs an adjustable bench for incline work", () => {
    const flat = [...dumbbellsOnly, item("bench", { option: "Flat" })];
    expect(fitsEquipment(home("Flat Dumbbell Press"), flat)).toBe(true);
    expect(fitsEquipment(home("Incline Dumbbell Press"), flat)).toBe(false);
    expect(fitsEquipment(home("Incline Dumbbell Press"), [...dumbbellsOnly, item("bench", { option: "Adjustable" })])).toBe(true);
  });
  it("lets the trainer add gym exercises a multi station can do", () => {
    const station = [item("multi_station", { exercises: ["Lat Pulldown"] })];
    expect(fitsEquipment({ name: "Lat Pulldown", home_friendly: false }, station)).toBe(true);
    expect(fitsEquipment({ name: "Leg Press", home_friendly: false }, station)).toBe(false);
  });
  it("matches a described extra like a ball", () => {
    expect(fitsEquipment(home("Stability Ball Leg Curl"), [item("other", { note: "Swiss ball" })])).toBe(true);
    expect(fitsEquipment(home("Stability Ball Leg Curl"), dumbbellsOnly)).toBe(false);
  });
});

describe("homeFit", () => {
  it("is off until the client lists something", () => {
    expect(homeFit([])).toBeNull();
    expect(homeFit(null)).toBeNull();
    expect(homeFit([item("bands")])).not.toBeNull();
  });
  it("narrows the Home tab and the home swaps", () => {
    const lib = [
      { id: "1", name: "Leg Press", category: "Legs", home_friendly: false },
      { id: "2", name: "Barbell Back Squat", category: "Legs", home_friendly: true },
      { id: "3", name: "Dumbbell Goblet Split Squat", category: "Legs", home_friendly: true },
    ];
    const fit = homeFit([item("dumbbells", { count: 1 })]);
    expect(forPlace(lib, "home", fit).map((e) => e.id)).toEqual(["3"]);
    const rows = [{ kind: "exercise", exercise_id: "2", exercise_name: "Barbell Back Squat" }];
    expect(withHomeAlternatives(rows, lib, fit).rows[0].exercise_name).toBe("Dumbbell Goblet Split Squat");
    expect(withHomeAlternatives(rows, lib).rows[0].exercise_name).toBe("Barbell Back Squat");
  });
});

describe("equipmentSummary and equipmentList", () => {
  it("reads as one line", () => {
    expect(equipmentSummary(item("dumbbells", { count: 2, weight: "10 kg", option: "Fixed weight" }))).toBe("2 x Dumbbells, fixed weight, 10 kg");
    expect(equipmentSummary(item("cardio", { note: "Treadmill" }))).toBe("Treadmill");
    expect(equipmentSummary(item("bench", { option: "Adjustable" }))).toBe("Bench, adjustable");
  });
  it("drops anything that isn't an equipment item", () => {
    expect(equipmentList([item("bands"), { type: "nope", id: "x" }, null, "x"])).toHaveLength(1);
    expect(equipmentList(undefined)).toEqual([]);
  });
});
