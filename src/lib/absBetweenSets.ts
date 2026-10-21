import { heavyLowerOrSpine } from "@/lib/progression";
import { extrasAllowed } from "@/lib/clientExtras";

// Abs between sets (0083, GRIZZ 2026-10-12; 0118): on the upper body, lower
// body, full body, Chest & Bi and Back & Tri workouts the client does 15 reps
// of an ab exercise after each working set, then taps Complete to start the
// rest timer. The trainer can switch it off for a client.
//
// Never after a set of a heavy squat, deadlift, RDL, hip thrust, lunge or
// heavy row: tired trunk muscles right before heavy spine loading change how
// the client lifts, and the abs eat the rest those lifts need. At most
// AB_MAX_ROUNDS ab rounds a session, which is plenty of ab work.

export const AB_REPS = 15;
// Rep choices when a trainer adds abs to their own program.
export const AB_REP_OPTIONS = [10, 15, 20, 25, 30];
export const AB_MAX_ROUNDS = 10;

// No equipment, so they work at home and in a busy gym. No mountain climbers:
// they push the heart rate up and eat into the rest.
export const AB_EXERCISES = [
  "Crunches",
  "Lying leg raises",
  "Bicycle crunches",
  "Reverse crunches",
  "Heel touches",
  "Flutter kicks",
  "Russian twists",
  "Toe touches",
  "Dead bugs",
];

/** Whether abs follow a set of this exercise: not after heavy lower-body or spine-loading lifts. */
export function absAfterExercise(exerciseName: string): boolean {
  return !heavyLowerOrSpine(exerciseName);
}

/** Ab rounds already done today: one after each working set of an exercise that allows them. */
export function abRoundsDone(sets: { warm_up?: boolean | null; exercise_name: string }[]): number {
  return sets.filter((s) => !s.warm_up && absAfterExercise(s.exercise_name)).length;
}

// On when the workout has abs built in, or the trainer turned them on for every
// workout (abs_all, 0136), but never on Longevity, mobility or flexibility
// (extrasAllowed), and never when the trainer switched them off.
export function absBetweenSets(
  program: { abs_between_sets?: boolean | null; name?: string; trainer_id?: string | null } | null | undefined,
  client: { abs_between_sets?: boolean | null; abs_all?: boolean | null } | null | undefined,
): boolean {
  if (!program || client?.abs_between_sets === false) return false;
  if (program.name != null && !extrasAllowed({ name: program.name, trainer_id: program.trainer_id ?? null }).abs) return false;
  return !!program.abs_between_sets || !!client?.abs_all;
}

// The program's chosen ab exercise, or a different one each set, in order,
// starting over after the last.
export function abExerciseFor(setsDoneToday: number, chosen?: string | null): string {
  if (chosen?.trim()) return chosen.trim();
  const i = ((setsDoneToday % AB_EXERCISES.length) + AB_EXERCISES.length) % AB_EXERCISES.length;
  return AB_EXERCISES[i];
}
