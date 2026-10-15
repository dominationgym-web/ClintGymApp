import type { Habit } from "@/types/database";

// Suggested habits a client can pick on the Habits tab, grouped under
// tap-to-open headings. `reps` is how many times a day it counts as done.

export type SuggestedHabit = { name: string; reps: number; why: string };
export type HabitGroup = { key: string; title: string; icon: string; habits: SuggestedHabit[] };

export const HABIT_GROUPS: HabitGroup[] = [
  {
    key: "nutrition",
    title: "Nutrition",
    icon: "🥗",
    habits: [
      { name: "Protein with every meal", reps: 3, why: "Keeps you full and protects your muscle." },
      { name: "Drink 3 litres of water", reps: 1, why: "Energy, training and hunger all improve when you're hydrated." },
      { name: "2 fists of vegetables at lunch and supper", reps: 2, why: "Fibre, vitamins and volume for very few calories." },
      { name: "No sugary drinks", reps: 1, why: "The easiest calories to cut." },
      { name: "Take my supplements", reps: 1, why: "Only works if it's every day." },
      { name: "Plan tomorrow's meals", reps: 1, why: "A plan beats willpower at 6pm." },
      { name: "No eating after supper", reps: 1, why: "Cuts mindless evening snacking." },
    ],
  },
  {
    key: "movement",
    title: "Movement",
    icon: "🚶",
    habits: [
      { name: "Walk 8,000 steps", reps: 1, why: "Burns more than most people think and helps recovery." },
      { name: "10 minutes of stretching", reps: 1, why: "Keeps hips, back and shoulders moving well." },
      { name: "Train as planned", reps: 1, why: "Turn up and the results follow." },
      { name: "Take the stairs", reps: 1, why: "Small extra movement adds up over a week." },
      { name: "Stand up and move every hour", reps: 4, why: "Breaks up long hours of sitting." },
    ],
  },
  {
    key: "sleep",
    title: "Sleep & recovery",
    icon: "😴",
    habits: [
      { name: "In bed by 22:30", reps: 1, why: "A set bedtime is the best sleep habit there is." },
      { name: "No screens 30 minutes before bed", reps: 1, why: "Helps you fall asleep faster." },
      { name: "7 to 9 hours of sleep", reps: 1, why: "Where your body recovers and builds." },
      { name: "No caffeine after 14:00", reps: 1, why: "Caffeine stays in your system for hours." },
    ],
  },
  {
    key: "mind",
    title: "Mindset",
    icon: "🧠",
    habits: [
      { name: "Write down 3 things I'm grateful for", reps: 1, why: "Trains your brain to notice what's going well." },
      { name: "5 minutes of slow breathing", reps: 1, why: "Calms stress and helps sleep." },
      { name: "Read 10 pages", reps: 1, why: "Time for yourself, away from the phone." },
      { name: "10 minutes outside in daylight", reps: 1, why: "Lifts mood and sets your body clock." },
    ],
  },
];

/** A habit the client can see today: not ended. */
export function isRunning(habit: Pick<Habit, "end_date">, today: string): boolean {
  return !habit.end_date || habit.end_date >= today;
}

/** The client's existing habit with this name (ignoring case and spaces), running or stopped. */
export function findHabit<T extends Pick<Habit, "name">>(habits: T[], name: string): T | undefined {
  const key = name.trim().toLowerCase();
  return habits.find((h) => h.name.trim().toLowerCase() === key);
}
