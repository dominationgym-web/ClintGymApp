import { ANKLE } from "./ankle";
import { KNEE } from "./knee";
import { HIP } from "./hip";
import { CORE } from "./core";
import { SHOULDER } from "./shoulder";
import { WRIST } from "./wrist";
import { NECK } from "./neck";
import { parseIsoDate } from "@/lib/dates";
import type {
  StabilityArea,
  StabilityAreaGuide,
  StabilityDose,
  StabilityExercise,
  StabilityLevel,
  StabilityMode,
  StabilityPhase,
  StabilityProgram,
} from "./types";

export * from "./types";
import { levelInfo } from "./common";
export { LEVELS, levelInfo, PAIN_RULE, REHAB_REFER, STABILITY_BASICS } from "./common";
export { stabilityAreasFor } from "./injuryMatch";

// From the ground up, the order GRIZZ listed them.
export const STABILITY_AREAS: StabilityAreaGuide[] = [ANKLE, KNEE, HIP, CORE, SHOULDER, WRIST, NECK];

export const STABILITY_MENU_ITEM = {
  key: "stability",
  title: "Stability & injury prevention",
  icon: "🛡️",
  summary: "4-8 week programs for ankle, knee, hip, core, shoulder, wrist and neck: rehab to advanced.",
};

// Before a Rehab program starts, the trainer ticks that none of these apply
// (review 2026-10-18): trainers can't diagnose or treat injuries, so anything
// fresh, after surgery or with a red flag is assessed first.
export const REHAB_GENERAL_FLAGS = [
  "The injury happened in the last 1-2 weeks.",
  "They've had surgery on this area and haven't been cleared for strength training by their surgeon or physio.",
  "Pain at night or at rest, pain above about 7 out of 10, or pain that isn't improving after 2 weeks.",
  "A hot, red, swollen joint, or fever or feeling unwell.",
];

/** The red flags to check before a Rehab program: the general ones, then the area's own. */
export function rehabRedFlags(area: StabilityArea): string[] {
  return [...REHAB_GENERAL_FLAGS, ...findArea(area).redFlags];
}

export function findArea(area: StabilityArea): StabilityAreaGuide {
  return STABILITY_AREAS.find((a) => a.area === area)!;
}

export function findProgram(area: StabilityArea, level: StabilityLevel): StabilityProgram {
  return findArea(area).programs.find((p) => p.level === level)!;
}

export function findExercise(area: StabilityArea, key: string): StabilityExercise | undefined {
  return findArea(area).exercises.find((e) => e.key === key);
}

/** Every library clip the programs use, for the video lookup (0094). */
export function stabilityVideoNames(): string[] {
  const names = new Set<string>();
  for (const a of STABILITY_AREAS) for (const e of a.exercises) if (e.video) names.add(e.video);
  return [...names].sort();
}

/** Week 1 starts on the day they tap Start. */
export function stabilityWeek(startedOn: string, today: string): number {
  const days = Math.round((parseIsoDate(today).getTime() - parseIsoDate(startedOn).getTime()) / 86400000);
  return Math.max(1, Math.floor(days / 7) + 1);
}

/** The phase for a week; after the last week, the last phase. */
export function phaseFor(program: StabilityProgram, week: number): StabilityPhase {
  return program.phases.find((p) => week >= p.from && week <= p.to) ?? program.phases[program.phases.length - 1];
}

export function itemsFor(phase: StabilityPhase, mode: StabilityMode): StabilityDose[] {
  return mode === "primer" ? phase.items.filter((i) => i.primer) : phase.items;
}

/** The primer is 1-2 sets of each exercise, so it fits before a workout. */
export function setsFor(dose: StabilityDose, mode: StabilityMode): number {
  return mode === "primer" ? Math.min(dose.sets, 2) : dose.sets;
}

export function unitLabel(exercise: Pick<StabilityExercise, "measure">, n: number): string {
  return exercise.measure === "hold" ? `${n} sec` : `${n}`;
}

/** "3 x 30 sec each side", "3 x 12", plus the dose's note. */
export function targetText(dose: StabilityDose, exercise: StabilityExercise, mode: StabilityMode): string {
  const base = `${setsFor(dose, mode)} x ${unitLabel(exercise, dose.target)}${exercise.sided ? " each side" : ""}`;
  return dose.note ? `${base} (${dose.note})` : base;
}

export type StabilitySide = "left" | "right";

// What the app needs from a logged set.
export type StabilityLogLite = {
  log_date: string;
  side: StabilitySide | null;
  seconds: number | null;
  reps: number | null;
  mode: StabilityMode;
};

export function logValue(log: Pick<StabilityLogLite, "seconds" | "reps">): number {
  return log.seconds ?? log.reps ?? 0;
}

export type StabilityAssessment = {
  // Best single set ever on this program (lowest of the two sides when sided).
  best: number | null;
  // The last session's sets, e.g. "L 25, 30 · R 20, 22".
  last: string | null;
  lastDate: string | null;
  // ready: hit the target two sessions running; easier: under half the target last time.
  status: "ready" | "easier" | null;
};

/**
 * How an exercise is going. A session is one day's sets. A session "hits" when
 * every side logged has at least the planned number of sets at or above the
 * target. Two hits in a row means it's time to make it harder; a last session
 * under half the target means the easier version would build better control.
 */
export function assessExercise(
  logs: StabilityLogLite[],
  dose: StabilityDose,
  exercise: Pick<StabilityExercise, "sided">,
): StabilityAssessment {
  if (logs.length === 0) return { best: null, last: null, lastDate: null, status: null };
  const byDate = new Map<string, StabilityLogLite[]>();
  for (const l of logs) byDate.set(l.log_date, [...(byDate.get(l.log_date) ?? []), l]);
  const dates = [...byDate.keys()].sort().reverse();
  const sidesOf = (rows: StabilityLogLite[]) =>
    exercise.sided ? (["left", "right"] as const).map((s) => rows.filter((r) => r.side === s)).filter((r) => r.length > 0) : [rows];

  const hits = (rows: StabilityLogLite[]) => {
    const groups = sidesOf(rows);
    if (exercise.sided && groups.length < 2) return false;
    return groups.every((g) => g.filter((r) => logValue(r) >= dose.target).length >= setsFor(dose, g[0].mode));
  };

  const bestOf = (rows: StabilityLogLite[]) => {
    const groups = sidesOf(rows);
    return groups.length === 0 ? 0 : Math.min(...groups.map((g) => Math.max(...g.map(logValue))));
  };

  const lastRows = byDate.get(dates[0])!;
  const last = exercise.sided
    ? (["left", "right"] as const)
        .map((s) => {
          const vals = lastRows.filter((r) => r.side === s).map(logValue);
          return vals.length ? `${s === "left" ? "L" : "R"} ${vals.join(", ")}` : null;
        })
        .filter(Boolean)
        .join(" · ")
    : lastRows.map(logValue).join(", ");

  let status: StabilityAssessment["status"] = null;
  if (dates.length >= 2 && hits(lastRows) && hits(byDate.get(dates[1])!)) status = "ready";
  else if (bestOf(lastRows) < dose.target / 2) status = "easier";

  return { best: Math.max(...dates.map((dt) => bestOf(byDate.get(dt)!))), last, lastDate: dates[0], status };
}
