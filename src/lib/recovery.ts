// Recovery check: spots a client training the same muscles two days running,
// so the trainer can leave it, move the session to tomorrow, or lighten it.
// Plain rules from the recovery guide (about 48 hours before the same muscle
// is trained hard again; arms count after chest or back days).
import { exercisesForDate } from "@/lib/programs";
import { currentSession, isDue, trainingDays, addDays, slotOf } from "@/lib/programSchedule";
import { parseIsoDate } from "@/lib/dates";
import type { ActiveProgram } from "@/lib/programQueries";
import type { ClientProgram, ProgramExercise } from "@/types/database";

export type MuscleGroup = "Chest" | "Back" | "Legs" | "Shoulders" | "Biceps" | "Triceps";

// Exercise category → the muscle groups it works hard. Calves, core, cardio,
// mobility and the like recover quickly and aren't checked.
const CATEGORY_GROUPS: Record<string, MuscleGroup[]> = {
  Push: ["Chest", "Triceps"],
  Pull: ["Back", "Biceps"],
  Legs: ["Legs"],
  Quads: ["Legs"],
  Glutes: ["Legs"],
  Hamstrings: ["Legs"],
  "Posterior Chain": ["Legs"],
  Adductors: ["Legs"],
  Shoulders: ["Shoulders"],
  "Overhead Press": ["Shoulders"],
  Biceps: ["Biceps"],
  Triceps: ["Triceps"],
};

// Hard sets of a muscle the day before that count as "trained it".
const MIN_SETS_YESTERDAY = 3;

export function muscleGroupsFor(category: string | null | undefined): MuscleGroup[] {
  return (category && CATEGORY_GROUPS[category]) || [];
}

/** How many sets of each muscle group a list of logged sets covers. */
export function setsByGroup(
  logs: { exercise_id: string | null }[],
  categoryOf: (exerciseId: string | null) => string | null | undefined,
): Partial<Record<MuscleGroup, number>> {
  const counts: Partial<Record<MuscleGroup, number>> = {};
  for (const log of logs) {
    for (const group of muscleGroupsFor(categoryOf(log.exercise_id))) counts[group] = (counts[group] ?? 0) + 1;
  }
  return counts;
}

/** The program rows the client is due to do on `today` (the same rule as their workout screen). */
export function plannedRowsFor(active: ActiveProgram, today: string): ProgramExercise[] {
  if (active.program.kind === "weekly") {
    const session = currentSession(active.assignment, trainingDays(active.exercises));
    if (!session || !isDue(session, today)) return [];
    return active.exercises.filter((e) => slotOf(e) === session.day).sort((a, b) => a.sort_order - b.sort_order);
  }
  return exercisesForDate(active.program, active.exercises, parseIsoDate(today));
}

export type RecoveryClash = {
  /** Muscle groups trained yesterday that today's session works again. */
  groups: MuscleGroup[];
  /** Today's program rows that work those groups. */
  rows: ProgramExercise[];
};

/** Today's clash, or null when the session gives every muscle its rest. */
export function findRecoveryClash(
  planned: ProgramExercise[],
  yesterday: Partial<Record<MuscleGroup, number>>,
  categoryOf: (exerciseId: string | null) => string | null | undefined,
): RecoveryClash | null {
  const tired = new Set(
    (Object.keys(yesterday) as MuscleGroup[]).filter((g) => (yesterday[g] ?? 0) >= MIN_SETS_YESTERDAY),
  );
  const groups = new Set<MuscleGroup>();
  const rows: ProgramExercise[] = [];
  for (const row of planned) {
    if (row.kind === "cardio") continue;
    const hit = muscleGroupsFor(categoryOf(row.exercise_id)).filter((g) => tired.has(g));
    if (hit.length === 0) continue;
    hit.forEach((g) => groups.add(g));
    rows.push(row);
  }
  if (rows.length === 0) return null;
  return { groups: [...groups], rows };
}

/** "Chest and triceps" for the warning line. */
export function groupList(groups: MuscleGroup[]): string {
  const names = groups.map((g, i) => (i === 0 ? g : g.toLowerCase()));
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The suggested lighter session: about half the sets for each clashing exercise, at least 1. */
export function lighterSets(clash: RecoveryClash): Record<string, number> {
  const sets: Record<string, number> = {};
  for (const row of clash.rows) sets[row.id] = Math.max(1, Math.ceil(row.sets / 2));
  return sets;
}

/** Today's lighter session from the trainer (0059), applied to the client's workout rows. */
export function applyRecoveryAdjustment(
  rows: ProgramExercise[],
  assignment: Pick<ClientProgram, "recovery_adjustment">,
  today: string,
): ProgramExercise[] {
  const adjustment = assignment.recovery_adjustment;
  if (!adjustment || adjustment.date !== today) return rows;
  return rows
    .map((row) => (row.id in adjustment.sets ? { ...row, sets: adjustment.sets[row.id] } : row))
    .filter((row) => row.sets > 0);
}

/** Whether the trainer already dealt with today's check (left it or lightened it). */
export function recoveryHandled(
  assignment: Pick<ClientProgram, "recovery_ignored_on" | "recovery_adjustment">,
  today: string,
): boolean {
  return assignment.recovery_ignored_on === today || assignment.recovery_adjustment?.date === today;
}

export function yesterdayOf(today: string): string {
  return addDays(today, -1);
}
