import type { ProgramExercise, SetEffort, WorkoutLog } from "@/types/database";

// Superset logger (GRIZZ, 2026-10-23): pick 2, 3 or 4 exercises, start, do
// one set of each back to back, then log the whole round at once and rest.
// Works on any workout and in live sessions.

export const SUPERSET_MIN = 2;
export const SUPERSET_MAX = 4;
/** Rounds when none of the exercises come from today's workout. */
export const SUPERSET_DEFAULT_ROUNDS = 3;
/** Rest after a round when the workout doesn't say. */
export const SUPERSET_DEFAULT_REST = 90;

export type SupersetPick = {
  exercise_id: string | null;
  exercise_name: string;
  /** The row in today's workout it came from, for its sets, reps and rest. */
  row: Pick<ProgramExercise, "sets" | "reps" | "rest_seconds"> | null;
};

export type RoundEntry = { weight: string; reps: string; effort: SetEffort | null };

const same = (log: Pick<WorkoutLog, "exercise_id" | "exercise_name">, pick: Pick<SupersetPick, "exercise_id" | "exercise_name">) =>
  pick.exercise_id ? log.exercise_id === pick.exercise_id : log.exercise_name === pick.exercise_name;

/** Rounds to do: the most sets any picked workout exercise has, else 3. */
export function supersetRounds(picks: SupersetPick[]): number {
  const sets = picks.map((p) => p.row?.sets ?? 0);
  return Math.max(...sets, 0) || SUPERSET_DEFAULT_ROUNDS;
}

/** Rest after each round: the longest rest of the picked workout exercises, else 90 seconds. */
export function supersetRest(picks: SupersetPick[]): number {
  return Math.max(...picks.map((p) => p.row?.rest_seconds ?? 0), 0) || SUPERSET_DEFAULT_REST;
}

/** Working sets of this exercise already logged today. */
export function workingSetsOf(pick: SupersetPick, todays: Pick<WorkoutLog, "exercise_id" | "exercise_name" | "warm_up">[]): number {
  return todays.filter((l) => !l.warm_up && same(l, pick)).length;
}

/** The weight to start from: the latest one logged for this exercise. */
export function lastWeightOf(
  pick: SupersetPick,
  logs: Pick<WorkoutLog, "exercise_id" | "exercise_name" | "weight_kg" | "log_date" | "created_at">[],
): number | null {
  const mine = logs
    .filter((l) => same(l, pick) && l.weight_kg != null)
    .sort((a, b) => (a.log_date + a.created_at < b.log_date + b.created_at ? 1 : -1));
  return mine[0]?.weight_kg ?? null;
}

/**
 * Checks a round before saving. An exercise left without reps is skipped
 * (they didn't get to it); one with reps needs the effort too. Returns the
 * problem to show, or null when it can be saved.
 */
export function roundProblem(picks: SupersetPick[], entries: RoundEntry[]): string | null {
  const filled = entries.filter((e) => e.reps.trim() !== "");
  if (filled.length === 0) return "Enter the reps for at least one exercise.";
  for (let i = 0; i < picks.length; i++) {
    const e = entries[i];
    if (!e || e.reps.trim() === "") continue;
    const reps = Number(e.reps);
    if (!Number.isInteger(reps) || reps <= 0) return `Check the reps for ${picks[i].exercise_name}.`;
    if (!e.effort) return `Pick how many more reps you had left on ${picks[i].exercise_name}.`;
  }
  return null;
}

// Superset heads-up (GRIZZ, 2026-11-09): before a client starts a workout
// with supersets, tell them it's a superset session, how many stations each
// superset has and what to set up, so they can get it ready first.

type SessionRow = Pick<ProgramExercise, "id" | "exercise_name" | "sets" | "reps" | "rest_seconds" | "kind">;

export type SupersetGroup<R extends SessionRow = SessionRow> = {
  /** The stations, in the order they're done (2 = superset, 3+ = tri-set or more). */
  rows: R[];
  /** Rounds: the most sets of any station. */
  rounds: number;
  /** Rest after the last station of each round, in seconds. */
  restAfter: number;
};

