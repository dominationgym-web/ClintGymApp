// Training experience and the 6-week foundation programs (0086, 0087; GRIZZ
// 2026-10-13). New clients say how much they've trained. For all but
// Advanced the trainer is offered a Beginner or Intermediate foundation
// program for the client's goal, and approving it sends the client a note
// explaining why the first 6 weeks are foundation building.

export type TrainingLevel = "never" | "beginner" | "intermediate" | "advanced";
export type FoundationLevel = "Beginner" | "Intermediate";
export type FoundationGoal = "Bodybuilding" | "Weight loss" | "Strength" | "Fitness";

export const TRAINING_LEVELS: { key: TrainingLevel; label: string; detail: string }[] = [
  { key: "never", label: "Never trained", detail: "I've never followed a training program." },
  { key: "beginner", label: "Beginner", detail: "Less than a year of regular training." },
  { key: "intermediate", label: "Intermediate", detail: "1-3 years of regular training with good form." },
  { key: "advanced", label: "Advanced", detail: "3+ years of consistent, structured training." },
];

export const FOUNDATION_GOALS: FoundationGoal[] = ["Bodybuilding", "Weight loss", "Strength", "Fitness"];

export const levelLabel = (level: TrainingLevel | null | undefined) =>
  TRAINING_LEVELS.find((l) => l.key === level)?.label ?? "Not answered";

/** Never trained and Beginner start on Beginner; Intermediate on Intermediate; Advanced on neither. */
export function foundationLevelFor(level: TrainingLevel | null | undefined): FoundationLevel | null {
  if (level === "never" || level === "beginner") return "Beginner";
  if (level === "intermediate") return "Intermediate";
  return null;
}

/** The goal the client's intake answers point to; weight loss first, then muscle, then strength. */
export function foundationGoalFor(trainingGoals: string | null | undefined): FoundationGoal {
  const goals = (trainingGoals ?? "").toLowerCase();
  if (goals.includes("lose weight")) return "Weight loss";
  if (goals.includes("gain muscle")) return "Bodybuilding";
  if (goals.includes("get stronger")) return "Strength";
  return "Fitness";
}

export const foundationProgramName = (level: FoundationLevel, goal: FoundationGoal) => `${level} Foundation - ${goal}`;

const LEVEL_PHRASE: Record<TrainingLevel, string> = {
  never: "you're new to training",
  beginner: "you're still early in your training",
  intermediate: "you've trained before",
  advanced: "you're experienced",
};

/** The note the client gets when their trainer approves a foundation program. */
export function foundationMessage(firstName: string, level: TrainingLevel, programName: string): string {
  return [
    `Hi ${firstName}, welcome! Because ${LEVEL_PHRASE[level]}, your first 6 weeks are a foundation program: ${programName}.`,
    "Here's why we start here:",
    "• It starts the slow job of strengthening your tendons, joints and core, which keeps adapting well past these 6 weeks. That's what lets you train hard safely later.",
    "• You learn every movement with good form while the weights are still light.",
    "• It gives me time to get to know you and how your body responds, so your main program fits you properly.",
    "Weeks 1-2: learn the movements. Weeks 3-4: add a set and build. Weeks 5-6: fewer reps and heavier weights.",
    "After 6 weeks we move you onto your main program. Your first workout is waiting on your Training tab. Let's go!",
  ].join("\n\n");
}
