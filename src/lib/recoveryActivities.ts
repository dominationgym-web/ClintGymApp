// The client Recovery section (GRIZZ, 2026-10-17, blended with his ChatGPT
// structure): eight activities, each with a short explanation, duration,
// benefits and safety, three ready-made programs and why recovery matters.
// Plain data so it can be tested and searched. Kept conservative: nothing
// here replaces a doctor, and clients are told to tell their coach about pain.
import type { IconName } from "@/components/ScreenTabBar";
import { addDays } from "@/lib/programSchedule";
import { parseIsoDate } from "@/lib/dates";

// The client menu entry for the Recovery screen.
export const RECOVERY_MENU_ITEM = {
  key: "recovery",
  title: "Recovery",
  icon: "🌿",
  summary: "Sleep, hydration, breathing, mobility, cold and sauna: three ready-made programs, plan it or log it, plus suggestions from your training.",
};

export type RecoveryActivityKey =
  | "sleep"
  | "hydration"
  | "easy_movement"
  | "breathing"
  | "stretching"
  | "foam_rolling"
  | "cold"
  | "sauna";

export type RecoveryActivity = {
  key: RecoveryActivityKey;
  title: string;
  tagline: string;
  /** Must also have an "-outline" variant in Ionicons. */
  icon: IconName;
  /** Short explanation. */
  what: string;
  /** Main benefits. */
  benefits: string;
  how: string[];
  /** Default minutes when it's logged. */
  minutes: number;
  durationLabel: string;
  safety: string;
};

// GRIZZ's eight categories (ChatGPT structure, 2026-10-17), condensed.
export const RECOVERY_ACTIVITIES: RecoveryActivity[] = [
  {
    key: "sleep",
    title: "Sleep",
    tagline: "Rest and repair",
    icon: "moon",
    what: "Sleep is when your muscles repair and your energy, hormones and mood reset.",
    benefits: "Physical and mental recovery.",
    how: ["Same bedtime and wake time every day.", "Screens off and lights low for the last 30-60 minutes.", "Cool, dark, quiet room; last caffeine at least 8 hours before bed."],
    minutes: 480,
    durationLabel: "7-9 hours a night",
    safety: "Still tired after good sleep for weeks? Tell your coach or see a doctor.",
  },
  {
    key: "hydration",
    title: "Hydration & nutrition",
    tagline: "Refuel and rehydrate",
    icon: "water",
    what: "Replace the fluid you sweat out and give your body the protein and carbs it needs to rebuild.",
    benefits: "Replenish fluids, energy and protein.",
    how: ["A glass or two of water in the hour after training.", "A protein-rich meal with some carbs within a few hours.", "After a long, sweaty session add electrolytes or a pinch of salt."],
    minutes: 10,
    durationLabel: "After training, as needed",
    safety: "Don't force huge amounts of water: drink to thirst and aim for pale yellow urine.",
  },
  {
    key: "easy_movement",
    title: "Active recovery",
    tagline: "Walk, swim or cycle",
    icon: "walk",
    what: "Easy movement gets blood flowing to tired muscles, so they recover faster than sitting still.",
    benefits: "Gentle movement and stiffness relief.",
    how: ["An easy walk, swim or bike ride.", "Keep it easy enough to chat the whole time."],
    minutes: 20,
    durationLabel: "10-30 minutes",
    safety: "This is not a workout. If it feels hard, slow down.",
  },
  {
    key: "breathing",
    title: "Breathing & relaxation",
    tagline: "Relax and unwind",
    icon: "leaf",
    what: "Slow breathing switches your body from 'go' to 'rest and recover'.",
    benefits: "Manage stress and unwind.",
    how: ["Sit or lie somewhere quiet.", "Breathe in through your nose for 4 seconds, out slowly for 6-8.", "Keep going for 5-10 minutes. Before bed works well."],
    minutes: 5,
    durationLabel: "5-10 minutes",
    safety: "Feel dizzy? Breathe normally for a minute, then slow down again.",
  },
  {
    key: "stretching",
    title: "Mobility & stretching",
    tagline: "Move freely",
    icon: "body",
    what: "Gentle mobility and stretching keep your joints moving well and ease stiffness.",
    benefits: "Improve range of motion.",
    how: ["Move hips, shoulders, back and ankles slowly through their full range.", "Hold easy stretches 20-30 seconds, breathing out into them."],
    minutes: 10,
    durationLabel: "5-15 minutes",
    safety: "Stretch to mild tension, never pain. Sharp or worsening pain: stop and tell your coach.",
  },
  {
    key: "foam_rolling",
    title: "Massage & foam rolling",
    tagline: "Ease tight muscles",
    icon: "fitness",
    what: "Rolling or massage loosens tight muscles and takes the edge off soreness.",
    benefits: "Reduce soreness.",
    how: ["Roll slowly over the muscles you trained, about a minute each.", "Pause on tight spots and breathe for 20-30 seconds."],
    minutes: 10,
    durationLabel: "5-15 minutes",
    safety: "Firm, not painful. Don't roll over joints, bones, bruises or injuries.",
  },
  {
    key: "cold",
    title: "Cold shower / ice bath",
    tagline: "Cool down",
    icon: "snow",
    what: "Cold water can ease soreness and help you feel fresh, especially when you need to recover fast.",
    benefits: "Short-term soreness relief. Use it now and then, not after every session.",
    how: ["Cold shower: 1-3 minutes, breathing slowly.", "Ice bath: start short and build up to 5-10 minutes."],
    minutes: 5,
    durationLabel: "Shower 1-3 min, ice bath 5-10 min",
    safety: "Building muscle? Wait 4+ hours after weights, as cold straight after can blunt gains. Skip it if you're unwell, pregnant or have a heart or blood pressure condition unless your doctor says it's fine. Never alone in an ice bath.",
  },
  {
    key: "sauna",
    title: "Sauna / heat",
    tagline: "Relax and warm up",
    icon: "flame",
    what: "A sauna or warm bath relaxes tight muscles and helps you unwind.",
    benefits: "Relaxation and heat exposure.",
    how: ["Start with 5-10 minutes and build up slowly.", "Rehydrate well afterwards."],
    minutes: 10,
    durationLabel: "Start with 5-10 minutes",
    safety: "Get out if you feel dizzy or sick. No alcohol before. Skip it if you're unwell, pregnant or have a heart or blood pressure condition unless your doctor says it's fine.",
  },
];

