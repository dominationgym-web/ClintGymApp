import type { WorkoutLog } from "@/types/database";
import { needsWarmUp } from "@/lib/programs";

// Group live sessions (GRIZZ, 2026-10-21): one trainer, up to 4 clients, one
// workout. Each client keeps one colour and letter for the whole session, on
// their card, on the set box's banner and on its Save button, so a set can't
// go in the wrong client's slot without the trainer seeing whose it is.

export const MAX_GROUP = 4;

export const GROUP_SLOTS = [
  { letter: "A", color: "#D4AF37" },
  { letter: "B", color: "#38BDF8" },
  { letter: "C", color: "#F472B6" },
  { letter: "D", color: "#34D399" },
] as const;

export type GroupSlot = (typeof GROUP_SLOTS)[number];

/** The colour and letter for the client at this place in the group. */
export function slotFor(index: number): GroupSlot {
  return GROUP_SLOTS[index % GROUP_SLOTS.length];
}

type SetLike = Pick<WorkoutLog, "client_id" | "exercise_name" | "set_number" | "warm_up" | "weight_kg" | "reps">;

/** One client's working sets of one exercise today, in order. */
export function clientSets<T extends SetLike>(logs: T[], clientId: string, exerciseName: string): T[] {
  return logs
    .filter((l) => l.client_id === clientId && l.exercise_name === exerciseName && !l.warm_up)
    .sort((a, b) => a.set_number - b.set_number);
}

/** The set number the client's next working set of this exercise takes. */
export function nextSetNumber(logs: SetLike[], clientId: string, exerciseName: string): number {
  return clientSets(logs, clientId, exerciseName).reduce((n, l) => Math.max(n, l.set_number), 0) + 1;
}

/** How many working sets each client logged today. */
export function setsByClient(logs: SetLike[], clientIds: string[]): Record<string, number> {
  return Object.fromEntries(clientIds.map((id) => [id, logs.filter((l) => l.client_id === id && !l.warm_up).length]));
}

/**
 * The weight to start a client's next set at: their last set of it today,
 * else their last one before today, else empty.
 */
export function startWeight(today: SetLike[], earlier: SetLike[], clientId: string, exerciseName: string): string {
  const mine = clientSets(today, clientId, exerciseName);
  const last = mine.length ? mine[mine.length - 1] : earlier.filter((l) => l.client_id === clientId && l.exercise_name === exerciseName && !l.warm_up).at(-1);
  return last?.weight_kg != null ? String(last.weight_kg) : "";
}

/**
 * Warm-up set due (GRIZZ 2026-11-12): nothing of this exercise logged for the
 * client today and its body part not worked by them yet today.
 */
export function groupWarmUpDue(
  today: Pick<WorkoutLog, "client_id" | "exercise_name">[],
  clientId: string,
  exerciseName: string,
  categoryOf: (exerciseName: string) => string | null,
): boolean {
  const mine = today.filter((l) => l.client_id === clientId);
  if (mine.some((l) => l.exercise_name === exerciseName)) return false;
  return needsWarmUp(categoryOf(exerciseName), mine.map((l) => categoryOf(l.exercise_name)));
}

/** Whether the client logged a warm-up of this exercise today. */
export function warmedUp(today: Pick<WorkoutLog, "client_id" | "exercise_name" | "warm_up">[], clientId: string, exerciseName: string): boolean {
  return today.some((l) => l.client_id === clientId && l.exercise_name === exerciseName && l.warm_up);
}

// One flow for everything (GRIZZ 2026-11-16): every exercise is one page,
// "Exercise 2 of 5" with arrows, and an A/B card per person. A superset is just
// pages linked by the same `group`; the screen moves between its stations.

export type GroupStep = { id: string | null; name: string; sets: number; reps: string; group: string | null };

type PlanRow = { exercise_id: string | null; exercise_name: string; sets: number; reps: string; rest_seconds: number; kind: string };

