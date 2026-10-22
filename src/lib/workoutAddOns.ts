import { absBetweenSets } from "@/lib/absBetweenSets";
import { cardioFor } from "@/lib/clientExtras";
import { cardioLabel } from "@/lib/programs";
import type { ExtraCardio, Program } from "@/types/database";

// What a client gets on top of a workout: abs between sets and the cardio
// their trainer added (0083, 0136). Shown on each day of the trainer's
// calendar, so they don't open every session to check (GRIZZ, 2026-10-22).

export type AddOnClient = { abs_between_sets?: boolean | null; abs_all?: boolean | null; extra_cardio?: ExtraCardio[] | null };

/** "💪 Abs between sets · 🔥 Assault bike · 5 min at the end", or "" when there's nothing extra. */
export function workoutAddOns(
  program: Pick<Program, "name" | "trainer_id" | "abs_between_sets">,
  client: AddOnClient | null | undefined,
): string {
  const parts: string[] = [];
  if (absBetweenSets(program, client)) parts.push("💪 Abs between sets");
  for (const c of cardioFor(program, client?.extra_cardio)) {
    parts.push(`🔥 ${cardioLabel({ exercise_name: c.name, reps: c.reps })} ${c.after == null ? "at the end" : `after exercise ${c.after}`}`);
  }
  return parts.join(" · ");
}
