// Women's Health Reset: training, eating and supplementing around the
// menstrual cycle, in plain language, plus working out which phase a client is
// in from the period start dates she logs (0038).
//
// Day 1 is the first day of a period. Phase lengths follow a typical cycle and
// stretch or shrink with her own average cycle length. Everyone is different,
// so the guide says to go by how she feels, and the phases are a guide, not a
// rule. Research finds little consistent change in strength or performance
// across the cycle for most women (nutrition review, 2026-10-18), so the
// training and food tips are "some women notice", led by her own symptoms.
// Nothing here is medical advice.
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
      "Eat iron-rich food to replace what you lose: red meat, liver, eggs, lentils and beans. The iron in spinach is poorly absorbed, so don't rely on it.",
      "Have vitamin C with it (citrus, peppers, tomatoes) to help your body take in the iron from beans and lentils.",
      "Warm, comforting meals like soups and stews go down well.",
      "Drink plenty of water. It helps with bloating and headaches.",
    ],
    supplements: [
      "Magnesium (200 to 350 mg in the evening) may ease cramps for some women.",
      "Omega-3 fish oil can take the edge off period pain.",
      "Iron only if your periods are heavy or a blood test shows you're low. Ask your doctor first.",
    ],
    reminder: "Period phase: train to how you feel today, and eat iron-rich food.",
  },
  follicular: {
    key: "follicular",
    name: "Build phase",
    emoji: "🌒",
    tagline: "After your period. Oestrogen is rising, and many women feel their energy rise too.",
    feel: [
      "Some women notice energy, mood and motivation climb day by day.",
      "Others feel much the same all month. Both are normal.",
    ],
    training: [
      "Train as normal. If you feel strong and fresh, it's a good time to push: add a little weight or an extra set.",
      "Feel flat? Go by how you feel, not the calendar. Research finds little difference in strength across the cycle for most women.",
    ],
    nutrition: [
      "Have carbs like rice, potatoes, sweet potato or fruit around training to fuel it, as in any phase.",
      "Keep protein high at every meal to build muscle: meat, fish, eggs, yoghurt.",
      "Fresh, light meals with lots of vegetables suit this phase.",
    ],
    supplements: [
      "No special supplements needed. If you take creatine (3 to 5 g a day), keep taking it every day.",
      "A protein shake is a handy way to hit your protein after training.",
    ],
    reminder: "Build phase: if your energy is up, push your training a little, and keep your protein high.",
  },
  ovulation: {
    key: "ovulation",
    name: "Peak phase",
    emoji: "🌕",
    tagline: "Around ovulation. Hormones peak, and some women notice they feel their best.",
    feel: [
      "Some women notice more energy and confidence. Others notice no change.",
      "Some women feel a twinge on one side of the lower belly. That's normal.",
    ],
    training: [
      "Feel good? Train hard as normal. Adjust to how you feel on the day.",
      "Warm up properly and control every rep, as always.",
      "Take extra care with landing, jumping and twisting movements.",
    ],
    nutrition: [
      "Keep carbs around training to fuel your hardest sessions.",
      "Eat plenty of fibre (vegetables, fruit, beans, whole grains) for your gut and steady energy.",
      "Drink more water if you're training hard or it's hot.",
    ],
    supplements: [
      "No special supplements needed. Electrolytes help on sweaty, hard training days.",
    ],
    reminder: "Peak phase: feeling good? Have a strong session. Warm up well and go by how you feel.",
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
      "If PMS hits later on, steady, moderate sessions are fine: keep the weight, but do fewer heavy sets and take longer rests.",
      "Walks, swimming and pilates help with mood and bloating.",
      "Some women find workouts feel harder now. If you do, that's your hormones, not you going backwards.",
    ],
    nutrition: [
      "You burn a little more now, so a small extra snack (about 100 to 150 calories) is fine.",
      "Have protein and fibre at every meal to keep cravings in check.",
      "Craving chocolate? Pick dark chocolate. It's rich in magnesium.",
      "Cut back on salt, alcohol and caffeine to ease bloating, sore breasts and poor sleep.",
      "Complex carbs like sweet potato, brown rice and beans help mood and sleep.",
    ],
    supplements: [
      "Magnesium in the evening may help with PMS for some women (200 to 350 mg).",
      "Vitamin B6 may ease PMS for some women. Keep supplements to 10 mg a day or less unless your doctor advises more, and count the B6 in any multivitamin or magnesium-B6 product. Stop and see your doctor if you get tingling or numbness in your hands or feet.",
      "Calcium (from milk, maas, yoghurt or a supplement) has been shown to reduce PMS symptoms.",
    ],
    reminder: "Wind-down phase: train to how you feel, and have protein and fibre at every meal.",
  },
};

export const PHASE_ORDER: CyclePhaseKey[] = ["menstrual", "follicular", "ovulation", "luteal"];

