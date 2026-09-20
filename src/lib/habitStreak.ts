import type { Habit } from "@/types/database";

// Colours per your note: relaxing, easy on the eyes - progressing
// Red -> Orange -> Yellow -> White -> Green as a habit gets locked in.
// Each tier takes 7 consecutive scheduled days to earn; Green means the
// 30-day goal is achieved.
export const DAYS_PER_TIER = 7;

export const STREAK_TIERS = [
  { color: "#F87171", label: "Red" },
  { color: "#F59E0B", label: "Orange" },
  { color: "#FACC15", label: "Yellow" },
  { color: "#E2E8F0", label: "White" },
  { color: "#22C55E", label: "Green - goal achieved" },
] as const;

export type HabitTierResult = {
  tier: number; // index into STREAK_TIERS
  progress: number; // days completed toward the next tier (0..6), meaningless at the last tier
  color: string;
  label: string;
};

// Walks forward day by day from the habit's start date, only counting
// scheduled days. A completed day advances progress toward the next tier
// (every 7 days earns the next colour); a missed scheduled day immediately
// drops one tier - miss 2 in a row and you've dropped 2 tiers, exactly per
// your note. Today isn't judged until it's actually done, so an
// in-progress day never counts as a miss.
export function calculateHabitTier(habit: Habit, logsByDate: Record<string, number>): HabitTierResult {
  let tier = 0;
  let progress = 0;

  const start = new Date(`${habit.start_date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString().slice(0, 10);

  for (const d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    if (habit.end_date && iso > habit.end_date) break;
    if (!habit.active_days.includes(d.getDay())) continue;

    const completedReps = logsByDate[iso] ?? 0;
    const isDone = completedReps >= habit.reps_target;

    if (iso === todayIso && !isDone) continue;

    if (isDone) {
      progress += 1;
      if (progress >= DAYS_PER_TIER && tier < STREAK_TIERS.length - 1) {
        tier += 1;
        progress = 0;
      }
    } else {
      progress = 0;
      tier = Math.max(0, tier - 1);
    }
  }

  return { tier, progress, ...STREAK_TIERS[tier] };
}
