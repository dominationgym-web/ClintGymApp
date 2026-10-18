// Feedback on the daily check-in (GRIZZ, 2026-10-12): the app reads the
// client's last week of check-ins and gives a few simple things to work on,
// each saying what the change will do for them. Rules only, no AI model, so
// it's instant, free and always says the same thing for the same answers.
import type { Checkin } from "@/types/database";
import { addDays } from "@/lib/programSchedule";

export type FeedbackTip = {
  key: string;
  icon: string;
  // What to work on, in one line.
  title: string;
  // What they did this week, so the tip feels like it's about them.
  because: string;
  // The adjustment to make.
  doThis: string;
  // What that adjustment will do.
  itWill: string;
  // Higher shows first.
  priority: number;
};

export type CheckinFeedback = {
  // How many check-ins the feedback is based on.
  days: number;
  tips: FeedbackTip[];
  // Something going well, to keep them motivated.
  win: string | null;
  // The day-by-day alcohol message (see alcoholMessage), or null.
  alcohol: AlcoholMessage | null;
};

export type AlcoholMessage = {
  kind: "session" | "slipped" | "firstDry" | "dryStreak" | "neverDrinks";
  title: string;
  text: string;
};

type Recent = Pick<
  Checkin,
  | "checkin_date"
  | "alcohol_units"
  | "sleep_bed_time"
  | "sleep_wake_time"
  | "sleep_quality"
  | "water_litres"
  | "meals_total"
  | "high_gi_count"
  | "wound_down"
  | "fatigue_status"
  | "pain_status"
  | "mental_status"
>;

// Water (nutrition review, 2026-10-18): about 33 ml per kg of body weight
// from drinks, plus extra on training days. Without a weight, 2 litres.
export const WATER_TARGET_LITRES = 2;
export const WATER_ML_PER_KG = 33;

/** The day's water target in litres, to the nearest 0.1 L, from body weight when known. */
export function waterTargetLitres(weightKg?: number | null): number {
  if (!weightKg || weightKg < 25 || weightKg > 400) return WATER_TARGET_LITRES;
  return Math.round((weightKg * WATER_ML_PER_KG) / 100) / 10;
}
export const SLEEP_TARGET_HOURS = 7;
export const MAX_TIPS = 3;

