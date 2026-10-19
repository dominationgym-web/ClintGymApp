import { repRange, weightStep, type LoggedSet } from "@/lib/progression";

// The gauge test (GRIZZ, 2026-10-17; 0118 no failure). The trainer isn't there
// to pick a new client's weights, so the first time a client does a weighted
// exercise, their first working set is a gauge set: they pick a weight they
// think they can lift about 6-10 times and do a hard set, stopping when they
// think 1-2 good reps are left or the reps slow down or change shape. It is
// never taken to failure, so it fits the "no failure in the first 6 weeks"
// rule. The app works out the weight for the program's rep range from it.
//
// It adds the reps they had left (GAUGE_RIR, the low end of 1-2 so the
// estimate stays on the safe side) to the reps they did and estimates a
// one-rep max (Epley: weight × (1 + reps ÷ 30)). Epley gets unreliable past
// about 12 reps, so above that the reps are capped at 12 and the result is
// only a rough guess. From the max it works out the weight for the top of the
// rep range plus the reps they should keep in reserve. During the intro
// (their first 6 weeks, 2 for advanced clients, or while on a Foundation
// program) that's 2 reps short of failure; after it, 1.

/** Reps assumed left in the tank at the end of the gauge set. */
export const GAUGE_RIR = 1;
/** Epley is only trusted up to this many reps (done + left). */
export const EPLEY_MAX_REPS = 12;

export const INTRO_DAYS = 42;
/** Advanced clients (review 2026-10-18) know their effort well: a 2-week intro, and none without a plan start. */
export const ADVANCED_INTRO_DAYS = 14;

type Level = "never" | "beginner" | "intermediate" | "advanced" | null | undefined;

/** How many weeks the intro lasts for this training level. */
export function introWeeks(level?: Level): number {
  return (level === "advanced" ? ADVANCED_INTRO_DAYS : INTRO_DAYS) / 7;
}

/**
 * Whether the client is still in their intro: no sets to failure yet. A
 * Foundation program always is. Otherwise the first 6 weeks of their plan
 * (or with no plan start yet), or just the first 2 for an advanced client.
 */
export function inIntro(
  programName: string | null | undefined,
  planStartedAt: string | null | undefined,
  today: string,
  level?: Level,
): boolean {
  if (/foundation/i.test(programName ?? "")) return true;
  const advanced = level === "advanced";
  if (!planStartedAt) return !advanced;
  return (Date.parse(today) - Date.parse(planStartedAt)) / 86_400_000 < (advanced ? ADVANCED_INTRO_DAYS : INTRO_DAYS);
}

/** Reps to keep in reserve on working sets. */
export function repsInReserve(isIntro: boolean): number {
  return isIntro ? 2 : 1;
}

// Bodyweight, band and core moves have no weight to find.
const NO_WEIGHT =
  /bodyweight|body weight|band|stretch|bird dog|dead bug|plank|push[- ]?up|pull[- ]?up|chin[- ]?up|\bdips?\b|nordic|jump|hop|bound|circle|clam|crunch|sit[- ]?up|mountain|burpee|crawl|mobility|rotation|copenhagen|wall /i;

/**
 * Whether this set should be the gauge set: a weighted exercise with a rep
 * range, never done before (no earlier working sets with a weight), and no
 * working set yet today.
 */
export function needsGauge(earlier: LoggedSet[], today: LoggedSet[], reps: string | null | undefined, exerciseName?: string): boolean {
  if (!repRange(reps)) return false;
  if (exerciseName && NO_WEIGHT.test(exerciseName) && !/weighted/i.test(exerciseName)) return false;
  const weighted = (s: LoggedSet) => !s.warm_up && s.weight_kg !== null && s.weight_kg > 0;
  return !earlier.some(weighted) && !today.some((s) => !s.warm_up);
}

/**
 * Estimated one-rep max from a set: the reps done plus the reps left in the
 * tank, capped at EPLEY_MAX_REPS.
 */
export function estimatedMax(weightKg: number, reps: number, repsLeft = 0): number {
  return weightKg * (1 + Math.min(reps + repsLeft, EPLEY_MAX_REPS) / 30);
}

/** Free-weight barbell squats and bench presses, where a failed rep can trap the lifter. */
export function needsSafeties(exerciseName: string): boolean {
  const n = exerciseName.toLowerCase();
  if (/smith|machine|dumbbell|\bdb\b|goblet|kettlebell|leg press|hack/.test(n)) return false;
  return /bench press/.test(n) || (/barbell|back squat|front squat|box squat/.test(n) && /squat|bench/.test(n));
}

/** The safety line for the gauge box and the trainer guide. */
export const SAFETIES_NOTE =
  "On barbell squats and bench press, set the safety pins (or bars) in the rack just below the lowest point of the rep, or have a spotter.";

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
  const max = estimatedMax(gauge.weight, gauge.reps, GAUGE_RIR);
  const raw = max / (1 + (range.high + rir) / 30);
  // Light cables and machines go to the kilo; dumbbells and kettlebells keep their rack steps.
  const step = raw < 10 && !/dumbbell|\bdb\b|kettlebell|\bkb\b/i.test(exercise.name) ? 1 : weightStep(exercise, raw);
  const weight = Math.max(step, Math.floor(raw / step + 1e-9) * step);
  const label = range.low === range.high ? `${range.low}` : `${range.low}-${range.high}`;
  const stop = rir === 2 ? "Stop each set when you could still do 2 more good reps." : "Stop each set when you could still do 1 more good rep.";
  const rough =
    gauge.reps + GAUGE_RIR > EPLEY_MAX_REPS
      ? " That was a lot of reps, so this is only a rough guess: if your sets feel easy, the app moves you up next time."
      : "";
  return {
    weight,
    range: label,
    advice: `${kg(gauge.weight)} × ${gauge.reps} means your working weight is ${kg(weight)} for ${label} reps.${rough} ${stop}`,
  };
}