/**
 * The supersets in a session: runs of exercises where each one but the last
 * has rest 0 (straight into the next). Cardio blocks break a run.
 */
export function supersetGroups<R extends SessionRow>(session: R[]): SupersetGroup<R>[] {
  const groups: SupersetGroup<R>[] = [];
  let run: R[] = [];
  const close = () => {
    if (run.length >= 2) {
      const last = run[run.length - 1];
      groups.push({ rows: run, rounds: Math.max(...run.map((r) => r.sets)), restAfter: last.rest_seconds });
    }
    run = [];
  };
  for (const row of session) {
    if (row.kind === "cardio") {
      close();
      continue;
    }
    run.push(row);
    if (row.rest_seconds !== 0) close();
  }
  close();
  return groups;
}

/** "2 stations" for one superset; "2 and 3 stations" style when there are more. */
export function stationsSummary(groups: Pick<SupersetGroup, "rows">[]): string {
  const counts = [...new Set(groups.map((g) => g.rows.length))].sort((a, b) => a - b);
  if (counts.length === 0) return "";
  const words = counts.length === 1 ? `${counts[0]}` : `${counts.slice(0, -1).join(", ")} and ${counts[counts.length - 1]}`;
  return `${words} stations`;
}

// What to put out for an exercise, read from its name. Order matters: the
// first match for the main kit wins, then a bench or bar is added.
const KIT: [RegExp, string][] = [
  [/smith/i, "Smith machine"],
  [/trap bar|hex bar/i, "Trap bar"],
  [/\bez[- ]?bar\b/i, "EZ bar"],
  [/\bband(ed|s)?\b/i, "Band"],
  [/kettlebell|\bkb\b/i, "Kettlebell"],
  [/cable|pulldown|pull-down|pushdown|push-down|face pull|crossover|straight[- ]arm/i, "Cable machine"],
  [/leg press|hack squat|leg extension|leg curl|hamstring curl|pec deck|machine|calf raise machine|hip abduct|hip adduct|lat pull/i, "Machine"],
  [/dumbbell|\bdb\b/i, "Dumbbells"],
  [/goblet/i, "Dumbbell or kettlebell"],
  [/barbell|\bbb\b|deadlift|back squat|front squat|bench press|hip thrust|good morning|bent[- ]over row|pendlay|landmine/i, "Barbell"],
  [/medicine ball|med ball|slam ball|wall ball/i, "Medicine ball"],
  [/stability ball|swiss ball/i, "Stability ball"],
  [/box jump|step-up|step up/i, "Box or step"],
  [/inverted row/i, "Low bar or Smith machine"],
  [/battle rope/i, "Battle ropes"],
  [/\btrx\b|suspension/i, "Suspension straps"],
  [/sled/i, "Sled"],
];

/** The kit to set up for one exercise, e.g. ["Dumbbells", "Incline bench"]. Empty for bodyweight. */
export function setupFor(name: string): string[] {
  const n = name.toLowerCase();
  const out: string[] = [];
  const main = KIT.find(([re]) => re.test(n));
  if (main) out.push(main[1]);
  if (/incline|decline/.test(n) && !/push-up|push up|pushup|plank/.test(n) && !/machine|cable|smith/.test(n)) out.push(n.includes("decline") ? "Decline bench" : "Incline bench");
  else if (/bench|seated|preacher|chest-supported|seal row|skull crusher|tate press|chest fly|flat .*press|lying/.test(n) && !/bench dip|machine|cable|leg|calf/.test(n))
    out.push("Bench");
  if (/pull-up|pullup|chin-up|chinup|hanging|toes-to-bar|dead hang/.test(n)) out.push("Pull-up bar");
  if (/\bdips?\b/.test(n) && !n.includes("bench dip")) out.push("Dip bars");
  if (/bench dip/.test(n)) out.push("Bench");
  return [...new Set(out)];
}