/** Hours between bed and wake ("22:30" to "06:00" is 7.5); null when either is missing. */
export function sleepHours(bed: string | null, wake: string | null): number | null {
  const mins = (t: string | null) => {
    const m = t?.match(/^(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const b = mins(bed);
  const w = mins(wake);
  if (b === null || w === null) return null;
  let diff = w - b;
  if (diff <= 0) diff += 24 * 60;
  const hours = diff / 60;
  // Anything outside 2 to 16 hours is a typo, not a night's sleep.
  return hours >= 2 && hours <= 16 ? hours : null;
}

const average = (values: number[]) => (values.length ? values.reduce((t, v) => t + v, 0) / values.length : null);
const one = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * Tips from the last 7 days of check-ins (newest first or any order). The
 * most important few come first; when everything looks good there are none
 * and `win` says so.
 */
export function checkinFeedback(all: Recent[], today: string, weightKg?: number | null): CheckinFeedback {
  const weekAgo = new Date(`${today}T12:00:00`);
  weekAgo.setDate(weekAgo.getDate() - 6);
  const from = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, "0")}-${String(weekAgo.getDate()).padStart(2, "0")}`;
  const week = all.filter((c) => c.checkin_date >= from && c.checkin_date <= today);
  const days = week.length;
  const tips: FeedbackTip[] = [];
  const wins: { text: string; strength: number }[] = [];
  if (days === 0) return { days, tips, win: null, alcohol: null };

  // Sleep length.
  const hours = week.map((c) => sleepHours(c.sleep_bed_time, c.sleep_wake_time)).filter((h): h is number => h !== null);
  const avgHours = average(hours);
  if (avgHours !== null && avgHours < SLEEP_TARGET_HOURS) {
    tips.push({
      key: "sleep",
      icon: "🌙",
      title: "Get more sleep",
      because: `You're averaging about ${one(Math.round(avgHours * 2) / 2)} hours a night.`,
      doThis: `Go to bed 30 minutes earlier and aim for ${SLEEP_TARGET_HOURS} to 9 hours.`,
      itWill: "Better recovery and strength, fewer cravings, more energy and a steadier mood. Short sleep makes fat loss harder.",
      priority: avgHours < 6 ? 95 : 80,
    });
  } else if (avgHours !== null) {
    wins.push({ text: `You're sleeping about ${one(Math.round(avgHours * 2) / 2)} hours a night. That's where recovery happens.`, strength: 3 });
  }

  // Sleep quality.
  const quality = average(week.map((c) => c.sleep_quality).filter((q): q is NonNullable<typeof q> => q !== null));
  if (quality !== null && quality <= 2.5) {
    tips.push({
      key: "sleepQuality",
      icon: "😴",
      title: "Improve your sleep quality",
      because: `Your sleep quality has been about ${one(Math.round(quality * 2) / 2)} out of 5.`,
      doThis: "Keep the room dark and cool, have your last caffeine at least 8 hours before bed, and put the phone away an hour before bed.",
      itWill: "Deeper sleep, so you wake up rested and recover faster from training.",
      priority: 70,
    });
  }

  // Winding down without screens.
  const answered = week.filter((c) => c.wound_down !== null);
  const noWindDown = answered.filter((c) => c.wound_down === false).length;
  if (answered.length >= 3 && noWindDown / answered.length >= 0.5 && !tips.some((t) => t.key === "sleepQuality")) {
    tips.push({
      key: "windDown",
      icon: "📵",
      title: "Wind down without screens",
      because: `You were on screens before bed on ${noWindDown} of ${answered.length} nights.`,
      doThis: "Put the phone down 30 to 60 minutes before bed. Read, stretch or take a warm shower instead.",
      itWill: "You fall asleep faster and sleep deeper, because screens keep your brain switched on.",
      priority: 45,
    });
  }

  // Water.
  const water = average(week.map((c) => Number(c.water_litres) || 0));
  const waterTarget = waterTargetLitres(weightKg);
  if (water !== null && water < waterTarget) {
    const more = Math.max(0.5, Math.round((waterTarget - water) * 2) / 2);
    tips.push({
      key: "water",
      icon: "💧",
      title: "Drink more water",
      because: `You're averaging ${one(Math.round(water * 10) / 10)} L a day.`,
      doThis: `Aim for about ${one(waterTarget)} L a day${weightKg ? " (about 30 to 35 ml per kg of your weight)" : ""}, plus extra on training days: add about ${one(more)} L with a big glass when you wake up and a bottle with you all day. Pale straw-coloured urine means you're drinking enough.`,
      itWill: "More energy, fewer cravings (thirst often feels like hunger), better workouts and better digestion.",
      priority: water < 1.5 ? 75 : 55,
    });
  } else if (water !== null) {
    wins.push({ text: `You're drinking about ${one(Math.round(water * 10) / 10)} L of water a day. Keep it up.`, strength: 2 });
  }

  // Alcohol has its own motivational message (alcoholMessage below), not a tip.

  // High-GI meals.
  const highGi = average(week.map((c) => Number(c.high_gi_count) || 0));
  if (highGi !== null && highGi >= 2) {
    tips.push({
      key: "highGi",
      icon: "🍞",
      title: "Swap some high-GI meals",
      because: `About ${one(Math.round(highGi * 10) / 10)} of your meals a day are high-GI (white bread, sweets, sugary drinks).`,
      doThis: "Keep fast carbs for around your workout. At other meals choose beans, lentils, boiled sweet potato, basmati or brown rice, wholewheat pasta or veg with your protein.",
      itWill: "Steadier energy, fewer sugar crashes and cravings, and meals that keep you full for longer, so it's easier to eat the right amount.",
      priority: highGi >= 3 ? 70 : 50,
    });
  }

  // Meals.
  const meals = average(week.map((c) => Number(c.meals_total) || 0).filter((m) => m > 0));
  // How many meals doesn't change fat loss when the food is the same
  // (review 2026-10-18), so with few meals the tip is only about protein.
  if (meals !== null && meals < 3) {
    tips.push({
      key: "meals",
      icon: "🍽",
      title: "Make each meal count for protein",
      because: `You're eating about ${one(Math.round(meals * 10) / 10)} meals a day.`,
      doThis: "Two or three meals is fine if it suits you. Make each one protein-heavy: about 2 palms of protein (meat, fish, eggs, maas, yoghurt or beans), plus veg. Use the meal plan maker under Nutrition if you need ideas.",
      itWill: "Enough protein to build and keep muscle, and meals that keep you full for longer.",
      priority: 60,
    });
  } else if (meals !== null && meals >= 3) {
    wins.push({ text: `You're eating ${one(Math.round(meals))} meals a day, each a chance to get your protein in.`, strength: 1 });
  }

  // Tiredness.
  const tired = week.filter((c) => c.fatigue_status === "reported").length;
  if (tired >= 2) {
    tips.push({
      key: "fatigue",
      icon: "🔋",
      title: "Look after your energy",
      because: `You felt run down on ${tired} days this week.`,
      doThis: "Put sleep first, eat enough, and tell your coach if training feels too much. A lighter session is fine. Tired most days for 2-3 weeks even when you sleep well? See your GP: it can be low iron, thyroid or not eating enough.",
      itWill: "You recover properly, so you come back stronger instead of burning out or getting injured.",
      priority: 75,
    });
  }

  // Stress.
  const stressed = week.filter((c) => c.mental_status === "reported").length;
  if (stressed >= 2) {
    tips.push({
      key: "stress",
      icon: "🧠",
      title: "Take time to switch off",
      because: `You felt mentally drained on ${stressed} days this week.`,
      doThis: "Take 5 minutes a day for slow breathing or a walk outside, and keep training even if it's lighter. Feeling low or overwhelmed for more than two weeks? Talk to your GP or SADAG.",
      itWill: "Lower stress, better sleep and fewer stress cravings. Exercise is one of the best stress relievers there is.",
      priority: 65,
    });
  }

  // Pain.
  const sore = week.filter((c) => c.pain_status === "reported").length;
  if (sore >= 1) {
    tips.push({
      key: "pain",
      icon: "🩹",
      title: "Train around your pain",
      because: `You reported pain on ${sore} day${sore === 1 ? "" : "s"} this week.`,
      doThis: "Your coach has been told. Go lighter or swap anything that hurts more than about 5 out of 10, or leaves it worse the next morning. If it isn't easing within 1-2 weeks, or there's swelling, numbness, night pain or it's getting worse, see a physio, biokineticist or doctor.",
      itWill: "It gives the area time to heal, so a niggle doesn't turn into an injury that stops you training.",
      priority: 90,
    });
  }

  if (days >= 5) wins.push({ text: `You checked in ${days} days this week. Consistency is what brings results.`, strength: 4 });

  tips.sort((a, b) => b.priority - a.priority);
  wins.sort((a, b) => b.strength - a.strength);
  return { days, tips: tips.slice(0, MAX_TIPS), win: wins[0]?.text ?? null, alcohol: alcoholMessage(all, today) };
}

