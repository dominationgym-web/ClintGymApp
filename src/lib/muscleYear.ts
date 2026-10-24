import { parseIsoDate } from "@/lib/dates";
import { levelOf, type Level } from "@/lib/programGoals";

// Muscle Year (GRIZZ, 2026-10-24): "a well scientifically structured muscle
// building protocol ... 1 year program, broken into 3 month blocks. Managing
// their recovery effectively as well as their nutrition during this period.
// They need to est their BMR so we can guide them through their macros."
// The training is the three Muscle Year programs (0150). This is the food
// and recovery side: the client works out their BMR and macros (the same
// sums as the meal plan maker, so both give the same numbers), and every 2
// weeks their weigh-ins say whether to eat a bit more or less.

export type MuscleBlock = {
  number: 1 | 2 | 3 | 4;
  title: string;
  weeks: string;
  training: string;
  recovery: string;
  food: string;
};

export const MUSCLE_YEAR_BLOCKS: MuscleBlock[] = [
  {
    number: 1,
    title: "Foundation",
    weeks: "Weeks 1-13",
    training:
      "Learn every lift with clean form. 8-15 reps, stopping each set with 2-3 good reps left. Sets go up on the main lifts as the weeks go on.",
    recovery:
      "Muscles are sore at first: that's normal and settles in 2-3 weeks. Sleep 7-9 hours, walk on rest days and stretch for 10 minutes after training.",
    food: "Start on your muscle-building calories. Get your protein in every meal: this block builds the habit.",
  },
  {
    number: 2,
    title: "Volume",
    weeks: "Weeks 14-26",
    training:
      "More sets for each muscle, 8-15 reps, stopping with 1-2 reps left. This is where most of the new muscle comes from.",
    recovery:
      "This is the hardest block to recover from. Protect your sleep, add a recovery session on a rest day (stretching, foam rolling or an easy walk) and tell your coach if you're tired for days.",
    food: "Your body needs the most food here. If your weight has stopped going up, add about 150 kcal a day, mostly carbs around training.",
  },
  {
    number: 3,
    title: "Strength",
    weeks: "Weeks 27-39",
    training:
      "Heavier main lifts for 5-8 reps with 2-3 minutes' rest. Getting stronger now lets you use heavier weights for more reps in block 4.",
    recovery:
      "Heavy sets tire your joints and nerves more than your muscles. Warm up well, rest the full time between sets and keep your form strict.",
    food: "Keep eating for muscle. Carbs before heavy sessions help you lift more.",
  },
  {
    number: 4,
    title: "Peak",
    weeks: "Weeks 40-52",
    training:
      "Back to 8-20 reps with exercises that stretch the muscle under load. The last set of the small exercises can go to 1 rep short of failure.",
    recovery:
      "Lots of close-to-failure sets: sleep and rest days matter more than ever. Week 52 is a review: weigh in, take photos and see your year.",
    food: "Keep gaining slowly. After week 52, talk to your coach about your next year: keep building, or a few weeks at maintenance first.",
  },
];

// The weeks inside every block (0150): sets build, a deload at week 7 and a
// review week at 13.
export const BLOCK_WEEK_GUIDE = [
  "Weeks 1-6: build. Sets go up on the main lifts in weeks 3 and 5.",
  "Week 7: deload. Half the sets at about 70% of the weight, so your body catches up.",
  "Weeks 8-12: build again, with more sets from week 10.",
  "Week 13: review. Half the sets: check your best weights, weigh in, take progress photos and rest before the next block.",
];

export const RECOVERY_BASICS = [
  "Sleep 7-9 hours. Muscle is built while you sleep, not while you train.",
  "At least one full rest day a week, and never the same muscles hard two days in a row.",
  "Eat enough: training on too little food is the fastest way to stop growing.",
  "Use the Recovery section on rest days: stretching, foam rolling, an easy walk or a sauna.",
  "Tell your coach if your joints ache, you're tired for days, or your lifts go down two sessions in a row: a deload week can come sooner.",
];

// Gaining 0.25-0.5% of bodyweight a week keeps the extra weight mostly
// muscle (Iraki et al. 2019; Helms et al. 2014). Beginners can gain faster.
export const WEEKLY_GAIN_PCT: Record<Level, { low: number; high: number }> = {
  beginner: { low: 0.25, high: 0.5 },
  intermediate: { low: 0.2, high: 0.4 },
  advanced: { low: 0.1, high: 0.25 },
};

