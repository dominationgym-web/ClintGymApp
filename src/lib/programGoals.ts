import type { Program } from "@/types/database";

// Putting a program on (GRIZZ, 2026-10-20: "the training and program
// selection is still confusing ... Let's try all"): the trainer picks the
// client's goal, and the app shows the program that fits their level first,
// with the goal's other programs under it. Eight goals in place of the old
// groups and headings. Rehab keeps its own area and level steps.

export type ProgramGoal = "muscle" | "strength" | "fatLoss" | "fitness" | "sport" | "mobility" | "longevity" | "own";
export type GoalChoice = ProgramGoal | "rehab";

export const PROGRAM_GOALS: { key: GoalChoice; title: string; icon: string; summary: string }[] = [
  { key: "muscle", title: "Build muscle", icon: "💪", summary: "Bodybuilding programs, 1-year muscle building (3, 4 or 5 days), full body weeks" },
  { key: "strength", title: "Get stronger", icon: "🏋️", summary: "Strength programs" },
  { key: "fatLoss", title: "Fat loss", icon: "🔥", summary: "Fat loss programs" },
  { key: "fitness", title: "Fitness", icon: "❤️", summary: "General fitness and conditioning" },
  { key: "sport", title: "Sport", icon: "⚡", summary: "Sports strength, power, speed, fight sports and off-season programs" },
  { key: "mobility", title: "Mobility & flexibility", icon: "🧘", summary: "Move better and loosen up" },
  { key: "longevity", title: "60+ Longevity", icon: "🌳", summary: "Strength, balance and independence for older adults" },
  { key: "rehab", title: "Rehab", icon: "🛡️", summary: "Ankle, knee, hip, core, shoulder, wrist or neck" },
  { key: "own", title: "Your programs", icon: "⭐", summary: "Programs you built" },
];

/** Which goal a whole program belongs to, from its name. */
export function programGoal(program: Pick<Program, "name" | "trainer_id">): ProgramGoal {
  if (program.trainer_id) return "own";
  const name = program.name.toLowerCase();
  if (name.startsWith("older adult ")) return "longevity";
  if (name.startsWith("muscle year")) return "muscle";
  if (name.startsWith("mobility ") || name.startsWith("flexibility ")) return "mobility";
  if (/^(explosive power|speed |sports strength|fight conditioning|off-season|12-week (strength|endurance|speed) –)/.test(name)) return "sport";
  if (name.includes("bodybuilding")) return "muscle";
  if (name.includes("strength")) return "strength";
  if (name.includes("fat loss") || name.includes("weight loss")) return "fatLoss";
  if (name.includes("fitness") || name.startsWith("hiit") || name.startsWith("sprint")) return "fitness";
  return "muscle";
}

export type Level = "beginner" | "intermediate" | "advanced";

/** The client's level from their intake answer; never trained counts as beginner. */
export function levelOf(trainingLevel: string | null | undefined): Level | null {
  if (trainingLevel === "never" || trainingLevel === "beginner") return "beginner";
  if (trainingLevel === "intermediate" || trainingLevel === "advanced") return trainingLevel;
  return null;
}

// The best fit for each goal and level, by name.
const BEST_FIT: Record<Exclude<ProgramGoal, "own">, Record<Level, string>> = {
  muscle: {
    beginner: "Beginner Foundation - Bodybuilding",
    intermediate: "Intermediate Foundation - Bodybuilding",
    advanced: "Bodybuilding 12-week program",
  },
  strength: {
    beginner: "Beginner Foundation - Strength",
    intermediate: "Intermediate Foundation - Strength",
    advanced: "Strength 12-week program",
  },
  fatLoss: {
    beginner: "Beginner Foundation - Fat loss",
    intermediate: "Intermediate Foundation - Fat loss",
    advanced: "Fat loss 12-week program",
  },
  fitness: {
    beginner: "Beginner Foundation - Fitness",
    intermediate: "Intermediate Foundation - Fitness",
    advanced: "Intermediate Foundation - Fitness",
  },
  sport: {
    beginner: "Sports Strength 1 – Base Strength",
    intermediate: "Sports Strength 2 – Single-Leg & Athletic",
    advanced: "Sports Strength 3 – Max Strength",
  },
  mobility: {
    beginner: "Mobility 1 – Hips & Ankles",
    intermediate: "Mobility 2 – Spine & Shoulders",
    advanced: "Mobility 3 – Full-Body Flow",
  },
  longevity: {
    beginner: "Older Adult 1 - Beginner Foundation",
    intermediate: "Older Adult 2 - Strength & Stability",
    advanced: "Older Adult 3 - Functional Strength & Independence",
  },
};

/**
 * A goal's whole programs where the client trains (gym programs too when
 * there are none at home), best fit for their level first.
 */
export function programsForGoal<P extends Pick<Program, "name" | "trainer_id" | "place" | "kind">>(
  programs: P[],
  goal: ProgramGoal,
  place: string,
  level: Level | null,
): { best: P | null; others: P[] } {
  const whole = programs.filter((p) => p.kind === "weekly" && programGoal(p) === goal);
  const here = whole.filter((p) => p.place === place);
  const list = here.length > 0 ? here : whole;
  const bestName = goal === "own" ? null : BEST_FIT[goal][level ?? "beginner"];
  // Home clients may only have one choice (Home full body week): it's the best fit then.
  const best = goal === "own" ? null : (list.find((p) => p.name === bestName) ?? (here.length > 0 ? here[0] : null));
  return { best, others: list.filter((p) => p !== best).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })) };
}
