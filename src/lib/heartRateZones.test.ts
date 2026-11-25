import { describe, expect, it } from "vitest";
import {
  EMPTY_TALLY,
  addSecond,
  buildZones,
  clock,
  fatPerMinute,
  kcalPerMinute,
  maxHeartRate,
  restingFromSamples,
  zoneForGoal,
  zoneHint,
  zoneOf,
  type HrInputs,
} from "@/lib/heartRateZones";

const thabo: HrInputs = { weightKg: 108, age: 35, sex: "male", fitness: "trained", exercise: "walk", restingHr: 62 };

describe("heart rate zones", () => {
  it("works out max heart rate from age, a little lower on a bike", () => {
    expect(maxHeartRate(35, "walk")).toBe(184);
    expect(maxHeartRate(35, "bike")).toBe(179);
  });

  it("makes five touching zones from resting up to max", () => {
    const z = buildZones(thabo);
    expect(z.map((x) => x.key)).toEqual(["recover", "fat", "fitness", "calories", "speed"]);
    expect(z[0].low).toBe(123);
    expect(z[4].high).toBe(184);
    for (let i = 1; i < z.length; i++) expect(z[i].low).toBe(z[i - 1].high);
    expect([z[1].low, z[1].high]).toEqual([139, 151]);
  });

  it("puts the fat-burning zone higher for fitter people", () => {
    const beginner = buildZones({ ...thabo, fitness: "beginner" })[1];
    const trained = buildZones(thabo)[1];
    expect(beginner.low).toBeLessThan(trained.low);
  });

  it("burns the most fat in the fat zone and the most calories in the calorie zone", () => {
    for (const fitness of ["beginner", "average", "trained"] as const)
      for (const sex of ["male", "female"] as const) {
        const z = buildZones({ ...thabo, fitness, sex, weightKg: sex === "male" ? 90 : 65 });
        const fat = z.map((x) => x.fat30 ?? -1);
        const kcal = z.map((x) => x.kcal30 ?? -1);
        expect(Math.max(...fat)).toBe(z[1].fat30);
        expect(Math.max(...kcal)).toBe(z[3].kcal30);
        expect(z[4].kcal30).toBeNull();
      }
  });

  it("never counts more fat than the calories allow", () => {
    for (let hr = 60; hr <= 190; hr += 5) expect(fatPerMinute(hr, thabo) * 9).toBeLessThanOrEqual(kcalPerMinute(hr, thabo) + 1e-9);
  });

  it("says speed up, hold or ease off", () => {
    const target = zoneForGoal(buildZones(thabo), "fat");
    expect(zoneHint(target, 130)).toEqual({ kind: "below", beats: 9 });
    expect(zoneHint(target, 145)).toEqual({ kind: "in" });
    expect(zoneHint(target, 157)).toEqual({ kind: "above", beats: 6 });
  });

  it("finds the zone a heart rate is in", () => {
    const z = buildZones(thabo);
    expect(zoneOf(z, 90).key).toBe("recover");
    expect(zoneOf(z, 165).key).toBe("calories");
    expect(zoneOf(z, 200).key).toBe("speed");
  });

  it("adds up time in the zone, calories and fat", () => {
    const target = zoneForGoal(buildZones(thabo), "fat");
    let t = EMPTY_TALLY;
    for (let i = 0; i < 60; i++) t = addSecond(t, 145, thabo, target);
    for (let i = 0; i < 30; i++) t = addSecond(t, 120, thabo, target);
    expect(t.seconds).toBe(90);
    expect(t.inZoneSeconds).toBe(60);
    expect(t.kcal).toBeGreaterThan(15);
    expect(t.fatG).toBeGreaterThan(0.5);
  });

  it("reads resting heart rate from a minute sitting still", () => {
    const samples = [...Array(20).fill(70), ...Array(25).fill(61), ...Array(15).fill(66)];
    expect(restingFromSamples(samples)).toBe(61);
    expect(restingFromSamples([60, 61])).toBeNull();
  });

  it("shows a clock", () => {
    expect(clock(65)).toBe("01:05");
    expect(clock(3725)).toBe("1:02:05");
  });
});

describe("strap readings", () => {
  it("reads one-byte and two-byte heart rates", async () => {
    const { parseHeartRate, parseHeartRateBase64 } = await import("@/lib/heartRateMeasurement");
    expect(parseHeartRate(new Uint8Array([0x00, 141]))).toBe(141);
    expect(parseHeartRate(new Uint8Array([0x01, 0x2c, 0x00]))).toBe(44);
    expect(parseHeartRate(new Uint8Array([0x16, 72, 1, 2]))).toBe(72);
    expect(parseHeartRate(new Uint8Array([0x00, 0]))).toBeNull();
    expect(parseHeartRateBase64("AI0=")).toBe(141);
    expect(parseHeartRateBase64(null)).toBeNull();
  });
});

describe("saved zones", () => {
  it("needs every detail", async () => {
    const { inputsFromSaved } = await import("@/lib/heartRateZones");
    const row = { weight_kg: "108.0", age: 35, sex: "male" as const, fitness: "trained" as const, exercise: "walk" as const, resting_hr: 62 };
    expect(inputsFromSaved(row)).toEqual(thabo);
    expect(inputsFromSaved({ ...row, resting_hr: null })).toBeNull();
  });
});
