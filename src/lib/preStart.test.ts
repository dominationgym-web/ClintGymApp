import { describe, expect, it } from "vitest";
import { BLANK_PRE_START, compareTest, isOlderAdultProgram, preStartOutcome, preStartRisks, reassessDue, type PreStartAnswers } from "@/lib/preStart";
import { programFamily, PROGRAM_FAMILIES } from "@/lib/programs";

const form = (over: Partial<PreStartAnswers>): PreStartAnswers => ({ ...BLANK_PRE_START, activity: "light", ...over });
const titles = (a: PreStartAnswers) => preStartRisks(a).map((r) => `${r.level}: ${r.title}`);

describe("pre-start risk check", () => {
  it("is green with nothing ticked", () => {
    const a = form({ sitToStand: "11", tandemSeconds: "25", singleLegLeft: "12", singleLegRight: "10" });
    expect(preStartRisks(a)).toEqual([]);
    expect(preStartOutcome(a)).toMatchObject({ level: "green", program: "Older Adult 1 - Beginner Foundation" });
  });

  it("stops the start for warning symptoms, unstable conditions and very high blood pressure", () => {
    expect(preStartOutcome(form({ symptoms: ["Chest pain or pressure"] })).level).toBe("red");
    expect(preStartOutcome(form({ unstable: true })).level).toBe("red");
    expect(titles(form({ bpSystolic: "185", bpDiastolic: "95" }))).toEqual(["red: Resting blood pressure 185/95"]);
    expect(titles(form({ bpSystolic: "165", bpDiastolic: "90" }))).toEqual(["amber: Resting blood pressure 165/90"]);
  });

  it("asks for clearance for heart, metabolic or kidney disease in someone not exercising", () => {
    expect(titles(form({ conditions: ["Heart disease"], activity: "none" }))[0]).toMatch(/^red: Heart disease, and not exercising/);
    expect(titles(form({ conditions: ["Heart disease"], activity: "regular" }))).toEqual(["amber: Heart disease"]);
    expect(preStartRisks(form({ conditions: ["Heart disease"], activity: "none", clearance: "received" }))).toEqual([]);
  });

  it("flags falls, fractures and balance by the usual cut-offs", () => {
    expect(titles(form({ falls: "2+" }))).toEqual(["red: 2 or more falls in the last year"]);
    expect(titles(form({ falls: "1" }))).toEqual(["amber: A fall in the last year"]);
    expect(titles(form({ fracture: true }))[0]).toMatch(/^red: Broken bone/);
    expect(titles(form({ sitToStand: "17", tandemSeconds: "6", singleLegLeft: "3", singleLegRight: "8" }))).toEqual([
      "amber: 5 sit-to-stands took 17 s",
      "amber: Tandem stance 6 s",
      "amber: Single-leg stance 3 s",
    ]);
  });

  it("gives medication advice", () => {
    const risks = preStartRisks(form({ medications: ["Heart rate (e.g. beta blockers)", "Blood pressure"] }));
    expect(risks.map((r) => r.title)).toEqual(["Blood pressure medicine", "Heart rate medicine"]);
    expect(risks[1].detail).toMatch(/RPE/);
  });

  it("puts red before amber and suggests Program 2 for active clients who move well", () => {
    const risks = preStartRisks(form({ falls: "1", symptoms: ["Fainting or dizziness"] }));
    expect(risks.map((r) => r.level)).toEqual(["red", "amber"]);
    expect(preStartOutcome(form({ activity: "regular", sitToStand: "10" })).program).toMatch(/^Older Adult 2/);
  });
});

describe("re-tests", () => {
  it("is due 8 weeks later and compares with the first test", () => {
    expect(reassessDue("2026-10-20")).toBe("2026-12-15");
    expect(compareTest("11", "14", "s")).toBe("11 s (was 14 s)");
    expect(compareTest("11", undefined, "s")).toBe("11 s");
    expect(compareTest("", "14", "s")).toBe("");
  });
});

describe("Longevity programs", () => {
  it("sit in their own section", () => {
    for (const name of ["Older Adult 1 - Beginner Foundation", "Older Adult 2 - Strength & Stability", "Older Adult 3 - Functional Strength & Independence"]) {
      expect(isOlderAdultProgram(name)).toBe(true);
      expect(programFamily({ name, trainer_id: null })).toBe("olderAdult");
    }
    expect(PROGRAM_FAMILIES.find((f) => f.key === "olderAdult")?.group).toBe("longevity");
    expect(programFamily({ name: "Beginner Foundation - Strength", trainer_id: null })).toBe("foundation");
  });
});
