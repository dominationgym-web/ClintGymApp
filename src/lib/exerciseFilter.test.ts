import { describe, expect, it } from "vitest";
import { clientBrowsable, exerciseCategories, filterExercises } from "@/lib/exerciseFilter";

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
