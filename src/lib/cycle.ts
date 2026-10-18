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

// Perimenopause and menopause (nutrition review, 2026-10-18): for women about
// 40 to 55 whose periods are changing or have stopped, where the phase guide
// doesn't fit. Menopause Society 2022/2023 position statements, IMS 2024 white
// paper on lifestyle, LIFTMOR (Watson et al. 2018) on heavier lifting and
// impact for bone, ESCEO on protein. Anything medical is "talk to your doctor".
export const MENOPAUSE_HEADING = "Perimenopause and menopause";
export const MENOPAUSE_GUIDE: GuidelineGroup[] = [
  {
    icon: "🌡️",
    heading: MENOPAUSE_HEADING,
    hook: "From your 40s, periods can become irregular, then stop. What you do in the gym and the kitchen makes a big difference now.",
    points: [
      { emoji: "🔄", title: "What's happening", text: "Perimenopause is the few years of change before your last period, often starting in your 40s. Menopause is when you've had no period for 12 months, on average around 51. Oestrogen swings up and down, then falls." },
      { emoji: "🔥", title: "Common symptoms", text: "Hot flushes and night sweats, poorer sleep, mood changes, brain fog, joint aches, and periods that come closer together, further apart, heavier or lighter." },
      { emoji: "🦴", title: "Muscle and bone", text: "Lower oestrogen speeds up muscle and bone loss, most of all in the years around your last period. Strength training and eating enough protein slow it down." },
      { emoji: "📏", title: "Fat moves to the middle", text: "Fat tends to shift to your belly, even if your weight stays the same. Measure your waist, not just your weight." },
      { emoji: "🗓️", title: "Your cycle tracker", text: "If your periods are irregular or have stopped, the phase guide won't fit. In the cycle tracker, turn on \"My periods are irregular or have stopped\" and go by how you feel each day." },
      { emoji: "🩺", title: "Talk to your doctor", text: "About hot flushes, sleep, mood, or heavy or irregular bleeding. Ask about all your options, including hormone therapy (HRT, also called MHT). That's a decision to make with your doctor." },
    ],
    closing: "This is general information, not medical advice. Any bleeding after a year with no period: see your doctor.",
  },
  {
    icon: "🏋️",
    heading: "Menopause: how to train",
    hook: "Lift heavier than you think, and add a little impact. Your muscles and bones respond at any age.",
    points: [
      { emoji: "💪", title: "Strength train 2 to 3 times a week", text: "Work your whole body with weights that feel hard by the last 2 or 3 reps. Add weight slowly over the weeks. Heavier weights, built up with good form, are safe for most women and do the most for bone." },
      { emoji: "🦘", title: "Some impact for your bones", text: "Small jumps, skipping, hopping or a bouncy step-up, as your joints allow. Start with 10 to 20 low jumps a few days a week and build up slowly." },
      { emoji: "⚖️", title: "Balance and walking", text: "Balance work (standing on one leg, step-ups) helps prevent falls, and brisk walking or cycling keeps your heart healthy." },
      { emoji: "🩺", title: "Check first if", text: "You have osteoporosis or have broken a bone from a small fall, or you leak urine when you jump. Your doctor or a physio can tell you what's safe. Leaking is common and a pelvic floor physio can help." },
      { emoji: "😴", title: "Train to how you slept", text: "After a bad night, keep the session but go a bit lighter. Joint aches are common: change the exercise before you skip it." },
    ],
    closing: "Your coach can set your program up for this. Tell them if your periods have changed.",
  },
  {
    icon: "🥛",
    heading: "Menopause: food, sleep and hot flushes",
    hook: "More protein, enough calcium and vitamin D, and a cool, dark bedroom.",
    points: [
      { emoji: "🍗", title: "Protein at every meal", text: "About 1.2 to 1.6 g per kg of body weight a day, spread over your meals with about 25 to 30 g at each: meat, fish, eggs, milk, maas, yoghurt, beans or lentils. Your muscles need more now to respond to training." },
      { emoji: "🥛", title: "Calcium", text: "About 1,000 to 1,200 mg a day, mostly from food: milk, maas, yoghurt, cheese, and tinned sardines or pilchards with the bones. A cup of milk has about 300 mg." },
      { emoji: "☀️", title: "Vitamin D", text: "From safe sun, oily fish and eggs. Many people are low. Ask your doctor whether you need a test or a supplement." },
      { emoji: "⚡", title: "Creatine (optional)", text: "3 to 5 g a day may help muscle and strength alongside strength training. Research on bone is still mixed. Check with your doctor if you have kidney problems." },
      { emoji: "🔥", title: "Hot flushes", text: "Dress in layers, keep a fan handy and notice your triggers. Alcohol, caffeine, spicy food and hot drinks set them off for many women." },
      { emoji: "🌙", title: "Sleep", text: "Keep the bedroom cool and dark, wake at the same time every day, and cut back on alcohol and late caffeine. Poor sleep for weeks? Talk to your doctor: there's help that works." },
      { emoji: "🚫", title: "No crash diets", text: "Big cuts speed up muscle and bone loss. A small deficit with high protein and strength training is the way to lose fat now." },
    ],
  },
];

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
  // Nutrition review (2026-10-18): iron and low energy availability are the
  // most common, most missed problems in women who train (IOC REDs consensus
  // 2023; Pedlar et al. 2018).
  {
    icon: "🩸",
    heading: "Iron and eating enough",
    hook: "Low iron and not eating enough are two of the most common problems in women who train, and both are easy to miss.",
    points: [
      { emoji: "⚠️", title: "Signs to watch", text: "Missed or stopped periods, injuries that keep coming back or a stress fracture, tired all the time, low mood, getting ill often, or training getting worse instead of better." },
      { emoji: "🍽️", title: "Eat enough for your training", text: "Eating too little for how much you train (RED-S) upsets your hormones, weakens your bones and stalls your progress, even if your weight doesn't change. Don't cut food hard while training hard." },
      { emoji: "🥩", title: "Iron-rich food", text: "Red meat, liver, chicken, fish and eggs are the best sources. Beans, lentils and iron-fortified bread and maize meal help too. The iron in spinach is poorly absorbed." },
      { emoji: "🍊", title: "Help it absorb", text: "Have vitamin C with iron-rich meals (citrus, peppers, tomatoes). Keep tea and coffee for an hour or so away from those meals." },
      { emoji: "🩸", title: "Heavy periods", text: "Heavy periods lose a lot of iron. Soaking a pad or tampon every hour or two, or periods longer than 7 days, are worth seeing your doctor about." },
      { emoji: "🧪", title: "Get a ferritin test", text: "Tired, breathless or pale? Ask your doctor for a ferritin (iron) blood test. Only take iron if the test shows you need it: too much is harmful." },
    ],
    closing: "No period for 3 months, a stress fracture, or worried about food or your weight? See your doctor. A registered dietitian can help you eat enough.",
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
      { emoji: "🌡️", title: "Changes after 40", text: "Hot flushes, night sweats, poor sleep, mood changes or periods changing: talk to your doctor about perimenopause. Any bleeding after a year with no period: see your doctor." },
    ],
    closing: "This guide is general information, not medical advice. If you're on hormonal contraception, your natural phases may not apply.",
  },
  ...MENOPAUSE_GUIDE,
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

/**
 * Whether her logged periods look irregular enough that the phase guide may
 * not fit, so the tracker can suggest the "irregular or stopped" setting.
 * Follows the STRAW+10 signs of perimenopause: cycle lengths that keep
 * differing by 7 days or more (3 times in her last six cycles, so one long
 * cycle or a missed log isn't enough), or 60 days or more since her last
 * logged period. Gaps under 18 days are double entries.
 */
export function cycleLooksIrregular(periodStarts: string[], today: string): boolean {
  const sorted = [...new Set(periodStarts.filter((d) => d <= today))].sort();
  const last = sorted[sorted.length - 1];
  if (!last) return false;
  if (daysBetween(last, today) >= 60) return true;
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = daysBetween(sorted[i - 1], sorted[i]);
    if (gap >= 18) gaps.push(gap);
  }
  const recent = gaps.slice(-6);
  let bigChanges = 0;
  for (let i = 1; i < recent.length; i++) if (Math.abs(recent[i] - recent[i - 1]) >= 7) bigChanges++;
  return bigChanges >= 3;
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

