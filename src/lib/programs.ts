import type { ExtraCardio, Program, ProgramExercise } from "@/types/database";

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

/** A program row's session slot (0065): (week - 1) * 7 + weekday, so week 2 Monday = 8. */
export function slotOf(row: { day_number: number; week_number?: number | null }): number {
  return ((row.week_number ?? 1) - 1) * 7 + row.day_number;
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
 * ("Chest & Bi 1" to "Chest & Bi 4", "Full Body 3 x week option 1" to 5) drop the number: it's only for the
 * trainer to tell them apart.
 */
export function displayProgramName(program: Pick<Program, "name" | "trainer_id">): string {
  if (program.trainer_id) return program.name;
  return program.name.replace(/\s+(option\s+)?\d+$/i, "");
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

/** For the second half of a superset, the exercise that goes straight into it; null otherwise. */
export function supersetPrev(row: ProgramExercise, session: ProgramExercise[]): ProgramExercise | null {
  const i = session.findIndex((e) => e.id === row.id);
  const prev = i > 0 ? session[i - 1] : null;
  return prev && prev.rest_seconds === 0 && prev.kind !== "cardio" ? prev : null;
}

/**
 * Contrast pairs (0118): a heavy set, then a jump or throw. The heavy row is
 * a superset first half (rest 0) whose reps say how long to rest before the
 * partner, e.g. "3 heavy, rest 3 min, then the jump". The boost from the heavy
 * set only outweighs its fatigue after a few minutes. 0 for any other row.
 */
export function contrastRest(row: Pick<ProgramExercise, "reps">): number {
  const m = row.reps.match(/rest (\d+)(?:\s*[-–]\s*\d+)? min/i);
  return m ? Number(m[1]) * 60 : 0;
}

/**
 * What happens after a set of `row` is logged in a superset: go to the
 * partner after the first half (straight away, or after the contrast rest),
 * or back to the first half (after resting) after the second half, while the
 * partner still has sets left. Null when the row isn't in a superset or the
 * partner is finished.
 */
export function supersetStep(
  row: ProgramExercise,
  session: ProgramExercise[],
  setsDone: (row: ProgramExercise) => number,
): { go: ProgramExercise; restSeconds: number } | null {
  const next = supersetNext(row, session);
  if (next && next.kind !== "cardio" && setsDone(next) < next.sets) return { go: next, restSeconds: contrastRest(row) };
  const prev = supersetPrev(row, session);
  if (prev && setsDone(prev) < prev.sets) return { go: prev, restSeconds: row.rest_seconds };
  return null;
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

/** Warm-up sets never have more reps than this, or more than the working sets. */
export const WARM_UP_MAX_REPS = 10;

/**
 * Warm-up reps (0118): the working reps, capped at WARM_UP_MAX_REPS, so the
 * warm-up never tires the client more than a working set would: "8-10" stays
 * "8-10", "12-15" -> "10" and "15 each leg" -> "10 each leg". Timed holds
 * ("45 sec") and anything without a number get no warm-up set, so this
 * returns null.
 */
export function warmUpReps(reps: string): string | null {
  if (/sec|min/i.test(reps) || !/\d/.test(reps)) return null;
  const capped = reps.replace(/\d+/g, (n) => String(Math.min(Number(n), WARM_UP_MAX_REPS)));
  return capped.replace(/^\s*(\d+)\s*[-–]\s*\1\b/, "$1");
}

/**
 * Heavy work (8 reps or fewer at the top of the range) gets a 2-3 set ramp
 * instead of one jump to the working weight. Only the first ramp set is
 * logged; the screen describes the rest.
 */
export function needsRamp(reps: string): boolean {
  if (/sec|min/i.test(reps)) return false;
  const nums = reps.match(/\d+/g)?.map(Number) ?? [];
  return nums.length > 0 && Math.max(...nums) <= 8;
}

/**
 * Warm-up weight: about half the starting weight, rounded to the nearest
 * 2.5kg (to 0.5kg under 10kg, for light dumbbells). Null without a start.
 */
export function warmUpWeight(start: number | null | undefined): number | null {
  if (!start || start <= 0) return null;
  const half = start / 2;
  const step = start < 10 ? 0.5 : 2.5;
  return Math.max(step, Math.round(half / step) * step);
}

/** The first number of the warm-up reps, to fill in: "8-10" -> "16". */
export function warmUpRepsToFill(reps: string): string {
  const w = warmUpReps(reps);
  return w ? (w.match(/\d+/)?.[0] ?? "") : "";
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
  // Cardio blocks (0048) sit between exercises or at the end of a session.
  kind?: "exercise" | "cardio";
  exerciseId: string | null;
  exerciseName: string;
  sets: number;
  reps: string;
  restSeconds: number;
}

/** What's wrong with a program from the builder, or null when it can be saved. */
export function draftProblem(name: string, exercises: DraftExercise[]): string | null {
  if (!name.trim()) return "Give the program a name.";
  const cardio = exercises.findIndex((e) => e.kind === "cardio" && (!e.exerciseName.trim() || !e.reps.trim()));
  if (cardio !== -1) return `Choose the cardio and how long for slot ${cardio + 1}.`;
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
    const cardio = s.exercises.findIndex((e) => e.kind === "cardio" && (!e.exerciseName.trim() || !e.reps.trim()));
    if (cardio !== -1) return `${day}: choose the cardio and how long for slot ${cardio + 1}.`;
    const missing = s.exercises.findIndex((e) => !e.exerciseName);
    if (missing !== -1) return `${day}: pick an exercise for slot ${missing + 1}.`;
    const noReps = s.exercises.findIndex((e) => !e.reps.trim());
    if (noReps !== -1) return `${day}: add the reps for ${s.exercises[noReps].exerciseName}.`;
  }
  return null;
}

// Warm-up (0048): what every program starts with unless the trainer rewords it.
export const DEFAULT_WARM_UP =
  "5 minutes of easy cardio, like a light jog, brisk walk, bike or rower. Then a few easy moves for the joints you'll train, like leg swings, arm circles and bodyweight squats. Then your warm-up sets.";

// Cardio blocks (0048).
export const CARDIO_OPTIONS = ["Assault bike", "Ski Erg", "Treadmill", "Boxing", "Cycle", "Sprint"];
export const CARDIO_SECONDS = [10, 20, 30, 40, 50, 60];
// Longer blocks in minutes (GRIZZ, 2026-10-12), or the trainer types their own.
export const CARDIO_MINUTES = [5, 10, 15, 20, 30, 45];
export const MAX_CARDIO_MINUTES = 180;
// Only for the block at the very end of a session.
export const CARDIO_ALL = "All of the above";
// The name a cardio block gets when the trainer types their own.
export const CARDIO_CUSTOM = "Cardio";

export function cardioDuration(seconds: number): string {
  return `${seconds} sec`;
}

export function cardioMinutes(minutes: number): string {
  return `${minutes} min`;
}

/** The minutes in a "25 min" duration, or null for seconds and the trainer's own words. */
export function minutesOf(reps: string): number | null {
  const m = reps.match(/^(\d+) min$/);
  return m ? Number(m[1]) : null;
}

export function blankCardio(): DraftExercise {
  return { kind: "cardio", exerciseId: null, exerciseName: CARDIO_OPTIONS[0], sets: 1, reps: cardioDuration(30), restSeconds: 0 };
}

/** "Assault bike · 30 sec", "All of the above · 30 sec each", or the trainer's own words. */
export function cardioLabel(row: { exercise_name: string; reps: string }): string {
  if (row.exercise_name === CARDIO_CUSTOM) return row.reps;
  return row.exercise_name === CARDIO_ALL ? `${CARDIO_ALL} · ${row.reps} each` : `${row.exercise_name} · ${row.reps}`;
}

/**
 * Sets the number of exercises in a session to `count`, keeping its cardio
 * blocks where they are: new exercises go before any cardio at the very end,
 * and the last exercises go first when there are too many.
 */
export function resizeExercises(slots: DraftExercise[], count: number, blank: () => DraftExercise): DraftExercise[] {
  const isExercise = (s: DraftExercise) => s.kind !== "cardio";
  let current = slots.filter(isExercise).length;
  const next = [...slots];
  while (current > count) {
    let i = next.length - 1;
    while (!isExercise(next[i])) i--;
    next.splice(i, 1);
    current--;
  }
  let end = next.length;
  while (end > 0 && !isExercise(next[end - 1])) end--;
  while (current < count) {
    next.splice(end, 0, blank());
    end++;
    current++;
  }
  return next;
}

/**
 * A program's rows with the cardio the trainer added for one client (0054)
 * slotted into every training day: after the `after`th exercise (never
 * between the two halves of a superset), or at the end when `after` is null
 * or the day has fewer exercises.
 */
export function withExtraCardio(rows: ProgramExercise[], extras: ExtraCardio[] | null | undefined): ProgramExercise[] {
  if (!extras?.length) return rows;
  const days = [...new Set(rows.map(slotOf))].sort((a, b) => a - b);
  return days.flatMap((day) => {
    const session = rows.filter((r) => slotOf(r) === day).sort((a, b) => a.sort_order - b.sort_order);
    const exerciseCount = session.filter((r) => r.kind !== "cardio").length;
    if (exerciseCount === 0) return session;
    // Blocks for the same spot keep the order the trainer added them in.
    const placed = extras.map((extra, i) => ({ extra, i, after: extra.after == null ? exerciseCount : Math.min(extra.after, exerciseCount) }));
    const out: ProgramExercise[] = [];
    let seen = 0;
    const flush = (upTo: number) => {
      for (const { extra, i } of placed.filter((p) => p.after === upTo)) {
        out.push({
          id: `extra-cardio-${i}-day-${day}`,
          program_id: session[0].program_id,
          day_number: session[0].day_number,
          week_number: session[0].week_number ?? 1,
          sort_order: (out[out.length - 1]?.sort_order ?? 0) + 0.001,
          exercise_id: null,
          exercise_name: extra.name,
          sets: 1,
          reps: extra.reps,
          rest_seconds: 0,
          kind: "cardio",
        });
      }
    };
    session.forEach((row, index) => {
      out.push(row);
      if (row.kind === "cardio") return;
      seen++;
      const next = session[index + 1];
      const supersetContinues = row.rest_seconds === 0 && next && next.kind !== "cardio";
      if (supersetContinues) return;
      // Anything due inside the superset comes out after it.
      const due = placed.filter((p) => p.after <= seen && p.after > seen - supersetRun(session, index)).map((p) => p.after);
      for (const at of [...new Set(due)].sort((a, b) => a - b)) flush(at);
    });
    return out;
  });
}

// How many exercises in a row end at `index` (1 unless it closes a superset).
function supersetRun(session: ProgramExercise[], index: number): number {
  let run = 1;
  for (let i = index - 1; i >= 0 && session[i].kind !== "cardio" && session[i].rest_seconds === 0; i--) run++;
  return run;
}

// The three groups every program list is split into (GRIZZ, 2026-10-14:
// "Performance, Gym, Functional" to declutter). Each holds tap-to-open
// family headings below.
export const PROGRAM_GROUPS = [
  {
    key: "gym",
    title: "Gym",
    homeTitle: "Home",
    icon: "🏋️",
    homeIcon: "🏠",
    summary: "Foundations, 12-week goals, full body, splits and your own",
  },
  {
    key: "performance",
    title: "Performance",
    icon: "⚡",
    summary: "Power, speed, sports strength, HIIT, sprints, fight conditioning and off-season sport programs",
  },
  {
    key: "functional",
    title: "Functional",
    icon: "🧘",
    summary: "Stability, mobility and flexibility",
  },
  // Older adult programs (GRIZZ, 2026-10-20: "put it in its own section").
  {
    key: "longevity",
    title: "Longevity (60+)",
    icon: "🌳",
    summary: "Strength, balance and independence for older adults",
  },
] as const;

export type ProgramGroup = (typeof PROGRAM_GROUPS)[number]["key"];

/** A group's heading for the gym or home tab ("Gym" becomes "Home"). */
export function programGroupHeading(group: (typeof PROGRAM_GROUPS)[number], place: "gym" | "home") {
  if (place === "home" && "homeTitle" in group) return { title: group.homeTitle, icon: group.homeIcon };
  return { title: group.title, icon: group.icon };
}

// The headings programs sit under, in order, each inside one group.
export const PROGRAM_FAMILIES = [
  { key: "foundation", group: "gym", title: "Beginner & Intermediate", icon: "🌱" },
  { key: "goalBlock", group: "gym", title: "12-week goal programs", icon: "🎯" },
  { key: "fullBody", group: "gym", title: "Full body", icon: "🏃" },
  { key: "upperBody", group: "gym", title: "Upper body workouts", icon: "💪" },
  { key: "lowerBody", group: "gym", title: "Lower body workouts", icon: "🦵" },
  { key: "upperLower", group: "gym", title: "Quick upper & lower", icon: "⏱️" },
  { key: "chestBi", group: "gym", title: "Chest & Bi", icon: "🏋️" },
  { key: "backTri", group: "gym", title: "Back & Tri", icon: "🦾" },
  { key: "legs", group: "gym", title: "Legs", icon: "🦵" },
  { key: "dropset", group: "gym", title: "Drop sets (intermediate & advanced)", icon: "⬇️" },
  { key: "own", group: "gym", title: "Your programs", icon: "⭐" },
  { key: "sportsPower", group: "performance", title: "Explosive power", icon: "💥" },
  { key: "sportsSpeed", group: "performance", title: "Speed", icon: "🚀" },
  { key: "sportsStrength", group: "performance", title: "Sports strength", icon: "🏆" },
  { key: "hiit", group: "performance", title: "HIIT", icon: "🔥" },
  { key: "sprint", group: "performance", title: "Sprint & threshold intervals", icon: "⚡" },
  { key: "fight", group: "performance", title: "Fight sports: 8-week conditioning", icon: "🥊" },
  { key: "offSeason", group: "performance", title: "Off-season: 8-week sport programs", icon: "🏟️" },
  { key: "sportsMobility", group: "functional", title: "Mobility", icon: "🔄" },
  { key: "sportsFlexibility", group: "functional", title: "Flexibility", icon: "🧘" },
  { key: "olderAdult", group: "longevity", title: "Strength, mobility & longevity: 18 months", icon: "🌳" },
] as const;

export type ProgramFamily = (typeof PROGRAM_FAMILIES)[number]["key"];

/**
 * Mobility, flexibility and other Functional programs: shown in their own
 * teal on the calendar so clients can tell them from their training (GRIZZ,
 * 2026-10-18).
 */
export function isFunctionalProgram(program: Pick<Program, "name" | "trainer_id">): boolean {
  const family = programFamily(program);
  return PROGRAM_FAMILIES.some((f) => f.key === family && f.group === "functional");
}

/** Which heading a program sits under in the popup, from its name. */
export function programFamily(program: Pick<Program, "name" | "trainer_id">): ProgramFamily {
  if (program.trainer_id) return "own";
  const name = program.name.toLowerCase();
  // Sports Performance programs (0093): "Speed 2 – Top Speed". Checked first,
  // since some of their names say "strength" or "lower body".
  // Older adult programs (0130): "Older Adult 1 - Beginner Foundation". Before
  // the foundation check, since the first one's name says foundation.
  if (name.startsWith("older adult ")) return "olderAdult";
  // Off-season sport programs (0144): "Off-Season – Rugby". Checked early,
  // since their sport names don't fit the checks below.
  if (name.startsWith("off-season")) return "offSeason";
  if (name.startsWith("explosive power ")) return "sportsPower";
  if (name.startsWith("speed ")) return "sportsSpeed";
  if (name.startsWith("sports strength ")) return "sportsStrength";
  if (name.startsWith("mobility ")) return "sportsMobility";
  if (name.startsWith("flexibility ")) return "sportsFlexibility";
  // Drop set programs (0099, GRIZZ, 2026-10-16): "Drop Set Chest 1". Before
  // the chest/back checks below, since their names say chest and back.
  if (name.startsWith("drop set")) return "dropset";
  // 6-week foundation programs (0086): "Beginner Foundation - Strength".
  if (name.includes("foundation")) return "foundation";
  // The 15 + 15 calendar workouts (0069): "Upper Body 1", "Lower Body Superset 2".
  if (name.startsWith("upper body")) return "upperBody";
  if (name.startsWith("lower body")) return "lowerBody";
  if (name.includes("12-week") || name.includes("3-week")) return "goalBlock";
  if (name.startsWith("hiit")) return "hiit";
  // 10 cardio interval sessions (0090): "Sprint Intervals 3".
  if (name.startsWith("sprint intervals")) return "sprint";
  // 8-week combat sport programs (0091): "Fight Conditioning – Boxing".
  if (name.startsWith("fight conditioning")) return "fight";
  if (name.includes("chest")) return "chestBi";
  if (name.includes("back")) return "backTri";
  if (name.includes("legs")) return "legs";
  if (name.includes("upper") || name.includes("lower")) return "upperLower";
  return "fullBody";
}
