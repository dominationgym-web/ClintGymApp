import type { Program, ProgramExercise } from "@/types/database";

// How many exercises a trainer can put in a program from the builder.
export const EXERCISE_COUNTS = [4, 6, 8] as const;

// Rest choices on the builder, in seconds.
export const REST_OPTIONS = [60, 90, 120, 180] as const;

// Rest timer length when the client logs a set that isn't part of a program.
export const DEFAULT_REST_SECONDS = 120;

export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** 1 = Monday ... 7 = Sunday, from the local calendar day. */
export function programDayNumber(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

/** The exercises the client should do on `date`, in order. */
export function exercisesForDate(
  program: Pick<Program, "kind">,
  exercises: ProgramExercise[],
  date: Date,
): ProgramExercise[] {
  const dayNumber = program.kind === "weekly" ? programDayNumber(date) : 1;
  return exercises.filter((e) => e.day_number === dayNumber).sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * The program name a client sees. Built-in programs that come in numbered sets
 * ("Chest & Bi 1" to "Chest & Bi 4") drop the number: it's only for the
 * trainer to tell them apart.
 */
export function displayProgramName(program: Pick<Program, "name" | "trainer_id">): string {
  if (program.trainer_id) return program.name;
  return program.name.replace(/\s+\d+$/, "");
}

/**
 * For a superset (rest 0 before the next exercise), the exercise to go
 * straight into after this one; null otherwise.
 */
export function supersetNext(row: ProgramExercise, session: ProgramExercise[]): ProgramExercise | null {
  if (row.rest_seconds !== 0) return null;
  const i = session.findIndex((e) => e.id === row.id);
  return i >= 0 ? session[i + 1] ?? null : null;
}

/**
 * The exercise to go to once all sets of `row` are logged: the next one in the
 * session that still has sets to do, else an earlier unfinished one, else null
 * (the whole workout is done).
 */
export function nextUnfinished(
  row: ProgramExercise,
  session: ProgramExercise[],
  setsDone: (row: ProgramExercise) => number,
): ProgramExercise | null {
  const i = session.findIndex((e) => e.id === row.id);
  const ordered = [...session.slice(i + 1), ...session.slice(0, Math.max(i, 0))];
  return ordered.find((e) => e.id !== row.id && setsDone(e) < e.sets) ?? null;
}

/** The title for the day's session, e.g. "Workout A" or "Rest day". */
export function dayTitle(program: Pick<Program, "kind" | "name" | "day_titles" | "trainer_id">, date: Date): string {
  if (program.kind !== "weekly") return displayProgramName(program);
  return program.day_titles[programDayNumber(date) - 1] ?? WEEKDAY_NAMES[programDayNumber(date) - 1];
}

/** "45 sec", "2 min", "2 min 30 sec". */
export function formatRest(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest} sec`;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} sec`;
}

/** "1:05" for a running countdown. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Warm-up reps: double the working reps, e.g. "8-10" -> "16-20" and
 * "10 each leg" -> "20 each leg". Timed holds ("45 sec") and anything without
 * a number get no warm-up set, so this returns null.
 */
export function warmUpReps(reps: string): string | null {
  if (/sec|min/i.test(reps) || !/\d/.test(reps)) return null;
  return reps.replace(/\d+/g, (n) => String(Number(n) * 2));
}

/**
 * A warm-up set comes first for each body part: due when nothing for this
 * exercise's category has been logged today.
 */
export function needsWarmUp(category: string | null, categoriesLoggedToday: Iterable<string | null>): boolean {
  if (!category || category === "Core") return false;
  for (const c of categoriesLoggedToday) if (c === category) return false;
  return true;
}

export interface DraftExercise {
  exerciseId: string | null;
  exerciseName: string;
  sets: number;
  reps: string;
  restSeconds: number;
}

/** What's wrong with a program from the builder, or null when it can be saved. */
export function draftProblem(name: string, exercises: DraftExercise[]): string | null {
  if (!name.trim()) return "Give the program a name.";
  const missing = exercises.findIndex((e) => !e.exerciseName);
  if (missing !== -1) return `Pick an exercise for slot ${missing + 1}.`;
  const noReps = exercises.findIndex((e) => !e.reps.trim());
  if (noReps !== -1) return `Add the reps for ${exercises[noReps].exerciseName}.`;
  return null;
}

export interface DraftSession {
  day: number; // 1 = Monday ... 7 = Sunday
  title: string;
  exercises: DraftExercise[];
}

/** Default session titles in week order: "Workout A", "Workout B", ... */
export function defaultSessionTitle(index: number): string {
  return `Workout ${String.fromCharCode(65 + index)}`;
}

/** What's wrong with a weekly program from the builder, or null when it can be saved. */
export function weeklyDraftProblem(name: string, sessions: DraftSession[]): string | null {
  if (!name.trim()) return "Give the program a name.";
  if (sessions.length === 0) return "Pick at least one training day.";
  for (const s of sessions) {
    const day = WEEKDAY_NAMES[s.day - 1];
    const missing = s.exercises.findIndex((e) => !e.exerciseName);
    if (missing !== -1) return `${day}: pick an exercise for slot ${missing + 1}.`;
    const noReps = s.exercises.findIndex((e) => !e.reps.trim());
    if (noReps !== -1) return `${day}: add the reps for ${s.exercises[noReps].exerciseName}.`;
  }
  return null;
}
