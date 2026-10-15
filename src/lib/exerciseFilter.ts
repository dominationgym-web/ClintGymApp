import type { Exercise } from "@/types/database";

// The exercise library has ~400 clips (0040), so lists are searched and
// filtered by body part rather than scrolled.

/** Body parts in library order (the order of the first exercise in each). */
export function exerciseCategories(exercises: Pick<Exercise, "category">[]): string[] {
  const seen: string[] = [];
  for (const e of exercises) if (e.category && !seen.includes(e.category)) seen.push(e.category);
  return seen;
}

/** Exercises matching every search word (in the name or body part) and the chosen body part, if any. */
export function filterExercises<T extends Pick<Exercise, "name" | "category">>(
  exercises: T[],
  search: string,
  category: string | null = null,
): T[] {
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return exercises.filter((e) => {
    if (category && e.category !== category) return false;
    const text = `${e.name} ${e.category ?? ""}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

// Body parts only trainers browse (0041): GRIZZ keeps overhead pressing out
// of his programs, but other trainers can use it.
export const TRAINER_ONLY_CATEGORIES = ["Overhead Press"];

/** The exercises a client browses: trainer-only body parts are hidden unless in their own program. */
export function clientBrowsable<T extends Pick<Exercise, "id" | "category">>(exercises: T[], programExerciseIds: (string | null)[]): T[] {
  return exercises.filter(
    (e) => !e.category || !TRAINER_ONLY_CATEGORIES.includes(e.category) || programExerciseIds.includes(e.id),
  );
}

// Gym and Home tabs (0045): Gym is the whole library, Home only the exercises
// done with dumbbells, a barbell, kettlebells, bands or bodyweight.
export type ExercisePlace = "gym" | "home";

/**
 * A client's own home check (0092, homeFit in src/lib/equipment.ts): which
 * exercises their home equipment list covers. Without one, every
 * home-friendly exercise counts.
 */
export type HomeFit = ((e: Pick<Exercise, "name" | "home_friendly">) => boolean) | null;

/** The exercises for the chosen tab. */
export function forPlace<T extends Pick<Exercise, "name" | "home_friendly">>(
  exercises: T[],
  place: ExercisePlace,
  fit: HomeFit = null,
): T[] {
  if (place !== "home") return exercises;
  return exercises.filter((e) => (fit ? fit(e) : e.home_friendly));
}

// Change exercise (0047): body parts that count as the same for a swap. Must
// match public.swap_group(). Hamstring curls and Romanian deadlifts (Posterior
// Chain) both work the hamstrings; everything else swaps within its category.
export function swapGroup(category: string | null): string | null {
  return category === "Posterior Chain" ? "Hamstrings" : category;
}

/** The exercises a program exercise can be swapped for: same body part, not trainer-only, not itself. */
export function swapOptions<T extends Pick<Exercise, "id" | "category">>(
  exercises: T[],
  category: string | null,
  excludeIds: (string | null)[],
): T[] {
  const group = swapGroup(category);
  if (!group) return [];
  return exercises.filter(
    (e) =>
      swapGroup(e.category) === group &&
      !(e.category && TRAINER_ONLY_CATEGORIES.includes(e.category)) &&
      !excludeIds.includes(e.id),
  );
}

/** "chest", "back", "hamstring": how a body part reads in a sentence. */
export function bodyPartLabel(category: string | null): string {
  const labels: Record<string, string> = { Push: "chest", Pull: "back", Legs: "leg", "Posterior Chain": "hamstring" };
  if (!category) return "similar";
  return labels[category] ?? category.toLowerCase().replace(/s$/, "");
}

/**
 * Home training (0052): for a client who trains at home, the home exercise
 * used in place of a gym-only one (or, with their equipment list, one their
 * equipment doesn't cover). Same body part, preferring one not already
 * in the session; null when the exercise is fine at home or there's no match.
 */
export function homeAlternative<T extends Pick<Exercise, "id" | "name" | "category" | "home_friendly">>(
  exercise: T,
  exercises: T[],
  usedIds: (string | null)[],
  fit: HomeFit = null,
): T | null {
  if (fit ? fit(exercise) : exercise.home_friendly) return null;
  const options = forPlace(swapOptions(exercises, exercise.category, [exercise.id]), "home", fit);
  return options.find((e) => !usedIds.includes(e.id)) ?? options[0] ?? null;
}

/**
 * Home training (0052): a workout with each gym-only exercise replaced by its
 * home alternative, plus the ids brought in, so the same swap shows wherever
 * the workout appears.
 */
export function withHomeAlternatives<
  R extends { kind: string; exercise_id: string | null; exercise_name: string },
  T extends Pick<Exercise, "id" | "name" | "category" | "home_friendly">,
>(rows: R[], exercises: T[], fit: HomeFit = null): { rows: R[]; homeIds: string[] } {
  const homeIds: string[] = [];
  const out = rows.map((row) => {
    const exercise = exercises.find((e) => e.id === row.exercise_id);
    if (row.kind === "cardio" || !exercise) return row;
    const used = [...rows.map((r) => r.exercise_id), ...homeIds];
    const alt = homeAlternative(exercise, exercises, used, fit);
    if (!alt) return row;
    homeIds.push(alt.id);
    return { ...row, exercise_id: alt.id, exercise_name: alt.name };
  });
  return { rows: out, homeIds };
}
