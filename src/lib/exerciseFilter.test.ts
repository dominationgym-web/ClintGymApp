import { describe, expect, it } from "vitest";
import { clientBrowsable, exerciseCategories, filterExercises, forPlace, swapOptions } from "@/lib/exerciseFilter";

const list = [
  { name: "Bench Press", category: "Push" },
  { name: "Dumbbell Hammer Curl", category: "Biceps" },
  { name: "Cable Rope Hammer Curl", category: "Biceps" },
  { name: "Lat Pulldown", category: "Pull" },
  { name: "Mystery", category: null },
];

describe("exerciseCategories", () => {
  it("lists each body part once, in library order", () => {
    expect(exerciseCategories(list)).toEqual(["Push", "Biceps", "Pull"]);
  });
});

describe("filterExercises", () => {
  it("returns everything with no search or body part", () => {
    expect(filterExercises(list, "  ")).toHaveLength(5);
  });
  it("matches every word, in any order, ignoring case", () => {
    expect(filterExercises(list, "curl HAMMER cable").map((e) => e.name)).toEqual(["Cable Rope Hammer Curl"]);
    expect(filterExercises(list, "biceps")).toHaveLength(2);
  });
  it("narrows to one body part", () => {
    expect(filterExercises(list, "", "Pull").map((e) => e.name)).toEqual(["Lat Pulldown"]);
    expect(filterExercises(list, "press", "Biceps")).toEqual([]);
  });
});

describe("clientBrowsable", () => {
  const all = [
    { id: "a", category: "Push" },
    { id: "b", category: "Overhead Press" },
    { id: "c", category: "Overhead Press" },
  ];
  it("hides overhead pressing unless it's in the client's program", () => {
    expect(clientBrowsable(all, []).map((e) => e.id)).toEqual(["a"]);
    expect(clientBrowsable(all, ["c", null]).map((e) => e.id)).toEqual(["a", "c"]);
  });
});

describe("forPlace", () => {
  const places = [
    { name: "Leg Press", home_friendly: false },
    { name: "Goblet Squat", home_friendly: true },
  ];
  it("shows the whole library on the Gym tab", () => {
    expect(forPlace(places, "gym")).toHaveLength(2);
  });
  it("shows only no-machine exercises on the Home tab", () => {
    expect(forPlace(places, "home").map((e) => e.name)).toEqual(["Goblet Squat"]);
  });
});

describe("swapOptions", () => {
  const lib = [
    { id: "1", category: "Push" },
    { id: "2", category: "Push" },
    { id: "3", category: "Biceps" },
    { id: "4", category: "Hamstrings" },
    { id: "5", category: "Posterior Chain" },
    { id: "6", category: "Overhead Press" },
  ];
  it("offers only the same body part, without the current exercise", () => {
    expect(swapOptions(lib, "Push", ["1"]).map((e) => e.id)).toEqual(["2"]);
  });
  it("treats Romanian deadlifts and leg curls as the same body part", () => {
    expect(swapOptions(lib, "Hamstrings", ["4"]).map((e) => e.id)).toEqual(["5"]);
    expect(swapOptions(lib, "Posterior Chain", []).map((e) => e.id)).toEqual(["4", "5"]);
  });
  it("never offers trainer-only exercises or anything for an unknown body part", () => {
    expect(swapOptions(lib, "Overhead Press", [])).toEqual([]);
    expect(swapOptions(lib, null, [])).toEqual([]);
  });
});
