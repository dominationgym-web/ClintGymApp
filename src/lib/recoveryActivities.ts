// The client Recovery section (GRIZZ, 2026-10-17): eight simple recovery
// activities, each with a short explanation, how to do it and how long. Plain
// data so it can be tested and searched. Kept conservative: nothing here
// replaces a doctor, and clients are told to tell their coach about pain.
import type { IconName } from "@/components/ScreenTabBar";
import { addDays } from "@/lib/programSchedule";
import { parseIsoDate } from "@/lib/dates";

// The client menu entry for the Recovery screen.
export const RECOVERY_MENU_ITEM = {
  key: "recovery",
  title: "Recovery",
  icon: "🌿",
  summary: "Sleep, hydration, breathing, cold & heat, stretching and more: do it or plan it, plus suggestions from your training.",
};

export type RecoveryActivityKey =
  | "sleep"
  | "hydration"
  | "breathing"
  | "cold_heat"
  | "stretching"
  | "foam_rolling"
  | "easy_movement"
  | "rest";

export type RecoveryActivity = {
  key: RecoveryActivityKey;
  title: string;
  tagline: string;
  /** Must also have an "-outline" variant in Ionicons. */
  icon: IconName;
  /** What it is and why it helps. */
  what: string;
  how: string[];
  /** Suggested time, shown on the card and used when it's logged. */
  minutes: number;
  durationLabel: string;
  /** When it helps most. */
  bestFor: string;
  /** Anything to be careful of. */
  careful?: string;
};

