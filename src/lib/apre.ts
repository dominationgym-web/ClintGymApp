import { weightStep, type LoggedSet, type Suggestion } from "@/lib/progression";

// APRE Program (GRIZZ, 2026-10-26, from coach Danny Williams' approach):
// Autoregulating Progressive Resistance Exercise. The weight follows what the
// client can actually do on the day instead of a fixed plan.
// - Your 7-rep weight: one you think you can lift about 7 times.
// - Set 1: 10-12 reps at 50% of it, rest 1 minute.
// - Set 2: 8-10 reps at 75%, rest 2 minutes.
// - Set 3: the 7-rep weight for as many clean reps as you can.
// - Set 4 (from week 9): a second all-out set, the weight moved by set 3's reps.
// Next session: 7 or more reps on the last all-out set → 5% more; 5 or 6 →
// the same; under 5 → the same once, 5% less if it happens two sessions in a
// row. Program rows say so in their reps text: "APRE: 10-12, 8-10, 7+".

export const APRE_TARGET_REPS = 7;
export const APRE_CHANGE = 0.05;

/** A program row run the APRE way. */
export function isApre(reps: string | null | undefined): boolean {
  return !!reps && /^\s*APRE\b/i.test(reps);
}

type Exercise = { name: string; category: string | null };
export type ApreSet = LoggedSet & { set_number: number };

function roundTo(weight: number, step: number): number {
  return Math.max(step, Math.round(weight / step) * step);
}

const kg = (w: number) => `${Number.isInteger(w) ? w : w.toFixed(1).replace(/\.0$/, "")}kg`;

/** 5% more, at least one step of the gym's weights. */
function up(weight: number, ex: Exercise): number {
  const step = weightStep(ex, weight);
  return Math.max(weight + step, roundTo(weight * (1 + APRE_CHANGE), step));
}

/** 5% less, at least one step, never below one step. */
function down(weight: number, ex: Exercise): number {
  const step = weightStep(ex, weight);
  return Math.max(step, Math.min(weight - step, roundTo(weight * (1 - APRE_CHANGE), step)));
}

/** The weight after an all-out set: up for 7+, the same for 5-6, down under 5 when `twice`. */
export function adjustWeight(weight: number, reps: number, ex: Exercise, twice = true): number {
  if (reps >= APRE_TARGET_REPS) return up(weight, ex);
  if (reps >= 5) return weight;
  return twice ? down(weight, ex) : weight;
}

const working = (sets: ApreSet[]) => sets.filter((s) => !s.warm_up && s.weight_kg !== null && s.weight_kg > 0);

/** A session's last all-out set (set 3 or 4). */
function lastAllOut(sets: ApreSet[]): ApreSet | null {
  const all = working(sets).filter((s) => s.set_number >= 3);
  return all.length ? all[all.length - 1] : null;
}

/** The 7-rep weight a session worked from, worked back from whichever set it has. */
function sessionBase(sets: ApreSet[]): number | null {
  const ws = working(sets);
  const s3 = ws.find((s) => s.set_number === 3);
  if (s3) return s3.weight_kg;
  const s2 = ws.find((s) => s.set_number === 2);
  if (s2) return (s2.weight_kg as number) / 0.75;
  const s1 = ws.find((s) => s.set_number === 1);
  if (s1) return (s1.weight_kg as number) / 0.5;
  return null;
}

export type ApreStart = { base: number | null; last: string | null; why: string };

/**
 * Today's 7-rep weight from the sessions before today (newest first, each a
 * list of that day's sets). Null base the first time: the client picks one.
 */
