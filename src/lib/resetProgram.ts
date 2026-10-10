// The 12-week Women's Health Reset, laid out week by week so a client can
// see the whole programme at a glance and step through it with Next.
// Habits are added a few at a time (week 1 starts with four, week 5 has all
// eight) so nobody has to change everything on day one.
import type { ResetHabitKey } from "@/lib/resetGuides";
import { parseIsoDate, toIsoDate } from "@/lib/dates";

export const RESET_WEEKS_TOTAL = 12;

export type ResetPhaseKey = "calm" | "rhythm" | "build" | "optimise";

export type ResetPhase = {
  key: ResetPhaseKey;
  name: string;
  weeks: string;
  goal: string;
  color: string;
};

export const RESET_PHASES: Record<ResetPhaseKey, ResetPhase> = {
  calm: { key: "calm", name: "CALM", weeks: "Weeks 1-2", goal: "Settle your body clock and your stress.", color: "#38BDF8" },
  rhythm: { key: "rhythm", name: "RHYTHM", weeks: "Weeks 3-4", goal: "Regular meals, protein and an evening routine.", color: "#A78BFA" },
  build: { key: "build", name: "BUILD", weeks: "Weeks 5-8", goal: "Get stronger and fitter, step by step.", color: "#22C55E" },
  optimise: { key: "optimise", name: "OPTIMISE", weeks: "Weeks 9-12", goal: "Fine-tune what works for you and lock it in.", color: "#D4AF37" },
};

export const RESET_HABITS: { key: ResetHabitKey; label: string; target: string }[] = [
  { key: "morning_daylight", label: "Morning daylight", target: "5-7 days" },
  { key: "breathing", label: "5 minutes breathing", target: "5-7 days" },
  { key: "daily_movement", label: "Daily walk / movement", target: "5-7 days" },
  { key: "strength_training", label: "Strength session", target: "2-3 a week" },
  { key: "consistent_sleep", label: "Same wake-up time", target: "5-7 days" },
  { key: "protein_meals", label: "Protein at every meal", target: "Most days" },
  { key: "aerobic_exercise", label: "Easy cardio", target: "1-4 a week" },
  { key: "evening_winddown", label: "Evening wind-down", target: "5+ nights" },
];

export type ResetWeek = {
  week: number;
  phase: ResetPhaseKey;
  title: string;
  focus: string;
  // The habits to tick off this week, in the order shown.
  habits: ResetHabitKey[];
  // What she'll do this week, in plain words. Starts with what's new.
  todo: string[];
  tip: string;
};

const CALM_HABITS: ResetHabitKey[] = ["morning_daylight", "breathing", "daily_movement", "strength_training"];
const ALL_HABITS: ResetHabitKey[] = RESET_HABITS.map((h) => h.key);

