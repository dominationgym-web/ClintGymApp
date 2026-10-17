import { repRange, weightStep, type LoggedSet } from "@/lib/progression";

// The gauge test (GRIZZ, 2026-10-17). The trainer isn't there to pick a new
// client's weights, so the first time a client does a weighted exercise, their
// first working set is a gauge set: they pick a weight they think they can
// lift, do as many good reps as they can (to failure), and the app works out
// the weight for the program's rep range from that.
//
// From the weight and reps to failure it estimates a one-rep max (Epley:
// weight × (1 + reps ÷ 30), accurate enough up to about 12-15 reps), then
// the weight they could lift for the top of the rep range plus the reps they
// should keep in reserve. During the intro (their first 6 weeks, or while on
// a Foundation program) that's 2 reps short of failure; after it, 1.

export const INTRO_DAYS = 42;
const intro = (programName: string | null | undefined, planStartedAt: string | null | undefined, today: string) =>
  /foundation/i.test(programName ?? "") ||
  !planStartedAt ||
  (Date.parse(today) - Date.parse(planStartedAt)) / 86_400_000 < INTRO_DAYS;

/** Whether the client is still in their intro: no sets to failure yet, except the gauge set. */
export function inIntro(programName: string | null | undefined, planStartedAt: string | null | undefined, today: string): boolean {
  return intro(programName, planStartedAt, today);
}

/** Reps to keep in reserve on working sets. */
export function repsInReserve(isIntro: boolean): number {
  return isIntro ? 2 : 1;
}

/**
 * Whether this set should be the gauge set: a weighted exercise with a rep
 * range, never done before (no earlier working sets with a weight), and no
 * working set yet today.
 */
export function needsGauge(earlier: LoggedSet[], today: LoggedSet[], reps: string | null | undefined): boolean {
  if (!repRange(reps)) return false;
  const weighted = (s: LoggedSet) => !s.warm_up && s.weight_kg !== null && s.weight_kg > 0;
  return !earlier.some(weighted) && !today.some((s) => !s.warm_up);
}

/** Estimated one-rep max from a set taken to failure. */
export function estimatedMax(weightKg: number, repsToFailure: number): number {
  return weightKg * (1 + repsToFailure / 30);
}

export type GaugeResult = {
  /** The weight to use for the rest of the sets. */
  weight: number;
  /** "8-10" */
  range: string;
  /** What to tell the client, in plain words. */
  advice: string;
};

const kg = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}kg`;

/** The working weight from the gauge set, rounded down to a weight they can load. */
export function gaugeWeight(
  gauge: { weight: number; reps: number },
  reps: string | null | undefined,
  exercise: { name: string; category: string | null },
  isIntro: boolean,
): GaugeResult | null {
  const range = repRange(reps);
  if (!range || !(gauge.weight > 0) || !(gauge.reps > 0)) return null;
  const rir = repsInReserve(isIntro);
  const max = estimatedMax(gauge.weight, gauge.reps);
  const raw = max / (1 + (range.high + rir) / 30);
  const step = raw < 10 ? 1 : weightStep(exercise);
  const weight = Math.max(step, Math.floor(raw / step) * step);
  const label = range.low === range.high ? `${range.low}` : `${range.low}-${range.high}`;
  const stop = rir === 2 ? "Stop each set when you could still do 2 more good reps." : "Stop each set when you could still do 1 more good rep.";
  return {
    weight,
    range: label,
    advice: `${kg(gauge.weight)} × ${gauge.reps} to failure means your working weight is ${kg(weight)} for ${label} reps. ${stop}`,
  };
}
