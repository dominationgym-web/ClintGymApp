// Women's Health Reset: training, eating and supplementing around the
// menstrual cycle, in plain language, plus working out which phase a client is
// in from the period start dates she logs (0038).
//
// Day 1 is the first day of a period. Phase lengths follow a typical cycle and
// stretch or shrink with her own average cycle length. Everyone is different,
// so the guide says to go by how she feels, and the phases are a guide, not a
// rule. Nothing here is medical advice.
import type { GuidelineGroup } from "@/lib/sleep";
import { parseIsoDate, toIsoDate } from "@/lib/dates";

export type CyclePhaseKey = "menstrual" | "follicular" | "ovulation" | "luteal";

export interface CyclePhase {
  key: CyclePhaseKey;
  name: string;
  emoji: string;
  /** One line for the card: what the phase is. */
  tagline: string;
  feel: string[];
  training: string[];
  nutrition: string[];
  supplements: string[];
  /** Short daily nudge for reminders. */
  reminder: string;
}

export const CYCLE_PHASES: Record<CyclePhaseKey, CyclePhase> = {
  menstrual: {
    key: "menstrual",
    name: "Period phase",
    emoji: "🌑",
    tagline: "Your period. Hormones are at their lowest, so energy usually is too.",
    feel: [
      "Energy is often low for the first 2 or 3 days, then starts to pick up.",
      "Cramps, a sore lower back, tiredness and feeling a bit flat are all normal.",
      "Many women feel relief once bleeding starts, and mood starts to lift.",
    ],
    training: [
      "Keep moving, but go easier: walks, mobility, stretching, yoga or light weights.",
      "Feel good? Train as normal. Feel rough? Drop the weight or the sets. Both are fine.",
      "Gentle movement often eases cramps.",
    ],
    nutrition: [
      "Eat iron-rich food to replace what you lose: red meat, eggs, spinach, lentils and beans.",
      "Have vitamin C with it (citrus, peppers, tomatoes) to help your body take in the iron.",
      "Warm, comforting meals like soups and stews go down well.",
      "Drink plenty of water. It helps with bloating and headaches.",
    ],
    supplements: [
      "Magnesium (200 to 400 mg in the evening) can ease cramps and help you sleep.",
      "Omega-3 fish oil can take the edge off period pain.",
      "Iron only if your periods are heavy or a blood test shows you're low. Ask your doctor first.",
    ],
    reminder: "Period phase: go gentle today, eat iron-rich food, and take your magnesium tonight.",
  },
  follicular: {
    key: "follicular",
    name: "Build phase",
    emoji: "🌒",
    tagline: "After your period. Oestrogen is rising, and so is your energy.",
    feel: [
      "Energy, mood and motivation climb day by day.",
      "You usually recover faster and feel stronger.",
      "A great time to try new things and push yourself.",
    ],
    training: [
      "Your best window for hard training: heavier weights, new personal bests, intervals.",
      "Add a little weight or an extra set while you feel strong.",
      "Learn new exercises now while your focus is sharp.",
    ],
    nutrition: [
      "Your body handles carbs well now. Have oats, rice, potatoes or fruit around training.",
      "Keep protein high at every meal to build muscle: meat, fish, eggs, yoghurt.",
      "Fresh, light meals with lots of vegetables suit this phase.",
    ],
    supplements: [
      "Keep up your basics: vitamin D, omega-3 and magnesium.",
      "Creatine (3 to 5 g a day) supports strength and is safe to take every day.",
      "A protein shake is a handy way to hit your protein after training.",
    ],
    reminder: "Build phase: energy is rising, so push your training and keep your protein high.",
  },
  ovulation: {
    key: "ovulation",
    name: "Peak phase",
    emoji: "🌕",
    tagline: "Around ovulation. Hormones peak and you'll often feel your strongest.",
    feel: [
      "Energy, confidence and strength are usually at their highest.",
      "Some women feel a twinge on one side of the lower belly. That's normal.",
      "You may feel more social and outgoing.",
    ],
    training: [
      "Go for it: heavy lifts, sprints and personal bests.",
      "Warm up properly. Joints can be a little looser now, so control every rep.",
      "Take extra care with landing, jumping and twisting movements.",
    ],
    nutrition: [
      "Keep carbs around training to fuel your hardest sessions.",
      "Eat plenty of fibre (vegetables, fruit, whole grains) to help your body clear used hormones.",
      "Drink more water if you're training hard or it's hot.",
    ],
    supplements: [
      "Stay on your basics: vitamin D, omega-3, magnesium and creatine.",
      "Electrolytes help on sweaty, hard training days.",
    ],
    reminder: "Peak phase: a great day for a strong session. Warm up well and control every rep.",
  },
  luteal: {
    key: "luteal",
    name: "Wind-down phase",
    emoji: "🌘",
    tagline: "The days before your period. Progesterone rises, and energy slowly drops.",
    feel: [
      "The first week usually feels steady. Then energy and mood can dip.",
      "In the last few days, cravings, bloating, poor sleep and a shorter fuse are common (PMS).",
      "Your body runs a little warmer and you may feel hungrier. That's real, not in your head.",
    ],
    training: [
      "Early on, keep training normally.",
      "Later on, aim for steady, moderate sessions: keep the weight, but do fewer heavy sets and take longer rests.",
      "Walks, swimming and pilates help with mood and bloating.",
      "Expect workouts to feel harder. That's your hormones, not you going backwards.",
    ],
    nutrition: [
      "You burn a bit more now, so a small extra snack (about 100 to 200 calories) is fine.",
      "Have protein and fibre at every meal to keep cravings in check.",
      "Craving chocolate? Pick dark chocolate. It's rich in magnesium.",
      "Cut back on salt, alcohol and caffeine to ease bloating, sore breasts and poor sleep.",
      "Complex carbs like oats, sweet potato and brown rice help mood and sleep.",
    ],
    supplements: [
      "Magnesium every evening helps with PMS, mood and sleep.",
      "Vitamin B6 (up to 50 mg a day) can ease PMS for some women.",
      "Calcium (from dairy or a supplement) has been shown to reduce PMS symptoms.",
      "Omega-3 every day.",
    ],
    reminder: "Wind-down phase: steady training, protein at every meal, and magnesium tonight.",
  },
};