/** The client's level from their intake; no answer counts as intermediate. */
export function muscleLevel(trainingLevel: string | null | undefined): Level {
  return levelOf(trainingLevel) ?? "intermediate";
}

/** The kg a week to aim for, from their weight and level, rounded to 0.05 kg. */
export function weeklyGainKg(weightKg: number, level: Level): { low: number; high: number } {
  const r = (pct: number) => Math.round((weightKg * pct) / 100 / 0.05) * 0.05;
  const { low, high } = WEEKLY_GAIN_PCT[level];
  return { low: Math.round(r(low) * 100) / 100, high: Math.round(r(high) * 100) / 100 };
}

export const KCAL_STEP = 150;
// Two weigh-ins at least this far apart make a fair check.
export const CHECK_MIN_DAYS = 10;

export type WeightCheck =
  | { kind: "need"; message: string }
  | { kind: "wait"; days: number; message: string }
  | { kind: "slow" | "fast" | "onTrack"; perWeekKg: number; days: number; message: string };

/**
 * What the last weigh-ins say: weight going up too slowly (eat 150 kcal more),
 * too fast (150 kcal less) or on track. Uses the latest weigh-in and the one
 * nearest 2 weeks before it (at least 10 days before).
 */
export function weightCheck(
  weighIns: { measured_on: string; weight_kg: number | null }[],
  level: Level,
): WeightCheck {
  const list = weighIns
    .filter((w): w is { measured_on: string; weight_kg: number } => w.weight_kg != null && w.weight_kg > 0)
    .sort((a, b) => a.measured_on.localeCompare(b.measured_on));
  if (list.length === 0) {
    return { kind: "need", message: "Weigh in under Profile > My progress, then again in 2 weeks, to see if you're gaining at the right speed." };
  }
  const latest = list[list.length - 1];
  const dayGap = (a: string, b: string) => Math.round((parseIsoDate(b).getTime() - parseIsoDate(a).getTime()) / 86_400_000);
  const earlier = list.filter((w) => dayGap(w.measured_on, latest.measured_on) >= CHECK_MIN_DAYS);
  if (earlier.length === 0) {
    const first = list[0];
    const wait = Math.max(1, 14 - dayGap(first.measured_on, latest.measured_on));
    return { kind: "wait", days: wait, message: `Weigh in again in about ${wait} day${wait === 1 ? "" : "s"} to check your progress.` };
  }
  // The one closest to 14 days before the latest.
  const before = earlier.reduce((best, w) =>
    Math.abs(dayGap(w.measured_on, latest.measured_on) - 14) < Math.abs(dayGap(best.measured_on, latest.measured_on) - 14) ? w : best,
  );
  const days = dayGap(before.measured_on, latest.measured_on);
  const perWeekKg = Math.round(((latest.weight_kg - before.weight_kg) / days) * 7 * 100) / 100;
  const pct = (perWeekKg / before.weight_kg) * 100;
  const { low, high } = WEEKLY_GAIN_PCT[level];
  const rate = `${perWeekKg >= 0 ? "+" : ""}${perWeekKg.toFixed(2)} kg a week over the last ${days} days`;
  if (pct < low) {
    return {
      kind: "slow",
      perWeekKg,
      days,
      message: `${rate}. That's slower than muscle building needs: eat about ${KCAL_STEP} kcal a day more (a slice of bread with peanut butter, or a bowl of rice), then check again in 2 weeks.`,
    };
  }
  if (pct > high) {
    return {
      kind: "fast",
      perWeekKg,
      days,
      message: `${rate}. That's faster than muscle can grow, so some of it is fat: eat about ${KCAL_STEP} kcal a day less, mostly from fats and treats, then check again in 2 weeks.`,
    };
  }
  return { kind: "onTrack", perWeekKg, days, message: `${rate}. Right on track: keep eating the same and check again in 2 weeks.` };
}

/** Grams of protein for each meal: the day's protein over the meals, 25-40 g is the sweet spot. */
export function proteinPerMeal(proteinG: number, meals: number): number {
  return meals > 0 ? Math.round(proteinG / meals / 5) * 5 : proteinG;
}

/** Which block a week of the year is in (1-4), or null outside 1-52. */
export function blockOfWeek(week: number): 1 | 2 | 3 | 4 | null {
  if (week < 1 || week > 52) return null;
  return (Math.floor((week - 1) / 13) + 1) as 1 | 2 | 3 | 4;
}
