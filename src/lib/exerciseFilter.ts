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
