// Drop set programs (GRIZZ, 2026-10-16, migration 0099). One exercise done
// as 2 rounds (intermediate) or 3 rounds (advanced). A round is a start weight
// for 4-8 reps to failure, then 6-10 lighter "drops", each to failure. The
// round clock starts when the start weight's reps are logged, pauses while
// the client types the next weight and runs again when they tap Log. The
// round's time is one of the things that tracks their output.

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

/** How many drops after the start weight: fewer on barbell and plate-loaded lifts. */
export function dropRange(exerciseName: string): { min: number; max: number } {
  const n = exerciseName.toLowerCase();
  const heavy = /barbell|smith|leg press|hip thrust|seated calf|plate/.test(n);
  return heavy ? { min: 6, max: 8 } : { min: 8, max: 10 };
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

/** How this round compares with the same round last time. Faster is better. */
export function compareRound(
  now: { seconds: number; totalReps: number },
  last: { seconds: number; totalReps: number } | null | undefined,
): string {
  if (!last) return "First time: this is your time to beat.";
  const diff = now.seconds - last.seconds;
  const time =
    diff === 0
      ? "Same time as last time"
      : diff < 0
        ? `${formatRoundTime(-diff)} faster than last time`
        : `${formatRoundTime(diff)} slower than last time`;
  const repDiff = now.totalReps - last.totalReps;
  const reps = repDiff === 0 ? "same reps" : repDiff > 0 ? `${repDiff} more reps` : `${-repDiff} fewer reps`;
  return `${time}, ${reps}.`;
}
