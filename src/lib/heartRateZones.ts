// Personal heart rate zones (GRIZZ, 2026-11-25). The trainer taps a client, the
// client's weight, age and sex come from their profile, the trainer taps how
// fit they are, what they'll do and roughly their resting heart rate, and the
// app works out five zones named by what they're for. The trainer sends them,
// and the client trains with a Bluetooth strap or watch on the live speedometer
// (src/screens/HeartRateScreen.tsx), which says HOLD THIS ZONE once they're in.
//
// How it's worked out:
// - Max heart rate: Tanaka (208 − 0.7 × age), a few beats lower on a bike,
//   where the legs tire before the heart.
// - Zones: Karvonen, a share of the heart rate reserve (max − resting) on top
//   of resting. The fat-burning zone sits higher the fitter they are (trained
//   people burn fat at harder paces).
// - Calories a minute: Keytel et al. 2005 (heart rate, weight, age, sex).
// - Fat: a bell curve that peaks in the middle of the fat-burning zone (the
//   "FatMax" curve), where about 40-50% of calories come from fat (more for
//   fitter people), so the most fat a minute lands in the fat-burning zone and
//   the most calories you can keep up for 30 minutes in the calorie-burn zone.
// These are good estimates, not lab numbers: exact fuel use needs a breathing test.

export type HrFitness = "beginner" | "average" | "trained";
export type HrExercise = "walk" | "bike" | "elliptical" | "rower";
export type HrGoal = "fat" | "fitness" | "calories";
export type HrSex = "male" | "female";
export type HrZoneKey = "recover" | "fat" | "fitness" | "calories" | "speed";

export const HR_FITNESS: { key: HrFitness; label: string }[] = [
  { key: "beginner", label: "Beginner" },
  { key: "average", label: "Average" },
  { key: "trained", label: "Well trained" },
];

export const HR_EXERCISES: { key: HrExercise; label: string; activity: "walk" | "cycle" | "other" }[] = [
  { key: "walk", label: "Walk / jog", activity: "walk" },
  { key: "bike", label: "Bike", activity: "cycle" },
  { key: "elliptical", label: "Elliptical", activity: "other" },
  { key: "rower", label: "Rower", activity: "other" },
];

export const HR_GOALS: { key: HrGoal; label: string; zone: HrZoneKey }[] = [
  { key: "fat", label: "Maximise fat burning", zone: "fat" },
  { key: "calories", label: "Maximise calorie burn", zone: "calories" },
  { key: "fitness", label: "Maximise fitness", zone: "fitness" },
];

/** Resting heart rate when there's no strap reading: the trainer taps a range. */
export const RESTING_RANGES: { label: string; bpm: number }[] = [
  { label: "Under 55", bpm: 52 },
  { label: "55–65", bpm: 60 },
  { label: "65–75", bpm: 70 },
  { label: "Over 75", bpm: 80 },
];

export type ZoneInfo = { key: HrZoneKey; name: string; short: string; colour: string; about: string };

// Plain words (GRIZZ, 2026-11-25: "a laymen explanation for each zone").
export const ZONE_INFO: ZoneInfo[] = [
  { key: "recover", name: "Warm up & recover", short: "Recover", colour: "#64748B", about: "Easy. Loosens you up and helps you recover between hard days." },
  { key: "fat", name: "Maximise fat burning", short: "Fat burn", colour: "#22C55E", about: "Steady, you can still chat. Your body uses the most fat for fuel." },
  { key: "fitness", name: "Maximise fitness", short: "Fitness", colour: "#38BDF8", about: "Breathing harder, short sentences. Makes your heart and lungs stronger." },
  { key: "calories", name: "Maximise calorie burn", short: "Calories", colour: "#F97316", about: "Hard, only a few words. Most calories per minute, plus after-burn." },
  { key: "speed", name: "Maximise speed", short: "Speed", colour: "#EF4444", about: "All-out. Short bursts only, under a minute or two." },
];

export type HrInputs = {
  weightKg: number;
  age: number;
  sex: HrSex;
  fitness: HrFitness;
  exercise: HrExercise;
  restingHr: number;
};

export type HrZone = ZoneInfo & {
  low: number;
  high: number;
  /** Estimates for 30 minutes in the middle of the zone; null for Maximise speed (bursts only). */
  kcal30: number | null;
  fat30: number | null;
};

// Where the fat-burning zone sits, as shares of the heart rate reserve.
const FAT_BAND: Record<HrFitness, [number, number]> = {
  beginner: [0.55, 0.65],
  average: [0.6, 0.7],
  trained: [0.63, 0.73],
};
// At the middle of the fat-burning zone, the share of calories that comes from fat.
const FAT_SHARE_AT_PEAK: Record<HrFitness, number> = { beginner: 0.4, average: 0.45, trained: 0.5 };
// How quickly fat burning falls away either side of its peak (share of reserve).
const FAT_SPREAD = 0.2;

export function maxHeartRate(age: number, exercise: HrExercise): number {
  const tanaka = 208 - 0.7 * age;
  return Math.round(tanaka - (exercise === "bike" ? 5 : 0));
}

/** Keytel 2005: kcal a minute at this heart rate (never below about resting burn). */
export function kcalPerMinute(hr: number, inputs: Pick<HrInputs, "weightKg" | "age" | "sex">): number {
  const { weightKg: w, age: a, sex } = inputs;
  const kj = sex === "male" ? -55.0969 + 0.6309 * hr + 0.1988 * w + 0.2017 * a : -20.4022 + 0.4472 * hr - 0.1263 * w + 0.074 * a;
  return Math.max(1.2, kj / 4.184);
}

