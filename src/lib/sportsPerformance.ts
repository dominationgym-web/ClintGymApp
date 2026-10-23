// Sports Performance (GRIZZ, 2026-10-14): 15 short programs of 6-8 weeks,
// three each for explosive power, speed, strength, mobility and flexibility,
// plus a 4-week lower back stretch under Flexibility (2026-10-18).
// The programs themselves are built-ins in the database (0093); the trainer
// puts a client on one from the program picker. This file describes them in
// the trainer's menu (GRIZZ: trainer side only, not the client menu).
import type { TrainerGuide } from "@/lib/trainerGuides";

export type SportsCategory = "power" | "speed" | "strength" | "mobility" | "flexibility";

export type SportsProgram = { name: string; weeks: 4 | 6 | 8; category: SportsCategory; level: string; summary: string };

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
  { name: "Flexibility 4 – Lower Back Release", weeks: 4, category: "flexibility", level: "Tight lower back", summary: "A short, gentle routine for the hips, glutes, hamstrings and spine." },
];

// Off-season programs (GRIZZ, 2026-10-23): one 8-week gym program per sport,
// built-ins in the database (0144). Names must match 0144 exactly.
export const OFF_SEASON_PROGRAMS: { name: string; summary: string }[] = [
  { name: "Off-Season – Soccer", summary: "Hamstrings that hold up to sprinting, strong hips and groin, a big engine and repeated-sprint speed." },
  { name: "Off-Season – Rugby", summary: "Strength and size for contact, a strong neck and upper back, speed off the mark and repeat-effort fitness." },
  { name: "Off-Season – American Football", summary: "Explosive hips for the first step, neck and shoulder strength, and conditioning shaped like a drive." },
  { name: "Off-Season – Baseball", summary: "Rotational power for hitting and throwing, healthy shoulders and elbows, and fast first steps." },
  { name: "Off-Season – Basketball", summary: "A higher jump, soft landings, tough ankles and knees, quick defensive slides and fitness for the whole game." },
  { name: "Off-Season – Tennis", summary: "Quick lateral movement, rotational power for serves, healthy shoulders, elbows and wrists." },
  { name: "Off-Season – Enduro Riding", summary: "Legs for the standing position, grip against arm pump, a strong neck, back and core, and a big engine." },
  { name: "Off-Season – Cycling", summary: "More power on the pedals, a strong back and core for your position, a bigger base and a sharper sprint." },
  { name: "Off-Season – Mountain Biking", summary: "Legs for punchy climbs, upper body and grip for rough descents, sprint power and a big base." },
];

const CATEGORIES: { category: SportsCategory; icon: string; heading: string; hook: string }[] = [
  { category: "power", icon: "💥", heading: "Explosive Power", hook: "Jump higher, hit harder, get off the mark faster." },
  { category: "speed", icon: "🚀", heading: "Speed", hook: "Speed is a skill: short, all-out sprints with full rest." },
  { category: "strength", icon: "🏆", heading: "Strength", hook: "Stronger athletes are faster, more powerful and harder to injure." },
  { category: "mobility", icon: "🔄", heading: "Mobility", hook: "Mobility is control through a full range, not just being stretchy." },
  { category: "flexibility", icon: "🧘", heading: "Flexibility", hook: "Hold, breathe, relax: a little range gained every session." },
];

export const SPORTS_PERFORMANCE_GUIDE: TrainerGuide = {
  key: "sportsPerformance",
  title: "Sports Performance",
  icon: "🏅",
  accent: "#F59E0B",
  summary: "16 programs for explosive power, speed, strength, mobility and flexibility (including a lower back stretch), 9 off-season sport programs, and who each one suits.",
  topics: [
    {
      title: "How the programs work",
      icon: "🏅",
      intro: "Short, focused programs to make your clients better athletes. Put a client on one from the program picker, under the Sports Performance headings.",
      groups: [
        {
          heading: "The basics",
          points: [
            "Each program runs 6 or 8 weeks (the lower back stretch 4), three sessions a week (Monday, Wednesday and Friday), and builds as it goes.",
            "8-week programs have an easy week 4 and a test week 8 at half the sets. In the test week the client tests their best clean set on the main lifts (Sports Strength) or measures a broad jump and a throw (Explosive Power 3).",
            "Mobility and Flexibility are in the picker for home clients too; the others need a gym, a field or both.",
            "Each program has its own warm-up and nutrition notes, shown to the client with the workout.",
          ],
        },
        {
          heading: "Videos",
          points: [
            "Every exercise has a How to do it guide. Most stretches, mobility moves and sprint drills have no MoveKit clip, so their guide has a link to examples online.",
            "Upload your own clip and it can be linked to the move by name.",
          ],
        },
      ],
    },
    ...CATEGORIES.map(({ category, icon, heading, hook }) => ({
      title: heading,
      icon,
      intro: hook,
      groups: SPORTS_PROGRAMS.filter((p) => p.category === category).map((p) => ({
        heading: p.name,
        points: [`${p.weeks} weeks. Best for: ${p.level}.`, p.summary],
      })),
    })),
    {
      title: "Off-season",
      icon: "🏟️",
      intro: "One 8-week gym program per sport for the off-season, under Off-season in the program picker (Sport goal).",
      groups: [
        {
          heading: "How they work",
          points: [
            "Field and court sports: Monday lower body strength, Tuesday conditioning, Wednesday easy zone 2 and mobility, Thursday upper body and trunk, Friday speed and power, Saturday play or rest, Sunday rest.",
            "Cycling and mountain biking: two strength days, an interval ride, a recovery ride, a sprint day and a long ride on Saturday. Enduro riding adds grip and neck work.",
            "Weeks 1-3 build (sets go up), week 4 is a recovery week, weeks 5-7 turn strength into power, and week 8 is a test week before pre-season.",
            "No overhead pressing. Each program has its own nutrition notes and warm-up.",
          ],
        },
        ...OFF_SEASON_PROGRAMS.map((p) => ({ heading: p.name, points: [p.summary] })),
      ],
    },
  ],
};