export const PHASE_ORDER: CyclePhaseKey[] = ["menstrual", "follicular", "ovulation", "luteal"];

/** The written guide shown on the Women's Health Reset page. */
export const WOMENS_HEALTH_GUIDE: GuidelineGroup[] = [
  {
    heading: "How it works",
    points: [
      "Your hormones change through the month, and so do your energy, strength, hunger and mood.",
      "Rather than fighting that, we work with it: push hard when your body is ready, and ease off when it isn't.",
      "Log the first day of each period below. The app works out which phase you're in and shows you what to do each day.",
      "A typical cycle is 21 to 35 days. The app learns your own length as you log more periods.",
      "Go by how you feel. The phases are a guide, not a rule.",
    ],
  },
  ...PHASE_ORDER.map((key) => {
    const p = CYCLE_PHASES[key];
    return {
      heading: `${p.emoji} ${p.name}`,
      points: [p.tagline, ...p.feel, ...p.training.map((t) => `Training: ${t}`), ...p.nutrition.map((n) => `Food: ${n}`)],
    };
  }),
  {
    heading: "Every day, all month",
    points: [
      "Protein at every meal, plenty of vegetables, and 2 to 3 litres of water.",
      "Sleep 7 to 9 hours. Poor sleep throws hormones off more than almost anything else.",
      "Manage stress: walks outside, breathing, time off your phone. High stress can upset your cycle.",
      "Don't crash diet. Eating too little can make periods irregular or stop them altogether.",
    ],
  },
  {
    heading: "Supplements by phase",
    points: [
      "Most women do well on a simple base all month: vitamin D, omega-3 and magnesium.",
      ...PHASE_ORDER.flatMap((key) => CYCLE_PHASES[key].supplements.map((s) => `${CYCLE_PHASES[key].name}: ${s}`)),
      "Check with your doctor before starting supplements if you're pregnant, trying to fall pregnant, breastfeeding or on any medication.",
    ],
  },
  {
    heading: "When to see a doctor",
    points: [
      "Your period stops for 3 months or more and you're not pregnant.",
      "Very heavy bleeding (soaking a pad or tampon every hour or two), or bleeding between periods.",
      "Pain that stops you from getting through your day.",
      "Cycles shorter than 21 days or longer than 35 days, again and again.",
      "This guide is general information, not medical advice. If you're on hormonal contraception, your natural phases may not apply.",
    ],
  },
];