// Alcohol message (GRIZZ, 2026-10-16): motivational, never derogatory. After
// a big session, a kind nudge to limit it plus water and a proper meal. Each
// alcohol-free day after that gets more praise and a different benefit. If
// they drink again after a good run, a coach's "you were doing so well", then
// back on it tomorrow. Always a reminder that honest answers only help them.
// Review 2026-10-18: units explained, no "disappointed", and after several
// heavy drinking days in 2 weeks a gentle pointer to a doctor or SANCA.
export const HEAVY_DAY_UNITS = 4;
export const HEAVY_SESSION_UNITS = 8;
// About 60 g of alcohol in a day (heavy drinking, WHO), at about 8 g a unit.
export const HEAVY_EPISODE_UNITS = 7;
// That many heavy days in the last 2 weeks brings the doctor or SANCA line.
export const HEAVY_EPISODES_FOR_HELP = 2;
export const UNIT_LINE = "(1 unit is about 1 tot of spirits, half a 340 ml beer, or a small 125 ml glass of wine.)";
const HELP_LINE =
  "If cutting down feels hard, talk to your doctor or SANCA (sanca.org.za). It's confidential, and asking for help is a strong move.";
export const EVOLVE_TAGLINE = "Our aim is to evolve daily, 1% at a time.";
const HONESTY = `Thanks for being honest. It only helps you, and it's the long term that matters. ${EVOLVE_TAGLINE}`;
const RECOVERY = "After a drinking session, drink extra water and have a proper meal.";
const BENEFITS = [
  "Your sleep is deeper, so you recover better from training.",
  "Your body is back to burning fat instead of clearing alcohol.",
  "Your mood and energy are steadier.",
  "Your workouts feel stronger and your muscles recover faster.",
  "Fewer cravings and better food choices.",
  "Better hydration, clearer skin and a sharper mind.",
];