export const RECOVERY_ACTIVITIES: RecoveryActivity[] = [
  {
    key: "sleep",
    title: "Sleep",
    tagline: "Rest and repair",
    icon: "moon",
    what: "Sleep is when your muscles repair and your energy, hormones and mood reset. Nothing else you do for recovery comes close.",
    how: [
      "Aim for 7 to 9 hours, going to bed and waking up at the same times.",
      "Screens off and lights low for the last 30 to 60 minutes.",
      "Keep the room cool, dark and quiet.",
      "No caffeine after lunchtime, and keep alcohol low.",
    ],
    minutes: 30,
    durationLabel: "An early night (30+ min more)",
    bestFor: "Feeling tired, flat or sore, after a hard week, or when sleep has been short.",
  },
  {
    key: "hydration",
    title: "Hydration",
    tagline: "Replace fluid losses",
    icon: "water",
    what: "Sweat costs you water and salts. Replacing them helps you recover, think clearly and train well next time.",
    how: [
      "Drink a glass or two of water in the hour after training.",
      "Sip through the day: pale yellow urine means you're on track.",
      "After a long or very sweaty session, add electrolytes or a pinch of salt with food.",
    ],
    minutes: 5,
    durationLabel: "Through the day",
    bestFor: "After big or sweaty sessions, hot days, and after alcohol.",
  },
  {
    key: "breathing",
    title: "Breathing",
    tagline: "Relax and unwind",
    icon: "leaf",
    what: "Slow breathing switches your body from 'go' to 'rest and recover', which helps sleep, stress and recovery.",
    how: [
      "Sit or lie down somewhere quiet.",
      "Breathe in through your nose for 4 seconds.",
      "Breathe out slowly through your mouth for 6 to 8 seconds.",
      "Repeat for 5 minutes. Before bed is a great time.",
    ],
    minutes: 5,
    durationLabel: "5 minutes",
    bestFor: "Stress, a busy mind, trouble falling asleep, or straight after a hard session.",
  },
  {
    key: "cold_heat",
    title: "Cold & heat",
    tagline: "Sauna and cold water",
    icon: "thermometer",
    what: "A sauna or warm bath relaxes tight muscles. A cold shower or cold water dip can ease soreness and help you feel fresh.",
    how: [
      "Heat: 10 to 20 minutes in a sauna or warm bath, then rehydrate.",
      "Cold: 2 to 5 minutes in a cold shower or cold water, breathing slowly.",
      "Contrast: swap warm and cold a few times, finishing on cold.",
    ],
    minutes: 15,
    durationLabel: "10-20 minutes",
    bestFor: "Sore legs after a big session, stiffness, or a lift in energy on a rest day.",
    careful:
      "Building muscle? Leave cold water until at least 4 hours after weights, as straight after it can blunt your gains. Skip sauna and cold water if you're unwell, pregnant or have a heart or blood pressure condition unless your doctor says it's fine.",
  },
  {
    key: "stretching",
    title: "Stretching & mobility",
    tagline: "Move freely",
    icon: "body",
    what: "Gentle stretching and mobility keep your joints moving well and ease stiffness after training.",
    how: [
      "Move each joint through its full range slowly: hips, shoulders, back, ankles.",
      "Hold easy stretches for 20 to 30 seconds, breathing out into them.",
      "Stretch to mild tension, never pain.",
    ],
    minutes: 10,
    durationLabel: "10 minutes",
    bestFor: "Stiffness, long days sitting, or a niggle that feels better when you move.",
    careful: "Sharp pain, swelling or pain that's getting worse: stop and tell your coach.",
  },
  {
    key: "foam_rolling",
    title: "Foam rolling",
    tagline: "Ease tight muscles",
    icon: "fitness",
    what: "Rolling or a massage loosens tight muscles and can take the edge off soreness after hard training.",
    how: [
      "Roll slowly over the muscles you trained, about 1 minute each.",
      "Pause on tight spots and breathe for 20 to 30 seconds.",
      "Keep it firm but not painful, and avoid rolling over joints or bones.",
    ],
    minutes: 10,
    durationLabel: "10 minutes",
    bestFor: "The day after a hard or heavy session, or tight legs, back or chest.",
  },
  {
    key: "easy_movement",
    title: "Easy movement",
    tagline: "Walk, swim or cycle",
    icon: "walk",
    what: "Light movement gets blood flowing to tired muscles, which helps them recover faster than sitting still.",
    how: [
      "Go for an easy walk, swim or bike ride.",
      "Keep it easy: you should be able to chat the whole time.",
      "20 to 30 minutes is plenty.",
    ],
    minutes: 25,
    durationLabel: "20-30 minutes",
    bestFor: "Rest days, after several training days in a row, or when you feel stiff and sluggish.",
  },
  {
    key: "rest",
    title: "Rest & recharge",
    tagline: "A proper day off",
    icon: "cafe",
    what: "Sometimes the best thing for your progress is a real day off: no training, time with people you love, maybe a nap.",
    how: [
      "Take the day off training without guilt. Rest is part of the program.",
      "A 20-minute nap in the early afternoon can top up your energy.",
      "Do something you enjoy that relaxes you.",
    ],
    minutes: 20,
    durationLabel: "A day off",
    bestFor: "Feeling run down, mentally drained, or after training many days in a row.",
  },
];

export function findRecoveryActivity(key: string | null | undefined): RecoveryActivity | undefined {
  return RECOVERY_ACTIVITIES.find((a) => a.key === key);
}

/** Short name for a calendar day, like "Breathing". */
export function recoveryShortName(key: string): string {
  const short: Partial<Record<RecoveryActivityKey, string>> = {
    stretching: "Stretch",
    foam_rolling: "Foam roll",
    easy_movement: "Easy move",
    cold_heat: "Cold/heat",
    rest: "Rest",
  };
  return short[key as RecoveryActivityKey] ?? findRecoveryActivity(key)?.title ?? key;
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Days a recovery activity can be planned for: "Today", "Tomorrow", "Mon 20"... */
export function planDayChoices(today: string, days = 7): { date: string; label: string }[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i);
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : `${WEEKDAY_SHORT[parseIsoDate(date).getDay()]} ${Number(date.slice(8))}`;
    return { date, label };
  });
}

/** "Today", "Tomorrow", "Yesterday" or "Mon 20". */
export function dayLabel(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  if (date === addDays(today, -1)) return "Yesterday";
  return `${WEEKDAY_SHORT[parseIsoDate(date).getDay()]} ${Number(date.slice(8))}`;
}
