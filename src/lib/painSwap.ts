import type { ClientExercisePain } from "@/types/database";
import { checkRisks, exerciseRisks } from "@/lib/injuryRisk";
import type { StabilityArea } from "@/lib/stability";
import { swapGroup, TRAINER_ONLY_CATEGORIES } from "@/lib/exerciseFilter";

// "This hurts" (GRIZZ, 2026-10-20): so many muscles can cause shoulder
// problems that a blanket "shoulder injury" flag isn't much use. Instead the
// client says which exercise hurts during the workout, and gets the same
// movement at a kinder angle or grip to try: an overhead or incline press
// that hurts becomes a flat press, a wide-grip pulldown a neutral-grip one.
// If that one hurts too they tap it again and the next step down is offered.
// Every report is kept so the trainer sees which movements hurt and what
// worked instead.

/** Where it hurts, in the order the client sees them. */
export const PAIN_AREAS: StabilityArea[] = ["shoulder", "wrist", "core", "hip", "knee", "ankle", "neck"];

const AREA_LABELS: Record<StabilityArea, string> = {
  shoulder: "Shoulder",
  wrist: "Wrist or elbow",
  core: "Lower back",
  hip: "Hip",
  knee: "Knee",
  ankle: "Ankle or foot",
  neck: "Neck",
};

export function painAreaLabel(area: string): string {
  return AREA_LABELS[area as StabilityArea] ?? area;
}

type ShoulderMove = {
  /** The movement that hurt. */
  match: RegExp;
  /** What to try instead, best first, and why it's kinder on the shoulder. */
  tries: { name: RegExp; why: string }[];
  /** How to do the new one so it stays comfortable. */
  tip: string;
};

const OVERHEAD = /overhead|military|arnold|push press|shoulder press|z-press|behind-the-neck|clean and press|cuban/;
const INCLINE = /incline (barbell|dumbbell|machine|bench)|incline.*press|high incline/;

const LANDMINE = { name: /landmine press/, why: "presses up and forward, not straight overhead" };
const INCLINE_DB = { name: /^incline (dumbbell|machine chest) press$/, why: "less overhead angle" };
const FLAT_DB = { name: /^(flat dumbbell press|neutral-grip dumbbell bench press)$/, why: "flat, so the shoulder isn't pushed overhead" };
const MACHINE_FLAT = { name: /^(machine chest press|cable chest press)$/, why: "a fixed path, with no balancing" };
const NEUTRAL_DB = { name: /^neutral-grip dumbbell bench press$/, why: "palms facing in, which is kinder on the front of the shoulder" };
const FLOOR = { name: /floor press/, why: "the floor stops the elbows before the shoulder stretches" };
const DECLINE = { name: /^decline machine chest press$|^dumbbell decline bench press$/, why: "the least shoulder angle of any press" };

const SHOULDER_MOVES: ShoulderMove[] = [
  {
    match: OVERHEAD,
    tries: [LANDMINE, INCLINE_DB, FLAT_DB, MACHINE_FLAT],
    tip: "Start lighter than usual and stop if it hurts again.",
  },
  {
    match: INCLINE,
    tries: [FLAT_DB, NEUTRAL_DB, MACHINE_FLAT, FLOOR],
    tip: "Keep the elbows about 45° from the body, not flared out to the side.",
  },
  {
    match: /bench press|chest press|flat dumbbell press|kettlebell bench press|^push-up$|decline push-up/,
    tries: [NEUTRAL_DB, FLOOR, DECLINE, MACHINE_FLAT],
    tip: "Keep the elbows about 45° from the body and stop the bar or dumbbells just above the chest.",
  },
  {
    match: /\bdip\b/,
    tries: [DECLINE, FLOOR, { name: /^machine tricep extension$|pushdown/, why: "works the triceps without the shoulder dropping behind the body" }],
    tip: "Use a weight you can control through the whole rep.",
  },
  {
    match: /\bfly\b|\bflye\b|pec fly|pullover/,
    tries: [
      { name: /^machine pec fly$/, why: "a machine stops the arms going too far back" },
      MACHINE_FLAT,
      NEUTRAL_DB,
    ],
    tip: "Don't let the arms go behind the line of the body.",
  },
  {
    match: /lateral raise|front raise|plate front raise|upright row/,
    tries: [
      { name: /^cable low single-arm lateral raise$|^band lateral raise$/, why: "lighter and smoother all the way up" },
      { name: /face pull/, why: "works the shoulder with the arm below shoulder height" },
      { name: /rear-delt fly|reverse fly/, why: "works the back of the shoulder instead" },
    ],
    tip: "Only lift to just below shoulder height.",
  },
  {
    match: /pull-up|chin-up|wide-grip lat pulldown|^lat pulldown$|machine pulldown|straight-arm pulldown|dead hang/,
    tries: [
      { name: /^neutral-grip lat pulldown$|^close-grip lat pulldown$/, why: "palms facing in, a kinder grip for the shoulder" },
      { name: /^chest-supported row$|^machine neutral row$/, why: "pulls in front of the body instead of overhead" },
      { name: /^seated cable row$/, why: "pulls in front of the body instead of overhead" },
    ],
    tip: "Pull the elbows down and in, and don't go into a full hang at the top.",
  },
  {
    match: /\brow\b/,
    tries: [
      { name: /^chest-supported row$|^machine neutral row$/, why: "the chest pad takes the strain off the shoulder" },
      { name: /^cable single-arm neutral-grip row$|^seated cable row$/, why: "a smooth cable with a neutral grip" },
    ],
    tip: "Stop when the elbow reaches the side of the body, not behind it.",
  },
];

