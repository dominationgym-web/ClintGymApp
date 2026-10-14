import type { StabilityArea, StabilityDose, StabilityLevel, StabilityPhase, StabilityProgram } from "./types";

export const LEVELS: { level: StabilityLevel; label: string; weeks: number; icon: string; colour: string }[] = [
  { level: "rehab", label: "Rehab", weeks: 8, icon: "🩹", colour: "#38BDF8" },
  { level: "beginner", label: "Beginner", weeks: 4, icon: "🟢", colour: "#22C55E" },
  { level: "intermediate", label: "Intermediate", weeks: 6, icon: "🟠", colour: "#F59E0B" },
  { level: "advanced", label: "Advanced", weeks: 6, icon: "🔴", colour: "#EF4444" },
];

export function levelInfo(level: StabilityLevel) {
  return LEVELS.find((l) => l.level === level)!;
}

// How hard and how heavy, per level. Areas add their own line on top.
export const LEVEL_RESISTANCE: Record<StabilityLevel, string> = {
  rehab:
    "Start gently. Holds at about half your effort (5 out of 10) in weeks 1-2, working up to 7 out of 10 by weeks 3-4. Use bodyweight or the lightest band. Some discomfort is fine up to 3 out of 10, as long as it settles within an hour and isn't worse the next morning. If it is, go back to what felt fine for a few sessions.",
  beginner:
    "Bodyweight or a light band (yellow or red). Each set should feel like 5-6 out of 10: you finish with perfect form and could do a few more. Slow and controlled: about 2 seconds up and 2-3 seconds down on reps.",
  intermediate:
    "A medium band (green or blue), light weights (2-10 kg), or a harder position: a cushion or folded towel under you, eyes closed, a smaller base. Each set should feel like 7 out of 10: the last reps or seconds are hard but still clean.",
  advanced:
    "A heavy band, heavier weights, and speed: hops, landings, catches and pushes. Each set should feel like 8 out of 10. Quality comes first: a fast rep that wobbles doesn't count, so stop the set there.",
};

export const LEVEL_PROGRESSION: Record<StabilityLevel, string> = {
  rehab:
    "Move on to the next phase when its week comes AND you can do the current targets with pain no higher than 3 out of 10 and nothing worse the next morning. If not, stay in the phase another week: healing tissue can't be rushed. Inside a phase, add time or reps first, then effort, never both on the same day.",
  beginner:
    "When you hit the target on every set, without losing control, in two sessions in a row, make that exercise harder by one step (the Harder line on the exercise). Add time or reps first, then a harder position, then load. Change one thing at a time.",
  intermediate:
    "Hit every set's target with clean control in two sessions in a row, then make it harder by one step. Order: more time or reps, then a harder position (smaller base, eyes closed, softer surface), then more load. If you lose control before half the target, go one step easier.",
  advanced:
    "Hit every set's target with clean control in two sessions in a row, then progress: more load first, then more speed or a less predictable version (a partner pushing you, catching a ball, changing direction). Keep the reps low and crisp. On a day you feel flat, drop a set rather than grinding.",
};

export const LEVEL_HOW_OFTEN: Record<StabilityLevel, string> = {
  rehab:
    "Full session 4 days a week. The gentle holds in weeks 1-2 can be done every day. The primer (the exercises marked ⚡) is a 5-minute version for days you don't do the full session.",
  beginner:
    "Full session 3 times a week on non-consecutive days: on rest days or after your workout. Before every workout, do the primer (the exercises marked ⚡): about 8 minutes, and it warms the area up properly.",
  intermediate:
    "Full session 3 times a week on non-consecutive days: on rest days or after your workout. Before every workout, do the primer (the exercises marked ⚡): about 8-10 minutes.",
  advanced:
    "Full session 2-3 times a week, at least 48 hours apart, and not right before a heavy session for the same area. Before every workout, do the primer (the exercises marked ⚡): about 10 minutes.",
};

/** One line of a phase: `d("sl_balance", 3, 30, { primer: true })`. */
export function d(ex: string, sets: number, target: number, extra: Omit<StabilityDose, "ex" | "sets" | "target"> = {}): StabilityDose {
  return { ex, sets, target, ...extra };
}

export function phase(from: number, to: number, title: string, focus: string, items: StabilityDose[]): StabilityPhase {
  return { from, to, title, focus, items };
}

export function program(
  area: StabilityArea,
  level: StabilityLevel,
  p: { who: string; goal: string; resistance?: string; howOften?: string; finishTest: string; phases: StabilityPhase[] },
): StabilityProgram {
  return {
    area,
    level,
    weeks: levelInfo(level).weeks,
    who: p.who,
    goal: p.goal,
    howOften: p.howOften ?? LEVEL_HOW_OFTEN[level],
    resistance: p.resistance ? `${LEVEL_RESISTANCE[level]} ${p.resistance}` : LEVEL_RESISTANCE[level],
    progression: LEVEL_PROGRESSION[level],
    phases: p.phases,
    finishTest: p.finishTest,
  };
}

// For every area: what counts as losing control, the pain rule and how to log.
export const STABILITY_BASICS: { heading: string; icon: string; points: string[] }[] = [
  {
    heading: "What stability training is",
    icon: "🧱",
    points: [
      "Stability is your body's ability to hold a joint in a safe position while something tries to move it: your weight, a load, a landing, a push. Most injuries happen in the split second a joint loses that control: the ankle rolls, the knee caves in, the lower back bends under load.",
      "These programs train that control directly, from the ground up: ankle, knee, hip, core, shoulder, wrist and neck. Research on programs like these (FIFA 11+, balance training after ankle sprains, the Copenhagen adductor and Nordic hamstring programs, neck strengthening in contact sports) shows injury rates dropping by roughly a third to a half when they're done consistently.",
      "Consistency beats intensity. Two or three short sessions a week for 6-8 weeks change how the joint behaves. A single hard session does very little.",
    ],
  },
  {
    heading: "Losing control: when to stop the clock",
    icon: "⏱️",
    points: [
      "Every exercise is logged as either seconds held or reps done BEFORE you lost control. Each exercise tells you exactly what losing control looks like for it.",
      "The usual signs: you wobble and have to touch down or grab something, the joint drifts out of line (a knee caving in, a hip dropping, a shoulder shrugging up), you start holding your breath, or the movement gets fast and jerky.",
      "Stop the set the moment it happens and log what you got. Five clean seconds are worth more than thirty sloppy ones: the sloppy ones train the very pattern that gets people hurt.",
    ],
  },
  {
    heading: "The pain rule",
    icon: "🚦",
    points: [
      "0-2 out of 10: green. Carry on.",
      "3-5 out of 10: amber. OK during rehab exercises only if it settles within an hour and isn't worse the next morning. Otherwise ease off: less time, less effort or an easier version.",
      "Above 5, sharp or catching pain, pins and needles, or swelling the next day: red. Stop that exercise and tell your coach. See a doctor or physio if it doesn't settle.",
    ],
  },
  {
    heading: "How to log and how the app helps",
    icon: "📝",
    points: [
      "Open an exercise, do the set, then type the seconds or reps. For holds you can tap Start on the timer and Stop the moment you lose control. Exercises done on each side have a left and a right box: differences between sides are worth knowing.",
      "When you've hit the target on every set in two sessions in a row, the app shows ⬆ Ready to make it harder. If you're getting less than half the target, it suggests the easier version.",
      "Your coach can see what you log, so they can spot a weak side or a stall early.",
    ],
  },
];
