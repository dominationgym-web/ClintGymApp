import type { SetEffort } from "@/types/database";

// "Try this weight next" (double progression): stay on a weight until every
// working set reaches the top of the program's rep range without going to
// failure, then add the smallest sensible jump and work back up the range.
// It only looks at what the client logged last time for that exercise.
//
// Review 2026-10-18: a jump is never more than about 10% of the weight
// (MAX_JUMP). When the next weight the gym has is a bigger jump (light
// dumbbells, kettlebells), the client adds reps first: 2 above the range,
// then goes up. And when the program's rep range changes from one week to
// the next (5-6 to 3-5, 6-8 to 10-12), the reps last time no longer fit, so
// the weight is worked out again from their estimated max for the new range.

export type LoggedSet = { weight_kg: number | null; reps: number; effort: SetEffort; warm_up?: boolean; gauge?: boolean };

export type Suggestion = {
  /** "Last time: 40kg × 10, 10, 9" */
  last: string;
  /** What to do today, in plain words. */
  advice: string;
  /** The weight to put in the box, if there is one. */
  weight: number | null;
};

// Words after the number that mean it isn't a rep count (timed work, distances,
// intervals, runs) or isn't a set to build weight on (jumps, throws, holds).
const NOT_REPS = /^(sec|s\b|min|m\b|x\b|runs?\b|rounds?\b)/i;
const NOT_STRENGTH = /explosive|fast|max|jump|throw|slam|step (down|off)|stick|bounce|hold|circle|each way|then straight|then the/i;

/**
 * The rep range from a program row's reps text: "8-10" → 8 to 10, and the
 * leading numbers of "12-15 each side", "10 each leg" or "4-6 slow" too.
 * Timed work, distances, intervals and jumps or throws → null.
 */
export function repRange(reps: string | null | undefined): { low: number; high: number } | null {
  if (!reps) return null;
  const m = reps.match(/^\s*(\d+)\s*(?:[-–]\s*(\d+))?\s*(.*)$/);
  if (!m) return null;
  const rest = m[3].trim();
  if (NOT_REPS.test(rest) || NOT_STRENGTH.test(rest)) return null;
  // Anything else after the number has to start like words ("each side", ", slow"), not more numbers.
  if (rest && !/^(,|reps?\b|each|per|a side|[a-z])/i.test(rest)) return null;
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

/** The biggest jump at once: about 10% (12.5% so a 20kg dumbbell can still go to 22.5kg). */
export const MAX_JUMP = 0.125;

/** Reps the client had left, from how the set felt (3+ left, 1-2 left, none). */
export function repsLeftFor(effort: SetEffort): number {
  return effort === "failure" ? 0 : effort === "close_to_failure" ? 1 : 3;
}

// Effort, logged as reps left (review 2026-10-18: "How many more good reps
// could you have done?"). The saved values stay the same, so older sets and
// the deload and achievement checks read them as before.
export const EFFORT_OPTIONS: { key: SetEffort; label: string }[] = [
  { key: "failure", label: "0 (failure)" },
  { key: "close_to_failure", label: "1-2 left" },
  { key: "comfortable", label: "3+ left" },
];
export const EFFORT_LABEL: Record<SetEffort, string> = {
  failure: "0 reps left (failure)",
  close_to_failure: "1-2 reps left",
  comfortable: "3+ reps left",
};
export const EFFORT_QUESTION = "How many more good reps could you have done?";

/** The suggestion for today from last session's sets, or null when there's nothing to go on. */
export function suggestNext(
  lastSets: LoggedSet[],
  reps: string | null | undefined,
  exercise: { name: string; category: string | null },
  repsInReserve = 1,
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
  const bigJump = step > top * MAX_JUMP + 1e-9;
  const minReps = Math.min(...working.map((s) => s.reps));
  const maxReps = Math.max(...working.map((s) => s.reps));

  if (range) {
    const label = `${range.low}-${range.high}`;
    // From the best set: Epley, with the reps they had left (estimatedMax in gauge.ts).
    const best = working.reduce((a, b) => (b.reps > a.reps ? b : a));
    const max = top * (1 + Math.min(best.reps + repsLeftFor(best.effort), 12) / 30);
    const forRange = max / (1 + (range.high + repsInReserve) / 30);
    const roundDown = (w: number) => Math.floor(w / step + 1e-9) * step;
    // Well above the range (2+ reps over on every set): a new, lower rep range
    // this week, or they've added reps first. Go up, by at least one step but
    // no more than about 10% unless one step is already more.
    if (minReps >= range.high + 2 && !failed) {
      const up = Math.max(top + step, Math.min(roundDown(forRange), roundDown(top * (1 + MAX_JUMP))));
      return { last, advice: `You did more reps than the ${label} range. Try ${kg(up)} and aim for ${range.low}+ reps.`, weight: up };
    }
    // Well below the range (2+ reps under on every set): a new, higher rep
    // range this week, or the weight was too heavy. Go lighter for the new range.
    if (maxReps <= range.low - 2) {
      const down = roundDown(forRange);
      if (down > 0 && down < top) {
        return { last, advice: `Go down to ${kg(down)} so you can do ${label} reps on every set.`, weight: down };
      }
    }
    if (working.every((s) => s.reps >= range.high) && !failed) {
      if (bigJump) {
        return {
          last,
          advice: `Stay at ${kg(top)} and add reps first: when every set gets ${range.high + 2} reps, go up to ${kg(top + step)}.`,
          weight: top,
        };
      }
      return { last, advice: `Try ${kg(top + step)} and aim for ${range.low}+ reps.`, weight: top + step };
    }
    if (working.some((s) => s.reps < range.low)) {
      return { last, advice: `Stay at ${kg(top)} and aim for ${label} reps on every set.`, weight: top };
    }
    return { last, advice: `Stay at ${kg(top)} and beat last time by a rep.`, weight: top };
  }
  if (working.every((s) => s.effort === "comfortable")) {
    if (bigJump) {
      return { last, advice: `That felt comfortable. Add a rep or two before going up to ${kg(top + step)}.`, weight: top };
    }
    return { last, advice: `That felt comfortable. Try ${kg(top + step)}.`, weight: top + step };
  }
  return { last, advice: `Stay at ${kg(top)} and beat last time by a rep.`, weight: top };
}