export const DEFAULT_CYCLE_LENGTH = 28;

/** Her average cycle length from logged period starts (newest first or any order); 28 until there are two. */
export function averageCycleLength(periodStarts: string[]): number {
  const sorted = [...new Set(periodStarts)].sort();
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = daysBetween(sorted[i - 1], sorted[i]);
    // Ignore gaps that can't be one cycle (a missed log, or a double entry).
    if (gap >= 18 && gap <= 45) gaps.push(gap);
  }
  // The last six cycles say most about how she runs now.
  const recent = gaps.slice(-6);
  if (recent.length === 0) return DEFAULT_CYCLE_LENGTH;
  return Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseIsoDate(toIso).getTime() - parseIsoDate(fromIso).getTime()) / 86_400_000);
}

function addDays(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/** Which phase a cycle day falls in. Ovulation is about 14 days before the next period. */
export function phaseForDay(cycleDay: number, cycleLength: number): CyclePhaseKey {
  const ovulationDay = cycleLength - 14;
  if (cycleDay <= 5) return "menstrual";
  if (cycleDay < ovulationDay - 1) return "follicular";
  if (cycleDay <= ovulationDay + 1) return "ovulation";
  return "luteal";
}

export interface CycleToday {
  cycleDay: number;
  cycleLength: number;
  phase: CyclePhase;
  /** Past her usual length, so her period is due or late. */
  periodDue: boolean;
  nextPeriodOn: string;
}

/** Where she is today, from her logged period starts. Null until she has logged one. */
export function cycleToday(periodStarts: string[], today: string): CycleToday | null {
  const past = periodStarts.filter((d) => d <= today).sort();
  const last = past[past.length - 1];
  if (!last) return null;
  const cycleLength = averageCycleLength(periodStarts);
  const cycleDay = daysBetween(last, today) + 1;
  return {
    cycleDay,
    cycleLength,
    phase: CYCLE_PHASES[phaseForDay(Math.min(cycleDay, cycleLength), cycleLength)],
    periodDue: cycleDay > cycleLength,
    nextPeriodOn: addDays(last, cycleLength),
  };
}

/** The phase on each of the next `days` days, for scheduling reminders. */
export function upcomingPhases(periodStarts: string[], fromIso: string, days: number): { date: string; phase: CyclePhase }[] {
  const out: { date: string; phase: CyclePhase }[] = [];
  const sorted = periodStarts.filter((d) => d <= fromIso).sort();
  const last = sorted[sorted.length - 1];
  if (!last) return out;
  const length = averageCycleLength(periodStarts);
  for (let i = 0; i < days; i++) {
    const date = addDays(fromIso, i);
    // Predicts ahead: after her usual length, assume the next period started on time.
    const day = ((daysBetween(last, date) % length) + length) % length;
    out.push({ date, phase: CYCLE_PHASES[phaseForDay(day + 1, length)] });
  }
  return out;
}
