// Stability & injury prevention programs (GRIZZ, 2026-10-14): seven areas from
// the ground up (ankle, knee, hip, core, shoulder, wrist, neck), each with a
// Rehab, Beginner, Intermediate and Advanced program of 4-8 weeks. Every
// exercise is measured the way stability is tested: how long you can hold the
// position, or how many reps you can do, before you lose control.

export type StabilityArea = "ankle" | "knee" | "hip" | "core" | "shoulder" | "wrist" | "neck";
export type StabilityLevel = "rehab" | "beginner" | "intermediate" | "advanced";
// primer = the short version before a workout; full = the in-depth session.
export type StabilityMode = "primer" | "full";

export type StabilityExercise = {
  key: string;
  name: string;
  // The exercise library name, when there is a demo clip for it.
  video?: string;
  // No clip: a short YouTube search for examples, e.g. "copenhagen plank".
  search?: string;
  // hold: log seconds held; reps: log reps done before control was lost.
  measure: "hold" | "reps";
  // Done on each side (left and right are logged separately).
  sided: boolean;
  steps: string[];
  // When to stop the clock or stop counting.
  lossOfControl: string;
  // What load or band to use, and how hard it should feel.
  resistance: string;
  easier: string;
  harder: string;
};

export type StabilityDose = {
  ex: string;
  sets: number;
  // Seconds for holds, reps for rep exercises (per side when sided).
  target: number;
  // Shown with the target, e.g. "3 sec down" or "eyes closed".
  note?: string;
  // Part of the short before-a-workout version.
  primer?: boolean;
};

export type StabilityPhase = {
  // First and last week of the phase.
  from: number;
  to: number;
  title: string;
  focus: string;
  items: StabilityDose[];
};

export type StabilityProgram = {
  area: StabilityArea;
  level: StabilityLevel;
  weeks: number;
  // Who it is for, in a sentence or two.
  who: string;
  goal: string;
  // How often to do the full session and the primer.
  howOften: string;
  // How hard and how heavy, for this level.
  resistance: string;
  // How to move on, for this level.
  progression: string;
  phases: StabilityPhase[];
  // The test to pass before moving up a level.
  finishTest: string;
};

export type StabilityAreaGuide = {
  area: StabilityArea;
  title: string;
  icon: string;
  accent: string;
  summary: string;
  // What the research says and why this area matters.
  why: string[];
  // How to pick a level: one line per level.
  chooseLevel: Record<StabilityLevel, string>;
  // Stop and see a doctor or physio if any of these happen.
  redFlags: string[];
  exercises: StabilityExercise[];
  programs: StabilityProgram[];
};