/**
 * Grams of fat a minute at this heart rate: a bell curve that peaks in the
 * middle of the fat-burning zone (the "FatMax" curve), never more than the
 * calories burned.
 */
export function fatPerMinute(hr: number, inputs: HrInputs): number {
  const max = maxHeartRate(inputs.age, inputs.exercise);
  const rest = Math.min(inputs.restingHr, max - 40);
  const [lo, hi] = FAT_BAND[inputs.fitness];
  const peak = (lo + hi) / 2;
  const peakHr = rest + peak * (max - rest);
  const atPeak = (kcalPerMinute(peakHr, inputs) * FAT_SHARE_AT_PEAK[inputs.fitness]) / 9;
  const effort = (hr - rest) / (max - rest);
  const g = atPeak * Math.exp(-(((effort - peak) / FAT_SPREAD) ** 2));
  return Math.min(g, kcalPerMinute(hr, inputs) / 9);
}

export function buildZones(inputs: HrInputs): HrZone[] {
  const max = maxHeartRate(inputs.age, inputs.exercise);
  const rest = Math.min(inputs.restingHr, max - 40);
  const reserve = max - rest;
  const bpm = (share: number) => Math.round(rest + share * reserve);
  const [fatLo, fatHi] = FAT_BAND[inputs.fitness];
  const edges = [0.5, fatLo, fatHi, 0.8, 0.9, 1].map(bpm);
  return ZONE_INFO.map((info, i) => {
    const low = edges[i];
    const high = edges[i + 1];
    const mid = (low + high) / 2;
    if (info.key === "speed") return { ...info, low, high, kcal30: null, fat30: null };
    const kcal = kcalPerMinute(mid, inputs) * 30;
    const fat = fatPerMinute(mid, inputs) * 30;
    return { ...info, low, high, kcal30: Math.round(kcal / 5) * 5, fat30: Math.round(fat) };
  });
}

export function zoneForGoal(zones: HrZone[], goal: HrGoal): HrZone {
  const key = HR_GOALS.find((g) => g.key === goal)?.zone ?? "fat";
  return zones.find((z) => z.key === key) ?? zones[1];
}

/** Which zone a heart rate is in (below the first zone counts as Warm up & recover). */
export function zoneOf(zones: HrZone[], hr: number): HrZone {
  for (let i = zones.length - 1; i >= 0; i--) if (hr >= zones[i].low) return zones[i];
  return zones[0];
}

export type ZoneHint =
  | { kind: "below"; beats: number }
  | { kind: "in" }
  | { kind: "above"; beats: number };

/** What the speedometer says: speed up, HOLD THIS ZONE, or ease off. */
export function zoneHint(target: Pick<HrZone, "low" | "high">, hr: number): ZoneHint {
  if (hr < target.low) return { kind: "below", beats: target.low - hr };
  if (hr > target.high) return { kind: "above", beats: hr - target.high };
  return { kind: "in" };
}

/** A running tally of a live session: time in the target zone, calories and fat. */
export type HrTally = { seconds: number; inZoneSeconds: number; kcal: number; fatG: number; hrSum: number; samples: number };

export const EMPTY_TALLY: HrTally = { seconds: 0, inZoneSeconds: 0, kcal: 0, fatG: 0, hrSum: 0, samples: 0 };

export function addSecond(tally: HrTally, hr: number, inputs: HrInputs, target: Pick<HrZone, "low" | "high">, secs = 1): HrTally {
  const kcal = (kcalPerMinute(hr, inputs) / 60) * secs;
  const fat = (fatPerMinute(hr, inputs) / 60) * secs;
  const inZone = hr >= target.low && hr <= target.high;
  return {
    seconds: tally.seconds + secs,
    inZoneSeconds: tally.inZoneSeconds + (inZone ? secs : 0),
    kcal: tally.kcal + kcal,
    fatG: tally.fatG + fat,
    hrSum: tally.hrSum + hr * secs,
    samples: tally.samples + secs,
  };
}

export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

/** Resting heart rate from a minute sitting still: the lowest 20-second average. */
export function restingFromSamples(samples: number[]): number | null {
  const good = samples.filter((n) => n >= 30 && n <= 130);
  if (good.length < 20) return null;
  let best = Infinity;
  for (let i = 0; i + 20 <= good.length; i++) {
    const avg = good.slice(i, i + 20).reduce((t, n) => t + n, 0) / 20;
    if (avg < best) best = avg;
  }
  return Math.round(best);
}

export const HEART_RATE_ZONES_MESSAGE =
  "I've worked out your heart rate zones. Open ☰ Menu › Heart rate zones to see where to train and to start a session with your strap or watch.";

/** The saved zones row (0237) as inputs, or null when something is missing. */
export function inputsFromSaved(row: {
  weight_kg: number | string | null;
  age: number | null;
  sex: HrSex | null;
  fitness: HrFitness | null;
  exercise: HrExercise | null;
  resting_hr: number | null;
}): HrInputs | null {
  const weightKg = Number(row.weight_kg);
  if (!weightKg || !row.age || !row.sex || !row.fitness || !row.exercise || !row.resting_hr) return null;
  return { weightKg, age: row.age, sex: row.sex, fitness: row.fitness, exercise: row.exercise, restingHr: row.resting_hr };
}

export const HEART_RATE_MENU_ITEM = {
  key: "heartRate",
  title: "Heart rate zones",
  icon: "❤️",
  summary: "Your zones from your coach, and live heart rate with a chest strap or watch.",
};