export const RESET_WEEKS: ResetWeek[] = [
  {
    week: 1,
    phase: "calm",
    title: "Wake up your body clock",
    focus: "Light, breath and a daily walk. That's it for week one.",
    habits: CALM_HABITS,
    todo: [
      "Get outside within an hour of waking, 10-20 minutes",
      "5 minutes of slow breathing every day",
      "Walk every day, starting where you are now",
      "2 light full-body sessions (Reset Training tab)",
    ],
    tip: "Don't add anything else yet. Small and done beats big and skipped.",
  },
  {
    week: 2,
    phase: "calm",
    title: "Same wake-up time",
    focus: "Keep week one going and get up at the same time every day.",
    habits: [...CALM_HABITS, "consistent_sleep"],
    todo: [
      "New: wake up at the same time every day, weekends too",
      "Keep your morning light, breathing and walks",
      "2 light full-body sessions",
    ],
    tip: "A steady wake-up time is the quickest way to better sleep.",
  },
  {
    week: 3,
    phase: "rhythm",
    title: "Protein at every meal",
    focus: "Build each meal around protein and add a little easy cardio.",
    habits: [...CALM_HABITS, "consistent_sleep", "protein_meals", "aerobic_exercise"],
    todo: [
      "New: a palm of protein at every meal",
      "New: 10-15 easy minutes of cardio, 1-2 times",
      "Eat at roughly the same times each day",
      "2 full-body sessions, a little more volume",
    ],
    tip: "Breakfast is the meal most people miss. Eggs, yoghurt or a shake fix it fast.",
  },
  {
    week: 4,
    phase: "rhythm",
    title: "Switch off in the evening",
    focus: "Give your body a signal that the day is ending.",
    habits: ALL_HABITS,
    todo: [
      "New: start winding down 60-90 minutes before bed",
      "Dim lights, phone away, no late-night scrolling",
      "Keep protein, cardio and your two sessions going",
    ],
    tip: "Even 20 minutes of no phone and dim lights before bed counts.",
  },
  {
    week: 5,
    phase: "build",
    title: "Three sessions a week",
    focus: "Training steps up to 3 sessions: lower body, push and pull.",
    habits: ALL_HABITS,
    todo: [
      "New: 3 strength sessions (Day A, B and C)",
      "Last set of each exercise close to failure, only on a good week",
      "20-30 minutes of cardio, 2-3 times",
      "Keep all your daily habits",
    ],
    tip: "Log weights and reps every session so you can see yourself getting stronger.",
  },
  {
    week: 6,
    phase: "build",
    title: "Structured cardio",
    focus: "Make your cardio sessions planned, not just walking.",
    habits: ALL_HABITS,
    todo: [
      "Plan 2-3 cardio sessions of 20-30 minutes in your diary",
      "Pick something you enjoy: cycling, swimming, hiking, a jog",
      "3 strength sessions",
    ],
    tip: "If you can't talk in full sentences, slow down. Most cardio should feel easy.",
  },
  {
    week: 7,
    phase: "build",
    title: "Move more through the day",
    focus: "Add steps on top of your training.",
    habits: ALL_HABITS,
    todo: [
      "Add about 1,000 steps to your daily average",
      "Walk 5-15 minutes after your biggest meal",
      "Get up for 2-3 minutes every hour you sit",
      "3 strength sessions, 2-3 cardio",
    ],
    tip: "Take calls standing or walking. It adds up fast.",
  },
  {
    week: 8,
    phase: "build",
    title: "Better food quality",
    focus: "Same plate, better choices: protein, plants, carbs and healthy fat.",
    habits: ALL_HABITS,
    todo: [
      "Vegetables or fruit with every meal",
      "Aim for 80-90% good choices, not 100%",
      "3 strength sessions, 2-3 cardio",
    ],
    tip: "Start every meal with your protein, then fill the rest of the plate.",
  },
  {
    week: 9,
    phase: "optimise",
    title: "Check in with your body",
    focus: "Look back at how far you've come and what's still hard.",
    habits: ALL_HABITS,
    todo: [
      "Read back your daily notes from the last 8 weeks",
      "Ask: more energy? Better sleep? Less stressed? Stronger?",
      "Tell your coach what's working and what isn't",
      "3 strength sessions, 3-4 cardio",
    ],
    tip: "Track more than your weight: energy, sleep, mood and strength all count.",
  },
  {
    week: 10,
    phase: "optimise",
    title: "Mix up your cardio",
    focus: "Keep most cardio easy and make one session a bit harder.",
    habits: ALL_HABITS,
    todo: [
      "3-4 cardio sessions, one slightly harder",
      "Go to failure on your last set only when you're well recovered",
      "Keep every daily habit going",
    ],
    tip: "Hard days only work when the easy days are really easy.",
  },
  {
    week: 11,
    phase: "optimise",
    title: "Know your rhythm",
    focus: "Notice how your cycle, sleep and stress change your energy.",
    habits: ALL_HABITS,
    todo: [
      "Log your period in Women's Health Reset (menu) if you haven't",
      "Train harder on high-energy days, lighter on low ones",
      "3 strength sessions, 3-4 cardio",
    ],
    tip: "Your programme should fit you, not the other way round.",
  },
  {
    week: 12,
    phase: "optimise",
    title: "Lock it in",
    focus: "Decide which habits you'll keep for good.",
    habits: ALL_HABITS,
    todo: [
      "Pick the 3 habits that helped you most",
      "Plan how they fit into a normal week from now on",
      "Book a chat with your coach about what's next",
    ],
    tip: "Health is built daily. Consistent enough, for long enough.",
  },
];

