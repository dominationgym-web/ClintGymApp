// Abs between sets (0083, GRIZZ 2026-10-12): on the upper body, lower body,
// full body, Chest & Bi and Back & Tri workouts the client does 20 reps of an
// ab exercise after each working set, then taps Complete to start the rest
// timer. The trainer can switch it off for a client.

export const AB_REPS = 20;
// Rep choices when a trainer adds abs to their own program.
export const AB_REP_OPTIONS = [10, 15, 20, 25, 30];

// No equipment, so they work at home and in a busy gym.
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
  "Mountain climbers",
];

export function absBetweenSets(
  program: { abs_between_sets?: boolean | null } | null | undefined,
  client: { abs_between_sets?: boolean | null } | null | undefined,
): boolean {
  return !!program?.abs_between_sets && client?.abs_between_sets !== false;
}

// The program's chosen ab exercise, or a different one each set, in order,
// starting over after the last.
export function abExerciseFor(setsDoneToday: number, chosen?: string | null): string {
  if (chosen?.trim()) return chosen.trim();
  const i = ((setsDoneToday % AB_EXERCISES.length) + AB_EXERCISES.length) % AB_EXERCISES.length;
  return AB_EXERCISES[i];
}
