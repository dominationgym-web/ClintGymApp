import { programFamily, withExtraCardio } from "@/lib/programs";
import type { ExtraCardio, Program, ProgramExercise } from "@/types/database";

// Abs and cardio a trainer adds for one client (GRIZZ, 2026-10-21: "between
// any and all workouts except the longevity and bodybuilding. Can just add
// abs for bodybuilding. As well as a cardio option at the end."; 0136):
// - Longevity (60+): neither, they're built for older adults as they are.
// - Mobility and flexibility: neither, they're not that kind of session.
// - Bodybuilding: abs, and cardio at the end only, so nothing cuts into the rest between sets.
// - Everything else: abs, and cardio between exercises and at the end.

type Named = Pick<Program, "name" | "trainer_id">;

export function extrasAllowed(program: Named): { abs: boolean; cardioBetween: boolean; cardioEnd: boolean } {
  const family = programFamily(program);
  if (family === "olderAdult" || family === "sportsMobility" || family === "sportsFlexibility") {
    return { abs: false, cardioBetween: false, cardioEnd: false };
  }
  const bodybuilding = program.name.toLowerCase().includes("bodybuilding");
  return { abs: true, cardioBetween: !bodybuilding, cardioEnd: true };
}

/** The client's extra cardio this workout takes. */
export function cardioFor(program: Named, extras: ExtraCardio[] | null | undefined): ExtraCardio[] {
  const allowed = extrasAllowed(program);
  return (extras ?? []).filter((e) => (e.after == null ? allowed.cardioEnd : allowed.cardioBetween));
}

/** A calendar workout's exercises with the client's extra cardio slotted in. */
export function withClientCardio(program: Named, rows: ProgramExercise[], extras: ExtraCardio[] | null | undefined): ProgramExercise[] {
  return withExtraCardio(rows, cardioFor(program, extras));
}
