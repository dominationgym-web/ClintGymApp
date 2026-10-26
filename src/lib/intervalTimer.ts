import type { ProgramExercise } from "@/types/database";

// Interval timer (GRIZZ, 2026-10-14): sprint, threshold and fight
// conditioning work is about timing, not technique, so the workout gets a
// timer that runs every round: WORK in red, EASY in green, a buzz at each
// switch. It's built from the workout's own rows.

export type IntervalPhase = {
  // "work": go hard. "easy": recover between efforts.
  kind: "work" | "easy";
  // Exercise or machine.
  name: string;
  // What to do, e.g. "30 sec all-out" or "Easy pedalling".
  detail: string;
  // Null for an open effort (a distance or a ladder) the client ends with Done.
  seconds: number | null;
  round: number;
  rounds: number;
  // The program row it belongs to, and whether finishing it counts as a set.
  rowId: string;
  countsAsSet: boolean;
  // Timer section only (timerWorkouts.ts): which Tabata, and the get ready count.
  set?: number;
  sets?: number;
  getReady?: boolean;
};

/** Seconds at the start of a reps text: "30 sec all-out" is 30, "3 min round" is 180, "10" is null. */
export function leadingSeconds(text: string): number | null {
  const m = text.trim().match(/^(\d+(?:\.\d+)?)\s*(sec|secs|seconds?|s|min|mins|minutes?)\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  const seconds = /^s/i.test(m[2]) ? n : n * 60;
  // "30 sec each leg" is done once per side.
  return /each (leg|side|arm)/i.test(text) ? seconds * 2 : seconds;
}

/** "250 m hard" or "15 m sprint push": a distance, done until finished. */
export function isDistance(text: string): boolean {
  return /^\d+\s*m\b(?!in)/i.test(text.trim());
}

/** "3 x 10 min at threshold (7/10) / 3 min easy": rounds, work and easy seconds. */
export function parseRepeats(text: string): { rounds: number; work: number; workText: string; easy: number; easyText: string } | null {
  // " / " with spaces, so "(7/10)" in the work part isn't taken for the split.
  const m = text.match(/^(\d+)\s*x\s*(.+?)\s+\/\s+(.+)$/i);
  if (!m) return null;
  const work = leadingSeconds(m[2]);
  const easy = leadingSeconds(m[3]);
  if (!work || !easy) return null;
  return { rounds: Number(m[1]), work, workText: m[2].trim(), easy, easyText: m[3].trim() };
}

const EASY_WORDS = /easy|cool down|cool-down|walk|recover/i;

/** Whether a row belongs in the timer: timed work, a distance effort, or a cardio block. */
export function isTimedRow(row: Pick<ProgramExercise, "kind" | "reps">): boolean {
  if (row.kind === "cardio") return true;
  return leadingSeconds(row.reps) !== null || isDistance(row.reps);
}

/** Whether the workout has enough timed work to offer the timer. */
export function hasIntervals(rows: Pick<ProgramExercise, "kind" | "reps">[]): boolean {
  return rows.some((r) => r.kind !== "cardio" && leadingSeconds(r.reps) !== null) || rows.some((r) => r.kind === "cardio" && parseRepeats(r.reps));
}

type Row = Pick<ProgramExercise, "id" | "kind" | "exercise_name" | "sets" | "reps" | "rest_seconds">;

function cardioPhases(row: Row): IntervalPhase[] {
  const repeats = parseRepeats(row.reps);
  if (repeats) {
    const out: IntervalPhase[] = [];
    for (let r = 1; r <= repeats.rounds; r++) {
      out.push({ kind: "work", name: row.exercise_name, detail: repeats.workText, seconds: repeats.work, round: r, rounds: repeats.rounds, rowId: row.id, countsAsSet: false });
      if (r < repeats.rounds)
        out.push({ kind: "easy", name: row.exercise_name, detail: repeats.easyText, seconds: repeats.easy, round: r, rounds: repeats.rounds, rowId: row.id, countsAsSet: false });
    }
    return out;
  }
  const seconds = leadingSeconds(row.reps);
  return [
    {
      kind: EASY_WORDS.test(row.reps) && !/sprint|hard|threshold/i.test(row.reps) ? "easy" : "work",
      name: row.exercise_name,
      detail: row.reps,
      seconds,
      round: 1,
      rounds: 1,
      rowId: row.id,
      countsAsSet: false,
    },
  ];
}

/**
 * Every phase of the workout, in order. Rows chained with no rest (a circuit
 * or superset) run as one block: each round goes through all of them, then
 * the last row's rest. Rep-counted strength rows are left out; the client
 * logs those as usual.
 */
export function buildIntervals(rows: Row[]): IntervalPhase[] {
  const phases: IntervalPhase[] = [];
  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    if (!isTimedRow(row)) {
      i++;
      continue;
    }
    if (row.kind === "cardio") {
      phases.push(...cardioPhases(row));
      i++;
      continue;
    }
    // A block: this row plus any timed rows it runs straight into.
    const block: Row[] = [row];
    while (block[block.length - 1].rest_seconds === 0 && i + block.length < rows.length) {
      const next = rows[i + block.length];
      if (next.kind === "cardio" || !isTimedRow(next)) break;
      block.push(next);
    }
    const rounds = Math.max(...block.map((b) => b.sets));
    for (let r = 1; r <= rounds; r++) {
      block.forEach((b, j) => {
        if (r > b.sets) return;
        phases.push({ kind: "work", name: b.exercise_name, detail: b.reps, seconds: leadingSeconds(b.reps), round: r, rounds, rowId: b.id, countsAsSet: true });
        const lastInRound = j === block.length - 1;
        const lastOfAll = lastInRound && r === rounds;
        if (b.rest_seconds > 0 && !lastOfAll)
          phases.push({ kind: "easy", name: b.exercise_name, detail: lastInRound ? "Easy until the next round" : "Easy", seconds: b.rest_seconds, round: r, rounds, rowId: b.id, countsAsSet: false });
      });
    }
    i += block.length;
  }
  return phases;
}

/** Total time of the timed phases, in whole minutes (open efforts not counted). */
export function totalMinutes(phases: IntervalPhase[]): number {
  return Math.round(phases.reduce((t, p) => t + (p.seconds ?? 0), 0) / 60);
}

// How hard each effort should feel, in plain words, for the card before the timer.
export const EFFORT_GUIDE = [
  { label: "All-out / flat-out", text: "As hard as you possibly can from the first second. You can't talk at all." },
  { label: "Hard (8-9/10)", text: "Breathing very hard. One or two words at most." },
  { label: "Threshold (7/10)", text: "Comfortably hard. A few words, but no chatting. A pace you could just about hold for an hour." },
  { label: "Easy", text: "Keep moving gently. You could hold a conversation." },
];