type Lib = { id: string; name: string; category: string | null };

export type PainSuggestion<T extends Lib> = { exercise: T; why: string };

/**
 * Exercises to try instead of one that hurts, best first. Exercises the
 * client already said hurt are never offered again.
 */
export function painSuggestions<T extends Lib>(
  original: { id: string | null; name: string; category: string | null },
  area: StabilityArea,
  library: T[],
  hurtIds: (string | null)[] = [],
  count = 3,
): { suggestions: PainSuggestion<T>[]; tip: string } {
  const usable = library.filter(
    (e) => e.id !== original.id && !hurtIds.includes(e.id) && !(e.category && TRAINER_ONLY_CATEGORIES.includes(e.category)),
  );
  const name = original.name.toLowerCase();
  const move = area === "shoulder" ? SHOULDER_MOVES.find((m) => m.match.test(name)) : undefined;
  const picked: PainSuggestion<T>[] = [];
  if (move) {
    for (const t of move.tries) {
      const found = usable.find((e) => t.name.test(e.name.toLowerCase()) && !picked.some((p) => p.exercise.id === e.id));
      if (found) picked.push({ exercise: found, why: t.why });
      if (picked.length >= count) break;
    }
  }
  // Any other exercise, or a gap in the library: the same body part, with
  // nothing the injury check would flag for this area.
  if (picked.length < count) {
    const group = swapGroup(original.category);
    const safe = usable.filter(
      (e) =>
        swapGroup(e.category) === group &&
        !picked.some((p) => p.exercise.id === e.id) &&
        checkRisks(exerciseRisks(e, [area])).length === 0,
    );
    for (const e of safe.slice(0, count - picked.length)) picked.push({ exercise: e, why: `easier on the ${painAreaLabel(area).toLowerCase()}` });
  }
  return { suggestions: picked, tip: move?.tip ?? "Start lighter than usual and stop if it hurts again." };
}

/** The area an exercise most likely hurts, to pick first: shoulder for presses, pulls and raises. */
export function likelyPainArea(exerciseName: string, category: string | null): StabilityArea | null {
  const n = exerciseName.toLowerCase();
  if (SHOULDER_MOVES.some((m) => m.match.test(n)) || ["Overhead Press", "Shoulders", "Push", "Pull"].includes(category ?? "")) return "shoulder";
  if (["Quads", "Legs"].includes(category ?? "")) return "knee";
  if (category === "Posterior Chain") return "core";
  return null;
}

export type ExercisePain = ClientExercisePain;

/** The latest report for an exercise, so its row can say it hurt last time. */
export function lastPainFor(reports: ExercisePain[], exercise: { exercise_id: string | null; exercise_name: string }): ExercisePain | null {
  const mine = reports.filter((r) => (exercise.exercise_id ? r.exercise_id === exercise.exercise_id : r.exercise_name === exercise.exercise_name));
  return mine.sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "20 Oct", in the phone's own time zone. */
export function shortDate(timestamp: string): string {
  const d = new Date(timestamp);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
