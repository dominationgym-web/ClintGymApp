import type { ClientExerciseChange, ProgramExercise } from "@/types/database";

// Per-client exercise changes (0070): the trainer changes an exercise, its
// sets or reps for one client, around an injury say, without touching the
// preset program.

type Change = Pick<
  ClientExerciseChange,
  "program_exercise_id" | "original_exercise_id" | "exercise_id" | "exercise_name" | "sets" | "reps"
>;

/** The change for one workout row, and the every-workout swap for its exercise. */
export function changesFor<C extends Change>(row: Pick<ProgramExercise, "id" | "exercise_id">, changes: C[]) {
  return {
    own: changes.find((c) => c.program_exercise_id === row.id) ?? null,
    everywhere: row.exercise_id
      ? changes.find((c) => c.program_exercise_id == null && c.original_exercise_id === row.exercise_id) ?? null
      : null,
  };
}

/**
 * A workout's rows with the client's changes in place. A one-workout change
 * wins over an every-workout one, field by field. Changed rows keep what the
 * workout says in changed_from.
 */
export function applyExerciseChanges(rows: ProgramExercise[], changes: Change[]): ProgramExercise[] {
  if (changes.length === 0) return rows;
  return rows.map((row) => {
    if (row.kind === "cardio") return row;
    const { own, everywhere } = changesFor(row, changes);
    if (!own && !everywhere) return row;
    const swapped = own?.exercise_id ? own : everywhere?.exercise_id ? everywhere : null;
    const next: ProgramExercise = {
      ...row,
      exercise_id: swapped?.exercise_id ?? row.exercise_id,
      exercise_name: swapped?.exercise_name ?? row.exercise_name,
      sets: own?.sets ?? row.sets,
      reps: own?.reps ?? row.reps,
    };
    const same =
      next.exercise_id === row.exercise_id && next.sets === row.sets && next.reps === row.reps;
    if (same) return row;
    return {
      ...next,
      changed_from: { exercise_id: row.exercise_id, exercise_name: row.exercise_name, sets: row.sets, reps: row.reps },
    };
  });
}

export interface ChangeChoice {
  exercise: { id: string; name: string };
  sets: number;
  reps: string;
  /** Swap the exercise out of every workout for this client, not just this one. */
  everywhere: boolean;
}

export interface ChangeWrites {
  upserts: Partial<ClientExerciseChange>[];
  /** Ids of existing changes to remove. */
  removes: string[];
}

/**
 * What to save for the trainer's choice on one row. Sets and reps are always
 * for this workout only; the exercise swap is for every workout or just this
 * one.
 */
export function planChangeWrites(
  clientId: string,
  row: Pick<ProgramExercise, "id" | "exercise_id" | "exercise_name" | "sets" | "reps">,
  existing: (Change & { id: string })[],
  choice: ChangeChoice,
): ChangeWrites {
  const { own, everywhere } = changesFor(row, existing);
  const upserts: Partial<ClientExerciseChange>[] = [];
  const removes: string[] = [];
  const now = new Date().toISOString();
  const setsChanged = choice.sets !== row.sets;
  const repsChanged = choice.reps.trim() !== row.reps;
  const ownFields = { sets: setsChanged ? choice.sets : null, reps: repsChanged ? choice.reps.trim() : null };

  if (choice.everywhere && row.exercise_id) {
    const swapped = choice.exercise.id !== row.exercise_id;
    if (swapped) {
      upserts.push({
        client_id: clientId,
        original_exercise_id: row.exercise_id,
        exercise_id: choice.exercise.id,
        exercise_name: choice.exercise.name,
        updated_at: now,
      });
    } else if (everywhere) {
      removes.push(everywhere.id);
    }
    if (setsChanged || repsChanged) {
      upserts.push({ client_id: clientId, program_exercise_id: row.id, exercise_id: null, exercise_name: null, ...ownFields, updated_at: now });
    } else if (own) {
      removes.push(own.id);
    }
  } else {
    // Just this workout. Name the exercise when it differs from what the
    // every-workout swap (or the workout) would give.
    const fallback = everywhere?.exercise_id ?? row.exercise_id;
    const swapped = choice.exercise.id !== fallback;
    if (swapped || setsChanged || repsChanged) {
      upserts.push({
        client_id: clientId,
        program_exercise_id: row.id,
        exercise_id: swapped ? choice.exercise.id : null,
        exercise_name: swapped ? choice.exercise.name : null,
        ...ownFields,
        updated_at: now,
      });
    } else if (own) {
      removes.push(own.id);
    }
  }
  return { upserts, removes };
}
