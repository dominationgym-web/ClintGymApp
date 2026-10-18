// Drop set programs (GRIZZ, 2026-10-16, migration 0099; dosing 0118). One
// exercise done as 2 rounds (intermediate) or 3 rounds (advanced). A round is
// a start weight for about 8-12 reps, then 4-6 lighter "drops" (GRIZZ's
// choice, 2026-10-18) of about 10-15% each, so the last one is roughly half
// the start weight. Each drop stops 1 rep short and only the last may go to
// failure. Smith squats, hack squats and leg presses stop every drop 1-2 reps
// short, never at failure under a loaded bar or sled. The round clock
// starts when the start weight's reps are logged, pauses while the client
// types the next weight and runs again when they tap Log. Total reps at the
// same start weight is what tracks their output; the time is only shown.

import type { Client } from "@/types/database";

/** Recovery between rounds: 6 minutes, since drop sets are very tiring. */
export const DROP_SET_REST_SECONDS = 360;

export function isDropSetProgram(program: { name: string; trainer_id: string | null } | null | undefined): boolean {
  return !!program && !program.trainer_id && program.name.toLowerCase().startsWith("drop set");
}

/** 3 rounds for advanced lifters, 2 for everyone else. */
export function roundsForLevel(level: Client["training_level"] | undefined): number {
  return level === "advanced" ? 3 : 2;
}

/** Drop sets are meant for intermediate and advanced lifters. */
export function needsLevelNote(level: Client["training_level"] | undefined): boolean {
  return level !== "intermediate" && level !== "advanced";
}

export type DropPlan = { min: number; max: number; toFailure: boolean };

/** How many drops after the start weight, and whether they go to failure. */
export function dropRange(exerciseName: string): DropPlan {
  const n = exerciseName.toLowerCase();
  if (/smith.*squat|squat.*smith|leg press|hack squat/.test(n)) return { min: 4, max: 6, toFailure: false };
  return { min: 4, max: 6, toFailure: true };
}

/** The one-line plan under the exercise name. */
export function dropPlanText(rounds: number, plan: DropPlan): string {
  const effort = plan.toFailure ? "each 1 rep short, only the last to failure" : "each stopped 1-2 reps short, never to failure";
  return `${rounds} rounds · start weight 8-12 reps, then ${plan.min}-${plan.max} drops of about 10-15%, ${effort} · rest 5 to 6 min between rounds`;
}

// The round clock: time adds up only while it runs.
export type RoundClock = { totalMs: number; since: number | null };

export const newClock = (): RoundClock => ({ totalMs: 0, since: null });

export function startClock(c: RoundClock, now: number): RoundClock {
  return c.since != null ? c : { ...c, since: now };
}

export function pauseClock(c: RoundClock, now: number): RoundClock {
  return c.since == null ? c : { totalMs: c.totalMs + Math.max(0, now - c.since), since: null };
}

export function clockSeconds(c: RoundClock, now: number): number {
  const ms = c.totalMs + (c.since != null ? Math.max(0, now - c.since) : 0);
  return Math.floor(ms / 1000);
}

/** "1:05". */
export function formatRoundTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** How this round compares with the same round last time: total reps is what counts. */
export function compareRound(
  now: { seconds: number; totalReps: number },
  last: { seconds: number; totalReps: number } | null | undefined,
): string {
  if (!last) return "First time: your total reps are the number to beat.";
  const repDiff = now.totalReps - last.totalReps;
  return repDiff === 0
    ? "Same total reps as last time."
    : repDiff > 0
      ? `${repDiff} more reps than last time.`
      : `${-repDiff} fewer reps than last time.`;
}