/** The written guide shown on the Women's Health Reset page. */
export const WOMENS_HEALTH_GUIDE: GuidelineGroup[] = [
  {
    icon: "🔄",
    heading: "How it works",
    hook: "Work with your cycle, not against it.",
    points: [
      { emoji: "🌊", title: "Your body changes all month", text: "Your hormones change through the month, and so do your energy, strength, hunger and mood." },
      { emoji: "🤝", title: "Work with it", text: "For most women, research finds little change in strength across the cycle, but symptoms are real. Some women notice phases; track yours and adjust on the days they affect you." },
      { emoji: "🗓️", title: "Log your period", text: "Log the first day of each period below. The app works out which phase you're in and shows you what to do each day." },
      { emoji: "📏", title: "Your own length", text: "A typical cycle is 21 to 35 days. The app learns your own length as you log more periods." },
    ],
    closing: "Go by how you feel. The phases are a guide, not a rule.",
  },
  ...PHASE_ORDER.map((key): GuidelineGroup => {
    const p = CYCLE_PHASES[key];
    return {
      heading: `${p.emoji} ${p.name}`,
      hook: p.tagline,
      points: [
        ...p.feel.map((text) => ({ emoji: "💭", title: "How you may feel", text })),
        ...p.training.map((text) => ({ emoji: "🏋️", title: "Training", text })),
        ...p.nutrition.map((text) => ({ emoji: "🥗", title: "Food", text })),
      ],
    };
  }),
  {
    icon: "📅",
    heading: "Every day, all month",
    hook: "The basics matter in every phase.",
    points: [
      { emoji: "🥗", title: "Eat well", text: "Protein at every meal, plenty of vegetables, fruit and beans, milk, maas or yoghurt, and about 30 to 35 ml of water per kg of body weight." },
      { emoji: "🩸", title: "Watch your iron", text: "Women who train, have heavy periods or eat little red meat are often low in iron. Tired, breathless or pale? Ask your doctor for a ferritin (iron) blood test." },
      { emoji: "😴", title: "Sleep 7 to 9 hours", text: "Poor sleep throws hormones off more than almost anything else." },
      { emoji: "🧘", title: "Manage stress", text: "Walks outside, breathing, time off your phone. High stress can upset your cycle." },
      { emoji: "🚫", title: "Don't crash diet", text: "Eating too little for how much you train (RED-S) can make periods irregular or stop them, and weakens your bones. No period for 3 months while training or dieting? See your doctor." },
    ],
  },
  {
    icon: "💊",
    heading: "Supplements by phase",
    hook: "If you eat well, you don't need supplements for your cycle. Magnesium, omega-3 or calcium may help if you have clear PMS or period pain.",
    points: PHASE_ORDER.flatMap((key) =>
      CYCLE_PHASES[key].supplements.map((text) => ({ emoji: CYCLE_PHASES[key].emoji, title: CYCLE_PHASES[key].name, text }))
    ),
    closing: "Check with your doctor before starting supplements if you're pregnant, trying to fall pregnant, breastfeeding or on any medication.",
  },
  {
    icon: "🩺",
    heading: "When to see a doctor",
    points: [
      { emoji: "⏸️", title: "No period for 3 months", text: "Your period stops for 3 months or more and you're not pregnant. While training or dieting, it's a sign you're not eating enough (RED-S)." },
      { emoji: "🩸", title: "Tired and low on iron?", text: "Tired, breathless or pale, especially with heavy periods: ask for a ferritin (iron) test." },
      { emoji: "🩸", title: "Very heavy bleeding", text: "Soaking a pad or tampon every hour or two, or bleeding between periods." },
      { emoji: "😣", title: "Pain that stops your day", text: "Pain that stops you from getting through your day." },
      { emoji: "📆", title: "Irregular cycles", text: "Cycles shorter than 21 days or longer than 35 days, again and again." },
    ],
    closing: "This guide is general information, not medical advice. If you're on hormonal contraception, your natural phases may not apply.",
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

// A week before each period, a reminder to stock up on the supplements for
// the period and the days around it (GRIZZ, 2026-10-14), so she has them in
// time. Taken from the Period and Wind-down supplements above.
export const SUPPLEMENT_PREP_DAYS = 7;
// Only for women who use them for PMS or period pain (nutrition review,
// 2026-10-18): B6 at 10 mg a day or less.
export const SUPPLEMENT_PREP_LIST = [
  "Magnesium, if it helps your cramps or PMS (200 to 350 mg)",
  "Omega-3 fish oil, if it helps your period pain",
  "Calcium, if it helps your PMS",
  "Vitamin B6, only if it helps your PMS, and 10 mg a day or less",
  "Iron, only if your periods are heavy and your doctor agrees",
];
export const SUPPLEMENT_PREP_TITLE = "🛒 Your period is due in about a week";
export const SUPPLEMENT_PREP_BODY =
  "If you use supplements for PMS or period pain, check you have them ready. Vitamin B6: 10 mg a day or less. Iron only if your doctor says so.";

/** The predicted start of each of her next `count` periods after `fromIso`. */
export function nextPeriodStarts(periodStarts: string[], fromIso: string, count: number): string[] {
  const sorted = periodStarts.filter((d) => d <= fromIso).sort();
  const last = sorted[sorted.length - 1];
  if (!last) return [];
  const length = averageCycleLength(periodStarts);
  const out: string[] = [];
  for (let k = 1; out.length < count && k < count + 24; k++) {
    const start = addDays(last, k * length);
    if (start > fromIso) out.push(start);
  }
  return out;
}

/** The days to send the supplement reminder: a week before each of her next `count` periods, today or later. */
export function supplementPrepDates(periodStarts: string[], fromIso: string, count: number): string[] {
  return nextPeriodStarts(periodStarts, fromIso, count + 1)
    .map((start) => addDays(start, -SUPPLEMENT_PREP_DAYS))
    .filter((d) => d >= fromIso)
    .slice(0, count);
}

/** Days until her next period when it's within the week before it (1 to 7), else null. */
export function supplementPrepDaysLeft(today: CycleToday | null, todayIsoDate: string): number | null {
  if (!today || today.periodDue) return null;
  const left = daysBetween(todayIsoDate, today.nextPeriodOn);
  return left >= 1 && left <= SUPPLEMENT_PREP_DAYS ? left : null;
}

