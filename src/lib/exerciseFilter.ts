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

/** The exercises for the chosen tab. */
export function forPlace<T extends Pick<Exercise, "home_friendly">>(exercises: T[], place: ExercisePlace): T[] {
  return place === "home" ? exercises.filter((e) => e.home_friendly) : exercises;
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
 * used in place of a gym-only one. Same body part, preferring one not already
 * in the session; null when the exercise is fine at home or there's no match.
 */
export function homeAlternative<T extends Pick<Exercise, "id" | "category" | "home_friendly">>(
  exercise: T,
  exercises: T[],
  usedIds: (string | null)[],
): T | null {
  if (exercise.home_friendly) return null;
  const options = forPlace(swapOptions(exercises, exercise.category, [exercise.id]), "home");
  return options.find((e) => !usedIds.includes(e.id)) ?? options[0] ?? null;
}