export function resetWeek(week: number): ResetWeek {
  return RESET_WEEKS[Math.min(RESET_WEEKS_TOTAL, Math.max(1, week)) - 1];
}

/** Habits that are new this week (not in the week before). */
export function newHabits(week: number): ResetHabitKey[] {
  if (week <= 1) return [];
  const before = new Set(resetWeek(week - 1).habits);
  return resetWeek(week).habits.filter((h) => !before.has(h));
}

/**
 * Which week she's on: 1 on the start day, 13 or more once the 12 weeks are
 * done, 0 if the start date is still in the future.
 */
export function resetWeekNumber(startedOn: string, today: string): number {
  const days = Math.round((parseIsoDate(today).getTime() - parseIsoDate(startedOn).getTime()) / 86_400_000);
  if (days < 0) return 0;
  return Math.floor(days / 7) + 1;
}

/** The first and last day of a week of her programme, as ISO dates. */
export function resetWeekDates(startedOn: string, week: number): { from: string; to: string } {
  const from = parseIsoDate(startedOn);
  from.setDate(from.getDate() + (week - 1) * 7);
  const to = new Date(from);
  to.setDate(to.getDate() + 6);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

// ---- Training ----

export type ResetExercise = { name: string; or?: string; note?: string };
export type ResetSession = { key: string; label: string; exercises: ResetExercise[] };
export type ResetTraining = {
  sessionsPerWeek: number;
  summary: string;
  sets: string;
  effort: string;
  cardio: string;
  sessions: ResetSession[];
  energyNote: string;
};

export const RESET_WARM_UP = "5 minutes of brisk walking or easy cycling, then a light set of your first exercise.";

export const RESET_TRAINING: Record<ResetPhaseKey, ResetTraining> = {
  calm: {
    sessionsPerWeek: 2,
    summary: "2 full-body sessions a week",
    sets: "2 sets of 10-12 reps, rest 1-2 minutes",
    effort: "Comfortable only. Nothing near failure.",
    cardio: "Walking only (your daily walk covers it).",
    sessions: [
      {
        key: "calm-a",
        label: "Session A (do it twice this week)",
        exercises: [
          { name: "Barbell Back Squat", note: "light" },
          { name: "Bench Press", note: "light" },
          { name: "Bent-Over Barbell Row", or: "Lat Pulldown" },
          { name: "Plank", note: "hold 20-40 seconds" },
        ],
      },
    ],
    energyNote: "Stressed or tired this week? Keep the weights light or skip a session. Consistency matters far more than intensity right now.",
  },
  rhythm: {
    sessionsPerWeek: 2,
    summary: "2 full-body sessions a week",
    sets: "3 sets of 10-12 reps, rest 1-2 minutes",
    effort: "Still comfortable, with a little more volume.",
    cardio: "10-15 easy minutes (walk, cycle or swim), 1-2 times a week.",
    sessions: [
      {
        key: "rhythm-a",
        label: "Session A (do it twice this week)",
        exercises: [
          { name: "Barbell Back Squat", or: "Walking Lunge" },
          { name: "Romanian Deadlift", note: "light" },
          { name: "Incline Dumbbell Press" },
          { name: "Lat Pulldown", or: "Pull-Up" },
          { name: "Dumbbell Lateral Raise" },
          { name: "Plank", note: "hold 20-40 seconds" },
        ],
      },
    ],
    energyNote: "A heavy week at work or bad sleep means you scale back, not push through.",
  },
  build: {
    sessionsPerWeek: 3,
    summary: "3 sessions a week: lower body, push, pull",
    sets: "3 sets of 8-12 reps, rest 1-2 minutes",
    effort: "Comfortable, except the last set of each exercise: close to failure.",
    cardio: "20-30 structured minutes, 2-3 times a week.",
    sessions: [
      {
        key: "build-a",
        label: "Day A · Lower body",
        exercises: [
          { name: "Barbell Back Squat" },
          { name: "Romanian Deadlift" },
          { name: "Walking Lunge" },
          { name: "Leg Extension" },
          { name: "Plank", note: "hold 20-40 seconds" },
        ],
      },
      {
        key: "build-b",
        label: "Day B · Push",
        exercises: [
          { name: "Bench Press" },
          { name: "Incline Dumbbell Press" },
          { name: "Dumbbell Lateral Raise" },
          { name: "Cable Rope Pushdown" },
        ],
      },
      {
        key: "build-c",
        label: "Day C · Pull",
        exercises: [
          { name: "Bent-Over Barbell Row" },
          { name: "Lat Pulldown" },
          { name: "Seated Dumbbell Curl" },
          { name: "EZ-Bar Preacher Curl" },
        ],
      },
    ],
    energyNote: "Only push the last set if the week has felt good. Any rough week, keep everything comfortable.",
  },
  optimise: {
    sessionsPerWeek: 3,
    summary: "3 sessions a week, fine-tuned with your coach",
    sets: "3-4 sets of 8-12 reps, rest 1-2 minutes",
    effort: "Comfortable most sets. Failure on your last set only when you're well recovered.",
    cardio: "3-4 times a week, mixing easy and slightly harder sessions.",
    sessions: [
      {
        key: "optimise-a",
        label: "Day A · Lower body",
        exercises: [
          { name: "Barbell Back Squat" },
          { name: "Bulgarian Split Squat" },
          { name: "Leg Extension" },
          { name: "Lying Leg Curl" },
          { name: "Hip Abduction" },
          { name: "Hip Adduction" },
          { name: "Plank", note: "hold 20-40 seconds" },
        ],
      },
      {
        key: "optimise-b",
        label: "Day B · Push",
        exercises: [
          { name: "Bench Press" },
          { name: "Incline Dumbbell Press" },
          { name: "Dumbbell Lateral Raise" },
          { name: "Cable Rope Pushdown" },
          { name: "Reverse-Grip Tricep Pushdown" },
        ],
      },
      {
        key: "optimise-c",
        label: "Day C · Pull",
        exercises: [
          { name: "Romanian Deadlift" },
          { name: "Bent-Over Barbell Row", or: "Lat Pulldown" },
          { name: "Dumbbell Row" },
          { name: "Seated Dumbbell Curl" },
          { name: "EZ-Bar Preacher Curl" },
        ],
      },
    ],
    energyNote: "By now you know your own rhythm. Log your effort honestly every session so your coach can fine-tune things.",
  },
};

// ---- Daily note ----

export const FEELINGS: { value: number; emoji: string; label: string }[] = [
  { value: 1, emoji: "😣", label: "Rough" },
  { value: 2, emoji: "😕", label: "Low" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
];

export type ResetHelped = "yes" | "a_little" | "not_yet";

export const HELPED_OPTIONS: { value: ResetHelped; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "a_little", label: "A little" },
  { value: "not_yet", label: "Not yet" },
];

// ---- Reminders ----

export const RESET_REMINDER_TIMES = ["07:00", "12:00", "17:00", "19:00"];

export function formatReminderTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, "0")}${suffix}` : `${hour}${suffix}`;
}

/** The daily reminders from today for `days` days, skipping any time already past. */
export function upcomingResetReminders(
  startedOn: string,
  time: string,
  now: Date,
  days: number
): { id: string; at: Date; title: string; body: string }[] {
  const [h, m] = time.split(":").map(Number);
  const out: { id: string; at: Date; title: string; body: string }[] = [];
  for (let i = 0; i < days; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, h, m, 0, 0);
    if (at <= now) continue;
    const week = resetWeekNumber(startedOn, toIsoDate(at));
    if (week < 1 || week > RESET_WEEKS_TOTAL) continue;
    const plan = resetWeek(week);
    out.push({
      id: `reset-reminder-${toIsoDate(at)}`,
      at,
      title: `🌿 Reset week ${week}: ${plan.title}`,
      body: "Tick off today's habits and jot down how you feel.",
    });
  }
  return out;
}
