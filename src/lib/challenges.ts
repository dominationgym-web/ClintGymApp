import type { TrainerChallenge } from "@/types/database";

// Monthly challenges (0152, GRIZZ 2026-10-25): the trainer switches on one
// challenge a month for all their clients to keep them going. Each client
// ticks off the days they did it and wins by reaching the target. The app
// owner can add more and share them with every trainer.
//
// Targets stay at 28 days or fewer so every challenge can be won in February,
// and most leave room for a few off days. Never suggest oats here.

export type ChallengeKind = "move" | "train" | "food" | "recover" | "mind";

export type ChallengeIdea = {
  // Built-in key, or the challenge_library id for one the owner added.
  key: string;
  emoji: string;
  title: string;
  // What the client ticks off each day.
  daily_task: string;
  // How it works and why it helps.
  summary: string;
  target_days: number;
  kind?: ChallengeKind;
  // A line shown on challenges the owner added, e.g. who it's from.
  badge?: string;
};

export const CHALLENGE_KINDS: { key: ChallengeKind; label: string }[] = [
  { key: "move", label: "🚶 Move more" },
  { key: "train", label: "💪 Training" },
  { key: "food", label: "🥗 Food & drink" },
  { key: "recover", label: "😴 Recovery" },
  { key: "mind", label: "🧠 Mindset" },
];