export function apreBase(sessions: ApreSet[][], ex: Exercise): ApreStart {
  const [last, before] = sessions;
  if (!last) return { base: null, last: null, why: "" };
  const top = lastAllOut(last);
  if (!top) {
    const base = sessionBase(last);
    return { base: base ? roundTo(base, weightStep(ex, base)) : null, last: null, why: "Last time didn't get to the all-out set, so the weight stays the same." };
  }
  const w = top.weight_kg as number;
  const lastText = `Last time: ${kg(w)} × ${top.reps} on your all-out set`;
  if (top.reps >= APRE_TARGET_REPS) return { base: up(w, ex), last: lastText, why: `${top.reps} reps, so 5% more today.` };
  if (top.reps >= 5) return { base: w, last: lastText, why: `${top.reps} reps, so the same weight today.` };
  const prev = before ? lastAllOut(before) : null;
  if (prev && prev.reps < 5) return { base: down(w, ex), last: lastText, why: "Under 5 reps two sessions in a row, so 5% less today." };
  return { base: w, last: lastText, why: "Under 5 reps, so the same weight today. If it happens again next time, the weight comes down 5%." };
}

/** Rest after an APRE set: 1 minute after set 1, 2 after set 2, 3 between all-out sets, else the row's rest. */
export function apreRestAfter(setDone: number, totalSets: number, rowRest: number): number {
  if (setDone >= totalSets) return rowRest;
  if (setDone === 1) return 60;
  if (setDone === 2) return 120;
  return 180;
}

/**
 * What to do on the next set: its weight and what to aim for. `base` is
 * today's 7-rep weight (null the first time until set 1 is logged), `today`
 * the working sets logged so far today.
 */
export function apreNextSet(
  base: number | null,
  today: ApreSet[],
  totalSets: number,
  ex: Exercise,
  start?: ApreStart,
): Suggestion {
  const done = working(today);
  const setNo = done.length + 1;
  // The first time, set 1 is half of the weight they picked.
  const b = base ?? sessionBase(done);
  const step = (w: number) => weightStep(ex, w);
  const head = start?.last ? `${start.last}. ${start.why} ` : "";
  if (setNo > totalSets) {
    return { last: "APRE: all sets done ✓", advice: "That's all your sets for this one. Your last all-out set sets the weight for next time.", weight: done[done.length - 1]?.weight_kg ?? null };
  }
  const title = (w: number | null) => `APRE · your 7-rep weight: ${w ? kg(w) : "pick one"}`;
  if (setNo === 1) {
    if (!b) {
      return {
        last: title(null),
        advice: "First time: pick a weight you think you can lift about 7 times. Set 1 of " + totalSets + ": half of that weight for 10-12 easy reps, then rest 1 minute.",
        weight: null,
      };
    }
    const w = roundTo(b * 0.5, step(b * 0.5));
    return { last: title(b), advice: `${head}Set 1 of ${totalSets}: ${kg(w)} (50%) for 10-12 easy reps, then rest 1 minute.`, weight: w };
  }
  if (!b) return { last: title(null), advice: "Log set 1 first.", weight: null };
  if (setNo === 2) {
    const w = roundTo(b * 0.75, step(b * 0.75));
    return { last: title(b), advice: `Set 2 of ${totalSets}: ${kg(w)} (75%) for 8-10 reps, then rest 2 minutes.`, weight: w };
  }
  const allOut = "as many clean reps as you can. Stop when the next rep would break your form.";
  if (setNo === 3) {
    const w = roundTo(b, step(b));
    return { last: title(w), advice: `Set 3 of ${totalSets}: ${kg(w)}, ${allOut} Aim for ${APRE_TARGET_REPS}.`, weight: w };
  }
  // Set 4: from set 3's reps.
  const s3 = done.find((s) => s.set_number === 3) ?? done[done.length - 1];
  const w3 = s3.weight_kg as number;
  const w = adjustWeight(w3, s3.reps, ex);
  const move = w > w3 ? "up 5%" : w < w3 ? "down 5%" : "the same";
  return { last: title(b), advice: `Set 4 of ${totalSets}: ${kg(w)} (${move} after ${s3.reps} reps), ${allOut}`, weight: w };
}
