// Sports Performance (GRIZZ, 2026-10-14): 15 short programs of 6-8 weeks,
// three each for explosive power, speed, strength, mobility and flexibility.
// The programs themselves are built-ins in the database (0093); the trainer
// puts a client on one from the program picker. This file describes them on
// the client's Sports Performance menu page.
import type { GuidelineGroup } from "@/lib/sleep";

export type SportsCategory = "power" | "speed" | "strength" | "mobility" | "flexibility";

export type SportsProgram = { name: string; weeks: 6 | 8; category: SportsCategory; level: string; summary: string };

// Names must match 0093 exactly.
export const SPORTS_PROGRAMS: SportsProgram[] = [
  { name: "Explosive Power 1 – Jump & Throw Basics", weeks: 6, category: "power", level: "New to jump training", summary: "Learn to jump, land and throw with good form, then add speed: higher jumps and a quicker first step." },
  { name: "Explosive Power 2 – Strength to Power", weeks: 6, category: "power", level: "Already lifting", summary: "Heavy lifts paired with jumps and throws (contrast training) to turn your strength into power." },
  { name: "Explosive Power 3 – Elite Power", weeks: 8, category: "power", level: "Experienced and strong", summary: "Olympic lifts, depth jumps and max-effort throws for peak power." },
  { name: "Speed 1 – Acceleration", weeks: 6, category: "speed", level: "All levels", summary: "A faster first 5-20 metres: first step, forward lean and leg drive, plus gym strength for speed." },
  { name: "Speed 2 – Top Speed", weeks: 6, category: "speed", level: "Already sprinting", summary: "Flying sprints, sprint drills and bounding to raise your top speed." },
  { name: "Speed 3 – Agility & Change of Direction", weeks: 6, category: "speed", level: "Field and court sports", summary: "Cut, shuffle, turn and re-accelerate faster, with the leg strength to stop and go safely." },
  { name: "Sports Strength 1 – Base Strength", weeks: 8, category: "strength", level: "New to strength training", summary: "Three full-body sessions a week on the big lifts, plus hamstring and core work that protects you." },
  { name: "Sports Strength 2 – Single-Leg & Athletic", weeks: 6, category: "strength", level: "All levels", summary: "Strength one side at a time for running, cutting and landing, and to even out left-right differences." },
  { name: "Sports Strength 3 – Max Strength", weeks: 8, category: "strength", level: "Experienced lifters", summary: "Heavy squats, bench, deadlifts and weighted pull-ups, from sets of 5 to sets of 3." },
  { name: "Mobility 1 – Hips & Ankles", weeks: 6, category: "mobility", level: "Everyone", summary: "Open up stiff hips and ankles to squat deeper, move better and ease knee and back strain." },
  { name: "Mobility 2 – Spine & Shoulders", weeks: 6, category: "mobility", level: "Everyone", summary: "A looser upper back and shoulders for reaching, throwing, swinging and better posture." },
  { name: "Mobility 3 – Full-Body Flow", weeks: 6, category: "mobility", level: "Everyone", summary: "A flowing routine from head to toe: great on rest days." },
  { name: "Flexibility 1 – Lower Body", weeks: 6, category: "flexibility", level: "Everyone", summary: "Looser hamstrings, hips, quads, glutes and calves." },
  { name: "Flexibility 2 – Upper Body & Spine", weeks: 6, category: "flexibility", level: "Everyone", summary: "Open up the chest, lats, shoulders, neck and spine." },
  { name: "Flexibility 3 – Splits & Deep Range", weeks: 6, category: "flexibility", level: "Martial arts, dance, goalkeepers", summary: "Work towards front and side splits with contract-relax stretching." },
];

const CATEGORIES: { category: SportsCategory; icon: string; heading: string; hook: string }[] = [
  { category: "power", icon: "💥", heading: "Explosive Power", hook: "Jump higher, hit harder, get off the mark faster." },
  { category: "speed", icon: "🚀", heading: "Speed", hook: "Speed is a skill: short, all-out sprints with full rest." },
  { category: "strength", icon: "🏆", heading: "Strength", hook: "Stronger athletes are faster, more powerful and harder to injure." },
  { category: "mobility", icon: "🔄", heading: "Mobility", hook: "Mobility is control through a full range, not just being stretchy." },
  { category: "flexibility", icon: "🧘", heading: "Flexibility", hook: "Hold, breathe, relax: a little range gained every session." },
];

const PROGRAM_EMOJI = ["1️⃣", "2️⃣", "3️⃣"];

export const SPORTS_PERFORMANCE_GUIDE: GuidelineGroup[] = [
  {
    icon: "🏅",
    heading: "How it works",
    hook: "Short, focused programs to make you a better athlete.",
    points: [
      { emoji: "📅", title: "6 to 8 weeks", text: "Each program runs for 6 or 8 weeks, three sessions a week (Monday, Wednesday and Friday), and gets harder as you go." },
      { emoji: "🙋", title: "Ask your coach", text: "Tell your coach which one you'd like. They'll put it on your Training page, and you'll see each day's session like any other workout." },
      { emoji: "▶️", title: "Videos and guides", text: "Every exercise has a How to do it guide. Most stretches, mobility moves and sprint drills don't have a video in the app yet, so their guide has a link to watch examples online." },
      { emoji: "🔥", title: "Warm up first", text: "Each program has its own warm-up. Never jump, sprint or stretch cold." },
      { emoji: "⏱️", title: "Quality over tiredness", text: "For power and speed, every rep is all-out with full rest. If you slow down, stop the set. For stretches, the interval timer counts your holds." },
    ],
  },
  ...CATEGORIES.map(({ category, icon, heading, hook }) => ({
    icon,
    heading,
    hook,
    points: SPORTS_PROGRAMS.filter((p) => p.category === category).map((p, i) => ({
      emoji: PROGRAM_EMOJI[i] ?? "•",
      title: p.name,
      text: `${p.weeks} weeks · ${p.level}. ${p.summary}`,
    })),
  })),
];