/**
 * The alcohol message from the check-ins up to today (any order). Days with
 * no check-in are skipped, so the streak counts check-ins logged alcohol-free.
 */
export function alcoholMessage(all: Pick<Checkin, "checkin_date" | "alcohol_units">[], today: string): AlcoholMessage | null {
  const rows = all.filter((c) => c.checkin_date <= today).sort((a, b) => b.checkin_date.localeCompare(a.checkin_date));
  const units = rows.map((c) => Number(c.alcohol_units) || 0);
  if (units.length === 0) return null;
  const twoWeeksAgo = addDays(today, -13);
  const heavyDays = rows.filter((c) => c.checkin_date >= twoWeeksAgo && (Number(c.alcohol_units) || 0) >= HEAVY_EPISODE_UNITS).length;
  const help = heavyDays >= HEAVY_EPISODES_FOR_HELP ? ` You've had ${heavyDays} big drinking days in the last 2 weeks. ${HELP_LINE}` : "";

  if (units[0] > 0) {
    // The drinking days at the top make up this session.
    let i = 0;
    while (i < units.length && units[i] > 0) i++;
    const session = units.slice(0, i);
    let dry = 0;
    while (i + dry < units.length && units[i + dry] === 0) dry++;
    if (dry >= 2) {
      return {
        kind: "slipped",
        title: "🍷 Back on it tomorrow",
        text: `You were doing so well, ${dry} days alcohol-free. One session doesn't undo your progress. Start a new streak tomorrow. ${RECOVERY}${help} ${HONESTY}`,
      };
    }
    const total = session.reduce((t, u) => t + u, 0);
    const heavy = Math.max(...session) >= HEAVY_DAY_UNITS || total >= HEAVY_SESSION_UNITS;
    return {
      kind: "session",
      title: heavy ? "🍷 Time to limit the alcohol" : "🍷 Keep the alcohol low",
      text: `${heavy ? `That was a big session, ${one(total)} units.` : `You logged ${one(total)} units.`} ${UNIT_LINE} Limiting alcohol gives you better sleep and recovery, faster fat loss and a steadier mood. Let's aim for alcohol-free days this week. ${RECOVERY}${help} ${HONESTY}`,
    };
  }

  let streak = 0;
  while (streak < units.length && units[streak] === 0) streak++;
  const drankBefore = streak < units.length;
  if (!drankBefore) {
    if (units.length < 3) return null;
    return {
      kind: "neverDrinks",
      title: "💪 Alcohol-free",
      text: `No alcohol logged in ${units.length} check-ins. Great work. ${EVOLVE_TAGLINE}`,
    };
  }
  if (streak === 1) {
    return {
      kind: "firstDry",
      title: "✅ Alcohol-free day",
      text: `Well done, no alcohol yesterday. That's the first step. ${BENEFITS[0]} ${BENEFITS[1]} Keep it going. ${HONESTY}`,
    };
  }
  const benefit = BENEFITS[(streak - 1) % BENEFITS.length];
  const cheer = streak >= 5 ? "That's a real habit now, I'm proud of you." : streak >= 3 ? "You're building momentum." : "Two in a row, nice.";
  return {
    kind: "dryStreak",
    title: `🔥 ${streak} days alcohol-free`,
    text: `${streak} days alcohol-free. ${cheer} ${benefit} Every day adds up. ${HONESTY}`,
  };
}
