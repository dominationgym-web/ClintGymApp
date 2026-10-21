import type { WorkoutLog } from "@/types/database";

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
