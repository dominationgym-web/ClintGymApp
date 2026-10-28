// Muscle Year for coaches (GRIZZ, 2026-10-24): the trainer side of the three
// 52-week muscle building programs (0150) and the client's "Muscle building:
// your BMR and macros" (muscleYear.ts). Built on the hypertrophy research:
// volume and frequency meta-analyses (Schoenfeld 2016/2017, Pelland 2024),
// proximity to failure (Robinson 2024), lengthened-position training (Wolf
// 2023), the deload consensus (Bell 2023), rate of gain (Iraki 2019) and
// protein (Morton 2018).
import type { TrainerGuide } from "@/lib/trainerGuides";

export const MUSCLE_YEAR_TRAINER_GUIDE: TrainerGuide = {
  key: "muscleYear",
  title: "Muscle Year (1-year muscle building)",
  icon: "📅",
  accent: "#D4AF37",
  summary: "How the 3, 4 and 5 day programs work, which to pick, and how to manage recovery and nutrition over the year.",
  topics: [
    {
      title: "Which program to give",
      icon: "🎯",
      intro: "Pick the one that matches the days the client can really train every week. Three good weeks beat five planned ones.",
      groups: [
        {
          heading: "Days a week",
          points: [
            "3 days (Mon, Wed, Fri): full body every session. Best for busy clients and beginners who have finished a Foundation program.",
            "4 days (Mon, Tue, Thu, Fri): upper and lower body twice each. The best fit for most intermediate clients.",
            "5 days (Mon-Fri): upper, lower, push, pull and legs. For experienced clients who recover well and can train 60-75 minutes.",
            "Put it on from the client's calendar: tap a day > A whole program > Build muscle > Muscle Year. Keep the program's own days ticked.",
            "Fewer days than the program has makes it run longer than a year and the plan stops at 52 weeks. Pick the version that matches their days instead.",
          ],
        },
        {
          heading: "Starting part-way",
          points: [
            "You can start at block 1, 2, 3 or 4. A client who has trained well for a year or more can start at block 2.",
            "Repeat a block when life got in the way (illness, travel, missed weeks) rather than pushing on.",
          ],
        },
      ],
    },
    {
      title: "How the year is built",
      icon: "🧱",
      groups: [
        {
          heading: "Four 3-month blocks",
          points: [
            "Block 1 Foundation (weeks 1-13): technique, 8-15 reps, 2-3 reps left in the tank.",
            "Block 2 Volume (weeks 14-26): more sets, 8-15 reps, 1-2 reps left. Most of the year's muscle comes from here.",
            "Block 3 Strength (weeks 27-39): main lifts at 5-8 reps with long rests, accessories 8-12. Strength gained here means heavier sets in block 4.",
            "Block 4 Peak (weeks 40-52): 8-20 reps with stretch-focused exercises (incline curls, overhead extensions, Bayesian curls, deep leg presses). The last set of isolation work can go to 1 rep short of failure.",
          ],
        },
        {
          heading: "Inside every block",
          points: [
            "Weeks 1-6 build: the main lifts gain a set in weeks 3 and 5 (never more than 5 sets).",
            "Week 7 is a deload: half the sets at about 70% of the weight.",
            "Weeks 8-12 build again, with more sets from week 10.",
            "Week 13 is a review week at half the sets: test best weights, weigh in, progress photos, and talk about the next block.",
            "Each muscle gets about 10-20 hard sets a week and is trained 2-3 times a week, the range the research supports for growth.",
            "Progression is double progression: when every set hits the top of the rep range with good form, the app suggests more weight next time.",
          ],
        },
        {
          heading: "Rules kept",
          points: [
            "No overhead pressing. Shoulders are built with lateral raises, face pulls and rear delt work.",
            "Single-leg work in every block (split squats, lunges) to keep both legs even and the knees and hips healthy.",
          ],
        },
      ],
    },
    {
      title: "Managing recovery",
      icon: "😴",
      intro: "Muscle grows between sessions, not in them. The program has an easy week every 6 weeks; the app tells you if a client needs one sooner.",
      groups: [
        {
          heading: "What to watch",
          points: [
            "The deload card on the client's calendar: it counts the program's own deload and review weeks, so it only asks when there are real fatigue signs.",
            "Check-ins: tired 3+ days, poor sleep, high stress, aches that don't settle. Two or more together = bring a deload forward.",
            "Lifts going down two sessions in a row, or lots of sets logged to failure, mean they're under-recovered, not lazy.",
            "Block 2 is the hardest to recover from. Ask about sleep every week in that block.",
          ],
        },
        {
          heading: "What to tell them",
          points: [
            "Sleep 7-9 hours. Less than 6 hours cuts muscle gain and raises injury risk.",
            "At least one full rest day a week; walks and stretching are fine on the others.",
            "Use the Recovery section on rest days (stretching, foam rolling, easy movement, sauna).",
            "Cold plunges straight after training can blunt muscle growth: keep them for rest days or at least a few hours after lifting.",
          ],
        },
      ],
    },
    {
      title: "Managing nutrition",
      icon: "🍽",
      intro: "The client works out their BMR and macros in Nutrition > Muscle building: your BMR and macros. Check they've done it in week 1.",
      groups: [
        {
          heading: "The numbers",
          points: [
            "BMR (Mifflin-St Jeor) x activity = what their body uses. Muscle building adds about 300 kcal a day on top.",
            "Protein about 2 g per kg of bodyweight a day (1.6-2.2 g/kg is the research range), 25-40 g per meal over 3-5 meals.",
            "Fat about 27% of calories, carbs the rest, with most carbs around training.",
            "Clients with diabetes, kidney disease, pregnancy, an eating disorder or under 18 get maintenance numbers only until a doctor or dietitian says otherwise.",
          ],
        },
        {
          heading: "The 2-weekly check",
          points: [
            "Set weigh-ins to Every 2 weeks on the client's Progress (⚖️ Body) so they get a reminder.",
            "Aim for 0.25-0.5% of bodyweight a week for beginners, less for experienced lifters (about 1-2 kg a month for most). The client's page tells them this.",
            "Too slow: add about 150 kcal a day. Too fast: take about 150 kcal off. Give it 2 weeks before changing again.",
            "Waist going up fast with little strength gain means too much surplus. Strength and arm or thigh size going up means it's working.",
            "Deload and review weeks are not diet weeks: keep eating.",
          ],
        },
        {
          heading: "Your own plan for them",
          points: [
            "If you'd rather set their food yourself, use the Diet tab on their profile: it has the same BMR and lets you set the calories.",
            "Their own meal plan (Build muscle goal) uses the same numbers, so it lines up with their BMR page.",
          ],
        },
      ],
    },
  ],
};