export type RecoveryProgramKey = "training" | "sports" | "lifestyle";

export type RecoveryProgram = {
  key: RecoveryProgramKey;
  title: string;
  who: string;
  steps: string[];
  focus: string;
  /** The activities it's built on, for one-tap planning. */
  activities: RecoveryActivityKey[];
};

// Three ready-made programs a client picks, or their coach picks for them.
export const RECOVERY_PROGRAMS: RecoveryProgram[] = [
  {
    key: "training",
    title: "Training Recovery",
    who: "For gym, strength and muscle-building clients.",
    steps: ["Protein-rich meal with enough carbs.", "Hydrate after training.", "5-10 minutes of gentle mobility if needed.", "7-9 hours of sleep."],
    focus: "Muscle growth and managing fatigue.",
    activities: ["hydration", "stretching", "sleep"],
  },
  {
    key: "sports",
    title: "Sports Recovery",
    who: "For runners, cyclists and team-sport athletes.",
    steps: ["5-10 minutes of easy movement.", "Replace fluid and energy.", "Cold water when you need to recover fast.", "Adjust the next session to how sore and tired you are."],
    focus: "Ready for the next performance.",
    activities: ["easy_movement", "hydration", "cold"],
  },
  {
    key: "lifestyle",
    title: "Lifestyle Recovery",
    who: "For everyday clients who want better health and consistency.",
    steps: ["A regular sleep routine.", "Walk 10-30 minutes.", "5 minutes of slow breathing.", "Stay hydrated and eat balanced meals."],
    focus: "Stress, wellbeing and habits that last.",
    activities: ["sleep", "easy_movement", "breathing"],
  },
];

export function findRecoveryProgram(key: string | null | undefined): RecoveryProgram | undefined {
  return RECOVERY_PROGRAMS.find((p) => p.key === key);
}

export const WHY_RECOVERY = [
  "Your body doesn't improve during training alone. It adapts when you give it the right recovery.",
  "Sleep, nutrition, hydration and stress management are the foundations. Massage, sauna and cold can help in specific situations, but they can't replace the basics.",
  "Choose what suits your goals, stay consistent and give your body time to adapt.",
];

export function findRecoveryActivity(key: string | null | undefined): RecoveryActivity | undefined {
  return RECOVERY_ACTIVITIES.find((a) => a.key === key);
}

/** Short name for a calendar day, like "Breathing". */
export function recoveryShortName(key: string): string {
  const short: Partial<Record<RecoveryActivityKey, string>> = {
    hydration: "Hydrate",
    easy_movement: "Active",
    breathing: "Breathe",
    stretching: "Mobility",
    foam_rolling: "Foam roll",
    cold: "Cold",
    sauna: "Sauna",
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

/** Duration choices when logging: hours for sleep, minutes for the rest. */
export function durationChoices(activity: Pick<RecoveryActivity, "key">): number[] {
  return activity.key === "sleep" ? [360, 420, 480, 540] : [5, 10, 15, 20, 30, 45];
}

/** "8 h", "7.5 h", "10 min". */
export function durationText(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "";
  if (minutes >= 120) return `${Math.round((minutes / 60) * 10) / 10} h`;
  return `${minutes} min`;
}
