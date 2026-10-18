// Sleep & Recovery: the guideline content for its menu section, and the
// nightly wind-down tip clients get at 6pm. The guidance follows the current
// consensus from sleep research (consistent timing, morning light, caffeine
// and alcohol timing, a cool dark room, a screen-free wind-down), written
// simply enough to follow without reading up on it.
import { toIsoDate } from "@/lib/dates";

// One line of a menu guide, laid out like Understanding Insulin: an emoji in
// a circle, a short bold title and the detail underneath.
export type GuidelinePoint = { emoji: string; title: string; text: string };

// icon: an emoji shown beside the heading on the section page.
// hook: a punchy line in a gold box at the top. closing: a line to finish on.
export type GuidelineGroup = { heading: string; points: GuidelinePoint[]; icon?: string; hook?: string; closing?: string };

/** A point as one plain line, for search. */
export function pointLine(p: GuidelinePoint): string {
  return `${p.title}. ${p.text}`;
}

export const SLEEP_GUIDELINES: GuidelineGroup[] = [
  {
    icon: "⭐",
    heading: "The basics",
    hook: "A steady wake-up time does more for your sleep than an early night.",
    points: [
      { emoji: "⏱️", title: "7 to 9 hours", text: "Aim for 7 to 9 hours of sleep a night. Give yourself 8 to 9 hours in bed to get it." },
      { emoji: "⏰", title: "Same wake-up time", text: "Wake up at the same time every day, weekends included." },
      { emoji: "🥱", title: "Sleepy, not just tired", text: "Go to bed when you feel sleepy, not just tired, and within about an hour of the same time each night." },
    ],
  },
  {
    icon: "☀️",
    heading: "During the day",
    hook: "Good sleep starts the moment you wake up.",
    points: [
      { emoji: "🌤️", title: "Morning daylight", text: "Get outside within an hour of waking: 5 to 10 minutes of daylight on a clear day, 15 to 30 when it's cloudy. No sunglasses if it's safe." },
      { emoji: "☕", title: "Caffeine 8 hours before bed", text: "Have your last coffee or energy drink at least 8 hours before bed (about 2pm for a 10pm bedtime), and a big pre-workout dose 12 hours before. Caffeine stays in your body for hours." },
      { emoji: "🏃", title: "Move every day", text: "Finish hard training at least 2 hours before bed." },
      { emoji: "💤", title: "Short naps only", text: "Keep naps short (20 minutes or less) and before 3pm." },
    ],
  },
  {
    icon: "🌆",
    heading: "In the evening",
    hook: "Slow down before bed and your body follows.",
    points: [
      { emoji: "🍽️", title: "Eat early", text: "Finish your last big meal 2 to 3 hours before bed." },
      { emoji: "🍷", title: "Go easy on alcohol", text: "Keep alcohol low and stop at least 3 hours before bed. It knocks you out but ruins the quality of your sleep." },
      { emoji: "💡", title: "Dim the lights", text: "Dim the lights in the house after dinner." },
      { emoji: "📵", title: "Screens away", text: "Put your phone, laptop and TV away an hour before bed, and charge your phone outside the bedroom." },
      { emoji: "🛁", title: "Wind down", text: "Have a 30 to 60 minute wind-down: a warm shower, light stretching, reading or breathing." },
    ],
  },
  {
    icon: "🛏️",
    heading: "Your bedroom",
    hook: "Cool, dark and quiet.",
    points: [
      { emoji: "❄️", title: "Cool", text: "Around 18 to 20°C." },
      { emoji: "🌑", title: "Dark", text: "Blackout curtains or an eye mask, and no standby lights." },
      { emoji: "🤫", title: "Quiet", text: "Earplugs or a fan if you need them." },
      { emoji: "🛏️", title: "Bed is for sleep", text: "No scrolling, work or TV in bed." },
    ],
  },
  {
    icon: "😴",
    heading: "Can't fall asleep?",
    hook: "Don't lie there fighting it.",
    points: [
      { emoji: "📖", title: "Get up after 20 minutes", text: "If you're still awake after about 20 minutes, get up. Do something calm in dim light, like reading, and go back to bed when you feel sleepy." },
      { emoji: "🕰️", title: "Hide the clock", text: "Don't watch the clock. Turn it away from you." },
      { emoji: "📝", title: "Empty your head", text: "Write tomorrow's to-do list before bed so it isn't in your head." },
    ],
  },
  {
    icon: "🔋",
    heading: "Recovery",
    hook: "You don't grow in the gym. You grow while you recover.",
    points: [
      { emoji: "😴", title: "Sleep comes first", text: "Sleep is your number one recovery tool. Muscle repair and most of your recovery happen while you sleep." },
      { emoji: "🗓️", title: "Rest days", text: "Take 1 to 2 full rest days a week. A walk or light stretching on rest days helps you recover." },
      { emoji: "🪫", title: "After a bad night", text: "Train lighter that day instead of skipping or pushing through hard." },
      { emoji: "💧", title: "Protein and water", text: "Spread your protein across the day and drink water steadily, not all at once." },
    ],
  },
  {
    icon: "🩺",
    heading: "When to see a doctor",
    points: [
      { emoji: "😮‍💨", title: "Snoring or gasping", text: "Loud snoring, gasping or choking at night, or feeling exhausted even after a full night's sleep." },
      { emoji: "📆", title: "3 weeks of bad sleep", text: "Trouble sleeping most nights for more than 3 weeks." },
    ],
  },
];

