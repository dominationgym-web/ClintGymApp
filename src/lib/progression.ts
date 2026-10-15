import type { SetEffort } from "@/types/database";

// "Try this weight next" (double progression): stay on a weight until every
// working set reaches the top of the program's rep range without going to
// failure, then add the smallest sensible jump and work back up the range.
// It only looks at what the client logged last time for that exercise.

export type LoggedSet = { weight_kg: number | null; reps: number; effort: SetEffort; warm_up?: boolean };

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

/** How much to add: 5kg on big lower-body barbell or machine lifts, 2.5kg everywhere else. */
export function weightStep(exercise: { name: string; category: string | null }): number {
  const lower = exercise.category !== null && LOWER_BODY.includes(exercise.category);
  if (lower && BIG_LOWER.test(exercise.name) && !/dumbbell|db|kettlebell|single|split|bulgarian|goblet/i.test(exercise.name)) {
    return 5;
  }
  return 2.5;
}

const kg = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}kg`;

/** The suggestion for today from last session's sets, or null when there's nothing to go on. */
export function suggestNext(
  lastSets: LoggedSet[],
  reps: string | null | undefined,
  exercise: { name: string; category: string | null },
): Suggestion | null {
  const weighted = lastSets.filter((s) => !s.warm_up && s.weight_kg !== null && s.weight_kg > 0);
  if (weighted.length === 0) return null;
  const top = Math.max(...weighted.map((s) => s.weight_kg as number));
  const working = weighted.filter((s) => s.weight_kg === top);
  const last = `Last time: ${kg(top)} × ${working.map((s) => s.reps).join(", ")}`;
  const range = repRange(reps);
  const failed = working.some((s) => s.effort === "failure");
  const step = weightStep(exercise);

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
