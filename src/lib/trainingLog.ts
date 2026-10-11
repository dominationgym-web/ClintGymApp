import { parseIsoDate, toIsoDate } from "@/lib/dates";
import type { WorkoutLog } from "@/types/database";

// How many days the trainer's training log shows: two weeks, today included.
export const TRAINING_LOG_DAYS = 14;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type TrainingLogExercise = { name: string; sets: WorkoutLog[] };

export type TrainingLogDay = {
  date: string;
  /** "Mon 12 Oct" */
  label: string;
  exercises: TrainingLogExercise[];
  setCount: number;
};

/** The first calendar date the log shows, as `YYYY-MM-DD`. */
export function trainingLogStart(today: string, days: number = TRAINING_LOG_DAYS): string {
  const start = parseIsoDate(today);
  start.setDate(start.getDate() - (days - 1));
  return toIsoDate(start);
}

export function dayLabel(iso: string): string {
  const d = parseIsoDate(iso);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/**
 * Every calendar day from today back `days` days, newest first, with that
 * day's sets grouped by exercise in the order they were done. Days with
 * nothing logged are kept so the trainer sees the gaps.
 */
export function groupTrainingLog(logs: WorkoutLog[], today: string, days: number = TRAINING_LOG_DAYS): TrainingLogDay[] {
  const byDate = new Map<string, WorkoutLog[]>();
  for (const log of logs) {
    const list = byDate.get(log.log_date) ?? [];
    list.push(log);
    byDate.set(log.log_date, list);
  }
  const result: TrainingLogDay[] = [];
  const cursor = parseIsoDate(today);
  for (let i = 0; i < days; i++) {
    const date = toIsoDate(cursor);
    const sets = [...(byDate.get(date) ?? [])].sort(
      (a, b) => a.created_at.localeCompare(b.created_at) || a.set_number - b.set_number,
    );
    const exercises: TrainingLogExercise[] = [];
    for (const set of sets) {
      let exercise = exercises.find((e) => e.name === set.exercise_name);
      if (!exercise) {
        exercise = { name: set.exercise_name, sets: [] };
        exercises.push(exercise);
      }
      exercise.sets.push(set);
    }
    for (const e of exercises) e.sets.sort((a, b) => a.set_number - b.set_number);
    result.push({ date, label: dayLabel(date), exercises, setCount: sets.length });
    cursor.setDate(cursor.getDate() - 1);
  }
  return result;
}
