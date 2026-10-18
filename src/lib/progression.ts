import type { SetEffort } from "@/types/database";

// "Try this weight next" (double progression): stay on a weight until every
// working set reaches the top of the program's rep range without going to
// failure, then add the smallest sensible jump and work back up the range.
// It only looks at what the client logged last time for that exercise.

export type LoggedSet = { weight_kg: number | null; reps: number; effort: SetEffort; warm_up?: boolean; gauge?: boolean };

export type Suggestion = {
  /** "Last time: 40kg × 10, 10, 9" */
  last: string;
  /** What to do today, in plain words. */
  advice: string;
  /** The weight to put in the box, if there is one. */
  weight: number | null;
};

/** The rep range from a program row's reps text: "8-10" → 8 to 10. Timed work → null. */
export function repRange(reps: string | null | undefined): { low: number; high: number } | null {
  if (!reps || /sec|min|round|x/i.test(reps)) return null;
  const m = reps.match(/^\s*(\d+)\s*(?:[-–]\s*(\d+))?\s*$/);
  if (!m) return null;
  const low = Number(m[1]);
  const high = m[2] ? Number(m[2]) : low;
  return high >= low && low > 0 ? { low, high } : null;
}

const LOWER_BODY = ["Legs", "Glutes", "Posterior Chain", "Hamstrings", "Quads"];
const BIG_LOWER = /squat|deadlift|leg press|hip thrust|rdl|romanian/i;

/**
 * How much to add, in steps the gym actually has: kettlebells go up 4kg,
 * dumbbells 2kg (2.5kg once they're 10kg or more, where most racks change
 * step), big lower-body barbell or machine lifts 5kg, everything else 2.5kg.
 */
export function weightStep(exercise: { name: string; category: string | null }, currentKg?: number | null): number {
  if (/kettlebell|\bkb\b/i.test(exercise.name)) return 4;
  if (/dumbbell|\bdb\b/i.test(exercise.name)) return currentKg != null && currentKg >= 10 ? 2.5 : 2;
  const lower = exercise.category !== null && LOWER_BODY.includes(exercise.category);
  if (lower && BIG_LOWER.test(exercise.name) && !/single|split|bulgarian|goblet/i.test(exercise.name)) {
    return 5;
  }
  return 2.5;
}

// Heavy squats, hinges, lunges and rows load the spine or the legs hard, so
// they get no ab work between sets (abs between sets) and keep a proper rest
// even on the "Faster" pace.
const HEAVY_LOWER_OR_SPINE =
  /squat|deadlift|\brdl\b|romanian|good morning|hip thrust|lunge|step[- ]?up|leg press|clean|snatch|bent[- ]over row|barbell row|pendlay|t[- ]bar row|trap bar|hex bar/i;
const LIGHT = /bodyweight|air squat|jump|wall sit|sissy|banded|band /i;

/** Heavy lower-body or spine-loading lifts: squats, deadlifts, RDLs, hip thrusts, lunges, heavy rows. */
export function heavyLowerOrSpine(name: string): boolean {
  return HEAVY_LOWER_OR_SPINE.test(name) && !LIGHT.test(name);
}

/** Heavy compound lifts: the ones above plus barbell bench and overhead pressing. */
export function heavyCompound(name: string): boolean {
  return heavyLowerOrSpine(name) || (/barbell|smith|bench press|military|push press/i.test(name) && /press/i.test(name));
}

const kg = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}kg`;

/** The suggestion for today from last session's sets, or null when there's nothing to go on. */
export function suggestNext(
  lastSets: LoggedSet[],
  reps: string | null | undefined,
  exercise: { name: string; category: string | null },
): Suggestion | null {
  // The gauge set (src/lib/gauge.ts) only found the weight; the sets after it count.
  const weighted = lastSets.filter((s) => !s.warm_up && !s.gauge && s.weight_kg !== null && s.weight_kg > 0);
  if (weighted.length === 0) return null;
  const top = Math.max(...weighted.map((s) => s.weight_kg as number));
  const working = weighted.filter((s) => s.weight_kg === top);
  const last = `Last time: ${kg(top)} × ${working.map((s) => s.reps).join(", ")}`;
  const range = repRange(reps);
  const failed = working.some((s) => s.effort === "failure");
  const step = weightStep(exercise, top);

  if (range) {
    if (working.every((s) => s.reps >= range.high) && !failed) {
      return { last, advice: `Try ${kg(top + step)} and aim for ${range.low}+ reps.`, weight: top + step };
    }
    if (working.some((s) => s.reps < range.low)) {
      return { last, advice: `Stay at ${kg(top)} and aim for ${range.low}-${range.high} reps on every set.`, weight: top };
    }
    return { last, advice: `Stay at ${kg(top)} and beat last time by a rep.`, weight: top };
  }
  if (working.every((s) => s.effort === "comfortable")) {
    return { last, advice: `That felt comfortable. Try ${kg(top + step)}.`, weight: top + step };
  }
  return { last, advice: `Stay at ${kg(top)} and beat last time by a rep.`, weight: top };
}
