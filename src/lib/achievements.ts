// Gold achievement badges (0085, GRIZZ 2026-10-13): a badge every time a
// client lifts 10% more on an exercise for at least the same reps. The first
// badge counts from the heaviest set on the first day they did the exercise;
// each badge after that counts from the last one.

export const ACHIEVEMENT_STEP = 1.1;

export type Baseline = { weight: number; reps: number; date: string };

type SetLike = { weight_kg: number | null; reps: number; log_date: string; warm_up?: boolean | null };

/** Where the next badge counts from: the last badge, else the first day's top set. */
export function achievementBaseline(
  firstDaySets: SetLike[],
  lastAchievement: { weight: number; reps: number; achieved_on: string } | null,
): Baseline | null {
  if (lastAchievement) {
    return { weight: Number(lastAchievement.weight), reps: lastAchievement.reps, date: lastAchievement.achieved_on };
  }
  const weighted = firstDaySets.filter((s) => !s.warm_up && s.weight_kg !== null && Number(s.weight_kg) > 0);
  if (weighted.length === 0) return null;
  const top = Math.max(...weighted.map((s) => Number(s.weight_kg)));
  const reps = Math.max(...weighted.filter((s) => Number(s.weight_kg) === top).map((s) => s.reps));
  return { weight: top, reps, date: weighted[0].log_date };
}

/** True when this set is 10% heavier than the baseline for at least as many reps, on a later day. */
export function earnsAchievement(set: SetLike, baseline: Baseline | null): boolean {
  if (!baseline || set.warm_up || set.weight_kg === null) return false;
  const weight = Number(set.weight_kg);
  return (
    weight > 0 &&
    set.log_date > baseline.date &&
    set.reps >= baseline.reps &&
    weight >= baseline.weight * ACHIEVEMENT_STEP - 1e-9
  );
}

export const percentUp = (from: number, to: number) => Math.round(((to - from) / from) * 100);
