import { describe, expect, it } from "vitest";
import { exerciseRisks, injuryAreas, riskLine, safeSuggestions } from "./injuryRisk";

const lib = [
  { id: "1", name: "Barbell Back Squat", category: "Quads" },
  { id: "2", name: "Leg Extension", category: "Quads" },
  { id: "3", name: "Bulgarian Split Squat", category: "Quads" },
  { id: "4", name: "Hip Thrust", category: "Glutes" },
  { id: "5", name: "Glute Bridge", category: "Glutes" },
  { id: "6", name: "Seated Leg Curl", category: "Hamstrings" },
  { id: "7", name: "Lying Leg Curl", category: "Hamstrings" },
  { id: "8", name: "Barbell Overhead Press", category: "Overhead Press" },
  { id: "9", name: "Landmine Press", category: "Shoulders" },
  { id: "10", name: "Machine Lateral Raise", category: "Shoulders" },
  { id: "11", name: "Cable External Rotation", category: "Shoulders" },
  { id: "12", name: "Dumbbell Lateral Raise", category: "Shoulders" },
];

describe("injury check", () => {
  it("reads injured areas, ignoring 'none'", () => {
    expect(injuryAreas("None on file")).toEqual([]);
    expect(injuryAreas("none")).toEqual([]);
    expect(injuryAreas("Torn ACL left knee", "Shoulder: sore")).toEqual(["knee", "shoulder"]);
    expect(injuryAreas("bad lower back")).toEqual(["core"]);
  });

  it("flags exercises that load the injured area", () => {
    expect(exerciseRisks({ name: "Barbell Back Squat", category: "Quads" }, ["knee"])[0]).toMatchObject({
      title: "Knee",
      why: "bends the knee under load",
    });
    expect(exerciseRisks({ name: "Box Jump", category: "Plyometrics" }, ["ankle"])).toHaveLength(1);
    expect(exerciseRisks({ name: "Conventional Deadlift", category: "Posterior Chain" }, ["core"])).toHaveLength(1);
    expect(exerciseRisks({ name: "Barbell Overhead Press", category: "Overhead Press" }, ["shoulder"])).toHaveLength(1);
  });

  it("leaves safe exercises alone", () => {
    expect(exerciseRisks({ name: "Seated Leg Curl", category: "Hamstrings" }, ["knee"])).toEqual([]);
    expect(exerciseRisks({ name: "Cable External Rotation", category: "Shoulders" }, ["shoulder"])).toEqual([]);
    expect(exerciseRisks({ name: "Barbell Back Squat", category: "Quads" }, [])).toEqual([]);
  });

  it("names every injury an exercise affects", () => {
    const risks = exerciseRisks({ name: "Barbell Back Squat", category: "Quads" }, ["knee", "core", "neck"]);
    expect(risks.map((r) => r.area)).toEqual(["knee", "core", "neck"]);
    expect(riskLine(risks)).toContain("Knee: bends the knee under load");
  });

  it("suggests 3 safe swaps, moving to nearby body parts when needed", () => {
    const picks = safeSuggestions({ id: "1", name: "Barbell Back Squat", category: "Quads" }, lib, ["knee"]);
    expect(picks).toHaveLength(3);
    for (const p of picks) expect(exerciseRisks(p, ["knee"])).toEqual([]);
    expect(picks.map((p) => p.category)).toEqual(["Glutes", "Glutes", "Hamstrings"]);

    const shoulder = safeSuggestions({ id: "8", name: "Barbell Overhead Press", category: "Overhead Press" }, lib, ["shoulder"]);
    expect(shoulder.map((p) => p.name)).toContain("Landmine Press");
    expect(shoulder).toHaveLength(3);
  });
});