/** A client's planned workout as pages: runs with rest 0 between them become one superset. */
export function stepsFromPlan(rows: PlanRow[]): GroupStep[] {
  const steps: GroupStep[] = [];
  let run: GroupStep[] = [];
  let n = 0;
  const close = () => {
    const group = run.length >= 2 ? `plan-${++n}` : null;
    run.forEach((s) => steps.push({ ...s, group }));
    run = [];
  };
  for (const r of rows) {
    if (r.kind !== "exercise") {
      close();
      continue;
    }
    run.push({ id: r.exercise_id, name: r.exercise_name, sets: r.sets, reps: r.reps, group: null });
    if (r.rest_seconds !== 0) close();
  }
  close();
  return steps;
}

/** The pages of the superset this page is in (in order), or just this page. */
export function stationsOf(steps: GroupStep[], index: number): number[] {
  const g = steps[index]?.group;
  if (!g) return [index];
  return steps.map((s, i) => (s.group === g ? i : -1)).filter((i) => i >= 0);
}

/**
 * Adds exercises to the session. One at a time each is its own page; as a
 * superset they go in as linked pages, taking any already in the session out
 * of where they were. Returns the new pages and the page to show.
 */
export function addSteps(
  steps: GroupStep[],
  picks: { id: string | null; name: string }[],
  asSuperset: boolean,
  group: string,
): { steps: GroupStep[]; index: number } {
  if (!asSuperset) {
    const at = steps.findIndex((s) => s.name === picks[0]?.name);
    const fresh = picks.filter((p) => !steps.some((s) => s.name === p.name));
    const out = [...steps, ...fresh.map((p) => ({ id: p.id, name: p.name, sets: 3, reps: "8-12", group: null }))];
    return { steps: out, index: at >= 0 ? at : steps.length };
  }
  const old = new Map(steps.map((s) => [s.name, s]));
  const kept = steps.filter((s) => !picks.some((p) => p.name === s.name));
  // A superset left with one station is a normal exercise again.
  const left = new Map<string, number>();
  kept.forEach((s) => s.group && left.set(s.group, (left.get(s.group) ?? 0) + 1));
  const tidy = kept.map((s) => (s.group && left.get(s.group) === 1 ? { ...s, group: null } : s));
  const added = picks.map((p) => {
    const was = old.get(p.name);
    return { id: p.id ?? was?.id ?? null, name: p.name, sets: was?.sets ?? 3, reps: was?.reps ?? "8-12", group };
  });
  return { steps: [...tidy, ...added], index: tidy.length };
}

/**
 * Blocks (GRIZZ 2026-11-16): what the group is doing at one time, a single
 * exercise or a whole superset/circuit. Each block lists its step indexes.
 */
export function blocksOf(steps: GroupStep[]): number[][] {
  const out: number[][] = [];
  steps.forEach((s, i) => {
    const last = out[out.length - 1];
    if (last && s.group && steps[last[0]].group === s.group) last.push(i);
    else out.push([i]);
  });
  return out;
}

/** The block a step is in. */
export function blockOfStep(steps: GroupStep[], stepIndex: number): number {
  return Math.max(0, blocksOf(steps).findIndex((b) => b.includes(stepIndex)));
}

/** Rounds of a block a client has finished: the fewest working sets of any of its exercises. */
export function roundsDone(logs: SetLike[], clientId: string, names: string[]): number {
  if (names.length === 0) return 0;
  return Math.min(...names.map((n) => clientSets(logs, clientId, n).length));
}

/**
 * After a client logs a round: the next person (in group order, after them)
 * who is behind them on this block, so the trainer can go straight to them.
 * Null when everyone has caught up.
 */
export function nextBehind(order: string[], after: string, logs: SetLike[], names: string[]): string | null {
  const mine = roundsDone(logs, after, names);
  const at = order.indexOf(after);
  for (let k = 1; k < order.length; k++) {
    const id = order[(at + k) % order.length];
    if (roundsDone(logs, id, names) < mine) return id;
  }
  return null;
}
