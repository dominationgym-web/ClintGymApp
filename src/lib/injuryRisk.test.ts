import { describe, expect, it } from "vitest";
import { checkRisks, exerciseKey, exerciseRisks, injuryAreas, keepCovers, riskLine, safeSuggestions } from "./injuryRisk";

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
      level: "check",
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

  it("only notes the exercises the rehab programs prescribe", () => {
    for (const [name, area] of [
      ["Dumbbell Step-Up", "knee"],
      ["Bulgarian Split Squat", "knee"],
      ["Wall Sit", "knee"],
      ["Back Extension", "core"],
      ["Farmer Carry", "core"],
      ["Suitcase Carry", "core"],
      ["Cable Wood Chop", "core"],
    ] as const) {
      const risks = exerciseRisks({ name, category: null }, [area]);
      expect(risks).toHaveLength(1);
      expect(risks[0].level).toBe("note");
      expect(checkRisks(risks)).toEqual([]);
    }
    // Still worth a check elsewhere: a deadlift for a sore back.
    expect(checkRisks(exerciseRisks({ name: "Conventional Deadlift", category: null }, ["core"]))).toHaveLength(1);
  });

  it("matches a kept exercise only for the areas it was kept for", () => {
    const risks = exerciseRisks({ name: "Barbell Back Squat", category: "Quads" }, ["knee", "core"]);
    expect(keepCovers({ areas: ["knee", "core"] }, risks)).toBe(true);
    expect(keepCovers({ areas: ["knee"] }, risks)).toBe(false);
    expect(keepCovers(undefined, risks)).toBe(false);
    expect(exerciseKey({ exercise_id: null, name: "Box Squat" })).toBe("box squat");
    expect(exerciseKey({ exercise_id: "abc", name: "Box Squat" })).toBe("abc");
  });

  it("names every injury an exercise affects", () => {
    const risks = exerciseRisks({ name: "Barbell Back Squat", category: "Quads" }, ["knee", "core", "neck"]);
    expect(risks.map((r) => r.area)).toEqual(["knee", "core", "neck"]);
    expect(riskLine(risks)).toContain("Knee: bends the knee under load");
  });

  it("suggests 3 safe swaps, moving to nearby body parts when needed", () => {
    const picks = safeSuggestions({ id: "1", name: "Barbell Back Squat", category: "Quads" }, lib, ["knee"]);
    expect(picks).toHaveLength(3);
    for (const p of picks) expect(checkRisks(exerciseRisks(p, ["knee"]))).toEqual([]);
    // The split squat is a rehab move (just a note), so it can be offered.
    expect(picks.map((p) => p.name)).toContain("Bulgarian Split Squat");

    const shoulder = safeSuggestions({ id: "8", name: "Barbell Overhead Press", category: "Overhead Press" }, lib, ["shoulder"]);
    expect(shoulder.map((p) => p.name)).toContain("Landmine Press");
    expect(shoulder).toHaveLength(3);
  });
});