export const BUILT_IN_CHALLENGES: ChallengeIdea[] = [
  {
    key: "steps-10k",
    kind: "move",
    emoji: "👟",
    title: "10 000 steps",
    daily_task: "Walk 10 000 steps today",
    summary:
      "Steps are the easiest way to burn more without feeling it. Take the stairs, walk while you're on the phone, park further away. Your phone or watch counts them for you.",
    target_days: 20,
  },
  {
    key: "walk-after-supper",
    kind: "move",
    emoji: "🌙",
    title: "Walk after supper",
    daily_task: "Go for a 15-minute walk after supper",
    summary:
      "A short walk after your evening meal brings blood sugar down, helps digestion and helps you sleep. Take the family or the dog.",
    target_days: 20,
  },
  {
    key: "active-30",
    kind: "move",
    emoji: "⏱️",
    title: "30 active minutes",
    daily_task: "Move for 30 minutes today (training, walking, sport, dancing, gardening)",
    summary:
      "Every kind of movement counts, as long as you're moving for 30 minutes. Split it up if you need to: 3 times 10 minutes works too.",
    target_days: 25,
  },
  {
    key: "workouts-12",
    kind: "train",
    emoji: "🏋️",
    title: "12 workouts",
    daily_task: "Finish one of your workouts today",
    summary:
      "Tick each day you finish a workout. Twelve in a month is three a week, the number that brings real change. Don't miss two in a row.",
    target_days: 12,
  },
  {
    key: "squats-100",
    kind: "train",
    emoji: "🦵",
    title: "100 squats a day",
    daily_task: "Do 100 bodyweight squats today, split up any way you like",
    summary:
      "For example 4 sets of 25, or 10 squats every time you boil the kettle. Sit back like into a chair, chest up, knees in line with your toes. Sore knees? Squat to a chair and ask your coach.",
    target_days: 20,
  },
  {
    key: "push-ups-50",
    kind: "train",
    emoji: "💥",
    title: "50 push-ups a day",
    daily_task: "Do 50 push-ups today, split up any way you like",
    summary:
      "On your knees or hands on a table is fine. Keep your body straight from head to knees or feet. You'll be surprised how much stronger you are by the end of the month.",
    target_days: 20,
  },
  {
    key: "plank-a-day",
    kind: "train",
    emoji: "🧱",
    title: "Plank every day",
    daily_task: "Hold a plank: 30 seconds in week 1, add 15 seconds each week",
    summary:
      "Forearms under your shoulders, squeeze your bum and keep your back flat. Week 1: 30 seconds, week 2: 45, week 3: 1 minute, week 4: 1 minute 15. Break it into shorter holds if you need to.",
    target_days: 20,
  },
  {
    key: "morning-mobility",
    kind: "recover",
    emoji: "🌅",
    title: "10-minute morning mobility",
    daily_task: "Do 10 minutes of mobility or stretching after you get up",
    summary:
      "Loosen your hips, back and shoulders before the day starts. You'll move better in training and feel less stiff at your desk.",
    target_days: 20,
  },
  {
    key: "bedtime-stretch",
    kind: "recover",
    emoji: "🧘",
    title: "Stretch before bed",
    daily_task: "Stretch for 10 minutes before bed",
    summary:
      "Slow stretches with long breaths out calm your body down for sleep and help you recover from training.",
    target_days: 20,
  },
  {
    key: "sleep-7",
    kind: "recover",
    emoji: "😴",
    title: "7 hours' sleep",
    daily_task: "Get at least 7 hours' sleep last night",
    summary:
      "Sleep is when your body recovers and builds muscle, and short sleep makes you hungrier the next day. Work back from your wake-up time to set a bedtime.",
    target_days: 20,
  },
  {
    key: "phone-down",
    kind: "recover",
    emoji: "📵",
    title: "Phone down before bed",
    daily_task: "No phone for the last 30 minutes before bed",
    summary:
      "Screens keep your brain switched on. Charge your phone away from your bed and read, stretch or talk instead.",
    target_days: 20,
  },
  {
    key: "water",
    kind: "food",
    emoji: "💧",
    title: "Water warrior",
    daily_task: "Drink 2 to 3 litres of water today",
    summary:
      "Fill a 1-litre bottle in the morning and finish it 2 or 3 times. Being well hydrated helps your energy, training and hunger.",
    target_days: 25,
  },
  {
    key: "protein-every-meal",
    kind: "food",
    emoji: "🍗",
    title: "Protein at every meal",
    daily_task: "Have a palm-sized portion of protein at every meal",
    summary:
      "Eggs, chicken, fish, lean beef, yoghurt, cottage cheese, beans or lentils. Protein keeps you full and protects your muscle while you lose fat.",
    target_days: 20,
  },
  {
    key: "veg-two-meals",
    kind: "food",
    emoji: "🥦",
    title: "Veg with lunch and supper",
    daily_task: "Fill half your plate with vegetables at lunch and supper",
    summary:
      "Vegetables fill you up for very few calories and bring the vitamins and fibre your body needs. Frozen veg counts.",
    target_days: 20,
  },
  {
    key: "no-sugary-drinks",
    kind: "food",
    emoji: "🥤",
    title: "No sugary drinks",
    daily_task: "No fizzy drinks, juice or energy drinks today",
    summary:
      "Sugary drinks are the easiest calories to cut because they don't fill you up. Swap them for water, sparkling water, rooibos or coffee without sugar.",
    target_days: 25,
  },
  {
    key: "home-cooked",
    kind: "food",
    emoji: "🍳",
    title: "No takeaways",
    daily_task: "Eat only food made at home today, no takeaways",
    summary:
      "Cooking yourself means you know what's in it. Cook extra on Sunday so busy days have a meal ready.",
    target_days: 25,
  },
  {
    key: "fruit-not-sweets",
    kind: "food",
    emoji: "🍎",
    title: "Fruit, not sweets",
    daily_task: "When you want something sweet, have fruit instead of sweets or chocolate",
    summary:
      "Fruit gives you the sweet taste with fibre and vitamins, and fills you up. Keep a fruit bowl where you can see it and no sweets in the cupboard.",
    target_days: 20,
  },
  {
    key: "alcohol-free",
    kind: "food",
    emoji: "🚫",
    title: "Alcohol-free days",
    daily_task: "No alcohol today",
    summary:
      "Alcohol adds calories, breaks your sleep and slows your recovery. Try a month with as many alcohol-free days as you can. Have a plan for the braai: sparkling water with lemon or a 0% drink.",
    target_days: 25,
  },
  {
    key: "gratitude",
    kind: "mind",
    emoji: "📝",
    title: "3 good things",
    daily_task: "Write down 3 good things about today",
    summary:
      "Big or small. It takes two minutes before bed and trains your mind to notice what's going well, which helps you stick with the hard things.",
    target_days: 25,
  },
  {
    key: "breathe-5",
    kind: "mind",
    emoji: "🌬️",
    title: "5 minutes of calm breathing",
    daily_task: "Do 5 minutes of slow breathing today",
    summary:
      "Breathe in for 4 seconds, hold for 4, out for 4, hold for 4. It brings stress down, and lower stress helps sleep, cravings and fat loss.",
    target_days: 20,
  },
];

export const CHALLENGE_TARGET_MIN = 1;
export const CHALLENGE_TARGET_MAX = 28;
export const CHALLENGE_TITLE_MAX = 60;
export const CHALLENGE_TASK_MAX = 120;
export const CHALLENGE_SUMMARY_MAX = 500;

// The trainer's dashboard asks them to pick one if none is on by this day of the month.
export const CHALLENGE_NUDGE_DAYS = 7;

