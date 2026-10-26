// The daily step goal (0158, GRIZZ, 2026-10-26). The client picks a goal on
// the Check-in tab and the card shows how far they are today. Steps come from
// the linked watch (healthLink.ts) or the client types them in. The server
// sends a reminder at 16:00 if the goal isn't hit yet and where they are at
// 19:00; from 19:00 the card also turns into a banner.
import { addDays } from "@/lib/programSchedule";

export type StepSource = "manual" | "apple_health" | "health_connect";
export type StepDay = { step_date: string; steps: number; goal: number | null; source: StepSource; updated_at: string };

export const STEP_GOAL_CHOICES = [5000, 7500, 10000, 12500, 15000];
export const MIN_STEP_GOAL = 1000;
export const MAX_STEP_GOAL = 50000;
export const EVENING_HOUR = 19;

/** 10000 → "10 000", the way South Africans write it. */
export function formatSteps(n: number): string {
  return String(Math.max(0, Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** What the client typed ("8 500", "8,500", "8500") as a whole number, or null. */
export function parseSteps(text: string): number | null {
  const digits = text.replace(/[\s,.']/g, "");
  if (!/^\d+$/.test(digits)) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n <= 200000 ? n : null;
}

/** A goal the server accepts, or null. */
export function validGoal(n: number | null): number | null {
  return n !== null && n >= MIN_STEP_GOAL && n <= MAX_STEP_GOAL ? n : null;
}

/** About 100 steps a minute walking, rounded up to 5 minutes. */
export function walkMinutes(stepsLeft: number): number {
  if (stepsLeft <= 0) return 0;
  return Math.max(5, Math.ceil(stepsLeft / 100 / 5) * 5);
}

/** How far along the goal is, from 0 to 1. */
export function stepProgress(steps: number, goal: number): number {
  return goal > 0 ? Math.min(1, Math.max(0, steps / goal)) : 0;
}

/** From 19:00 the card says where they are for the day. */
export function isStepEvening(now: Date): boolean {
  return now.getHours() >= EVENING_HOUR;
}

/** One line on where they are today. */
export function stepStatus(steps: number, goal: number): string {
  if (steps >= goal) return `Goal hit! ${formatSteps(steps)} of ${formatSteps(goal)} steps.`;
  const left = goal - steps;
  return `${formatSteps(left)} to go: about ${walkMinutes(left)} minutes of walking.`;
}

/**
 * Days in a row the goal was hit, up to today. Today counts once it's hit; if
 * it isn't yet, the run up to yesterday still stands.
 */
export function stepStreak(days: Pick<StepDay, "step_date" | "steps" | "goal">[], today: string, currentGoal: number | null): number {
  const hit = new Set(
    days.filter((d) => {
      const goal = d.goal ?? currentGoal;
      return goal !== null && d.steps >= goal;
    }).map((d) => d.step_date),
  );
  let day = hit.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (hit.has(day)) {
    n += 1;
    day = addDays(day, -1);
  }
  return n;
}

/**
 * What to save when the watch gives a count. Steps the client typed in are
 * kept if they're higher (the phone may have been left at home), otherwise
 * the watch wins.
 */
export function mergeWatchSteps(existing: Pick<StepDay, "steps" | "source"> | null, watch: number, source: StepSource): { steps: number; source: StepSource } {
  if (existing?.source === "manual" && existing.steps > watch) return { steps: existing.steps, source: "manual" };
  return { steps: Math.max(0, Math.round(watch)), source };
}