// One of these shows each night at 6pm, a different one each night.
export const NIGHTLY_TIPS: string[] = [
  "Plan your wind-down: an hour before bed, phone away and lights down.",
  "Dim the lights in the house tonight. Bright light late in the evening pushes your sleep later.",
  "Finish your last big meal 2 to 3 hours before bed tonight.",
  "Charge your phone outside the bedroom tonight.",
  "Tonight, swap scrolling for 10 minutes of reading or stretching before bed.",
  "Keep tonight alcohol-free or stop 3 hours before bed. Your sleep will thank you.",
  "Is your bedroom cool, dark and quiet? Around 18 to 20°C is ideal.",
  "Try a warm shower an hour or two before bed. It helps your body cool down for sleep.",
  "Write tomorrow's to-do list now, so it's out of your head at bedtime.",
  "Set tomorrow's wake-up time. Same time as today, even if it's the weekend.",
  "Try 5 minutes of slow breathing in bed: in for 4, out for 6.",
  "Can't sleep after 20 minutes? Get up, read in dim light, and go back when you're sleepy.",
  "No TV or work in bed tonight. Keep the bed for sleep.",
  "Lay out tomorrow's training gear tonight. One less thing to think about.",
];

export const SLEEP_REMINDER_HOUR = 18;

/** The tip for a given night. It moves on one tip per calendar day. */
export function nightlyTipFor(date: Date): string {
  // Days since a fixed local date, so the tip changes at midnight local time.
  const start = new Date(2026, 0, 1);
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((day.getTime() - start.getTime()) / 86_400_000);
  const n = NIGHTLY_TIPS.length;
  return NIGHTLY_TIPS[((days % n) + n) % n];
}

/** The next `nights` 6pm reminders after `now`, each with that night's tip. */
export function upcomingSleepReminders(now: Date, nights: number): { at: Date; tip: string; id: string }[] {
  const result: { at: Date; tip: string; id: string }[] = [];
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), SLEEP_REMINDER_HOUR, 0, 0, 0);
  if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);
  for (let i = 0; i < nights; i++) {
    const night = new Date(at);
    result.push({ at: night, tip: nightlyTipFor(night), id: `sleep-reminder-${toIsoDate(night)}` });
    at.setDate(at.getDate() + 1);
  }
  return result;
}

/** True from 6pm until 4am, when tonight's tip shows in the app. */
export function isWindDownTime(now: Date): boolean {
  const h = now.getHours();
  return h >= SLEEP_REMINDER_HOUR || h < 4;
}

/** The tip shown in the app now: tonight's, or last night's in the small hours. */
export function currentNightTip(now: Date): string {
  const night = new Date(now);
  if (now.getHours() < 4) night.setDate(night.getDate() - 1);
  return nightlyTipFor(night);
}