export const CHALLENGES_MENU_ITEM = {
  key: "challenges",
  title: "Monthly challenges",
  icon: "🏆",
  summary: "Switch on one challenge a month for all your clients and see who's winning.",
};

/** "2026-10-25" → "2026-10-01" */
export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** The first day of the month after this one. */
export function nextMonthStart(iso: string): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

export function daysInMonth(iso: string): number {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  return new Date(y, m, 0).getDate();
}

/** The last day of the month, e.g. "2026-10-31". */
export function monthEnd(iso: string): string {
  return `${iso.slice(0, 7)}-${String(daysInMonth(iso)).padStart(2, "0")}`;
}

/** "October" */
export function monthName(iso: string): string {
  const d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, 1);
  return d.toLocaleDateString("en-ZA", { month: "long" });
}

/** Days left in the month, today included. */
export function daysLeftInMonth(today: string): number {
  return daysInMonth(today) - Number(today.slice(8, 10)) + 1;
}

/** The day before, in the same month, or null on the 1st. */
export function yesterdayInMonth(today: string): string | null {
  const day = Number(today.slice(8, 10));
  if (day <= 1) return null;
  return `${today.slice(0, 8)}${String(day - 1).padStart(2, "0")}`;
}

export type ChallengeProgress = {
  done: number;
  target: number;
  won: boolean;
  // Still possible to win with the days left (today included, if not ticked).
  canStillWin: boolean;
  doneToday: boolean;
};

export function challengeProgress(
  challenge: Pick<TrainerChallenge, "month" | "target_days">,
  days: string[],
  today: string
): ChallengeProgress {
  const inMonth = new Set(days.filter((d) => monthStart(d) === challenge.month && d <= today));
  const done = inMonth.size;
  const target = challenge.target_days;
  const doneToday = inMonth.has(today);
  const left = monthStart(today) === challenge.month ? daysLeftInMonth(today) - (doneToday ? 1 : 0) : 0;
  return { done, target, won: done >= target, canStillWin: done + left >= target, doneToday };
}

/** "12 of 20 days" */
export function progressLine(p: ChallengeProgress): string {
  if (p.won) return `🏆 Done! ${p.done} days`;
  return `${p.done} of ${p.target} days`;
}

export type ClientChallengeRow = { id: string; name: string; done: number; won: boolean; lastDay: string | null };

/** The trainer's list: winners first, then most days, then by name. */
export function rankClients(
  clients: { id: string; name: string }[],
  days: { client_id: string; day: string }[],
  target: number
): ClientChallengeRow[] {
  const byClient = new Map<string, string[]>();
  for (const d of days) {
    const list = byClient.get(d.client_id) ?? [];
    list.push(d.day);
    byClient.set(d.client_id, list);
  }
  return clients
    .map((c) => {
      const list = [...new Set(byClient.get(c.id) ?? [])].sort();
      return { id: c.id, name: c.name, done: list.length, won: list.length >= target, lastDay: list.at(-1) ?? null };
    })
    .sort((a, b) => b.done - a.done || a.name.localeCompare(b.name));
}

/** Built-in challenges, then the ones the owner shared (newest first). */
export function challengeChoices(shared: ChallengeIdea[]): ChallengeIdea[] {
  return [...shared, ...BUILT_IN_CHALLENGES];
}

/** Checks an owner's new challenge before saving. Returns the problem, or null. */
export function challengeFormProblem(form: { title: string; daily_task: string; summary: string; target_days: number }): string | null {
  if (!form.title.trim()) return "Give it a name.";
  if (form.title.trim().length > CHALLENGE_TITLE_MAX) return `Keep the name under ${CHALLENGE_TITLE_MAX} letters.`;
  if (!form.daily_task.trim()) return "Say what clients tick off each day.";
  if (form.daily_task.trim().length > CHALLENGE_TASK_MAX) return `Keep the daily task under ${CHALLENGE_TASK_MAX} letters.`;
  if (form.summary.trim().length > CHALLENGE_SUMMARY_MAX) return `Keep How it works under ${CHALLENGE_SUMMARY_MAX} letters.`;
  if (!Number.isInteger(form.target_days) || form.target_days < CHALLENGE_TARGET_MIN || form.target_days > CHALLENGE_TARGET_MAX) {
    return `Days to win must be between ${CHALLENGE_TARGET_MIN} and ${CHALLENGE_TARGET_MAX}, so it can be won in February too.`;
  }
  if (/\boats?\b/i.test(`${form.title} ${form.daily_task} ${form.summary}`)) {
    return "The app never suggests oats. Please leave them out.";
  }
  return null;
}
