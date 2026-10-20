// Longevity (60+) for coaches (GRIZZ, 2026-10-20): the trainer side of the
// three Older Adult programs (0130) and the pre-start form (preStart.ts), in
// GRIZZ's own protocol. Follows WHO physical activity guidance, ACSM
// resistance-training principles and progressive balance training.
import type { TrainerGuide } from "@/lib/trainerGuides";

export const LONGEVITY_TRAINER_GUIDE: TrainerGuide = {
  key: "longevity",
  title: "Longevity (60+)",
  icon: "🌳",
  accent: "#22C55E",
  summary: "Safety, assessment, progression and coaching for the 18-month older adult programs.",
  topics: [
    {
      title: "Before they start",
      icon: "📋",
      intro: "Fill in the pre-start form on the client's Training tab with them. The app checks it and flags risks in red or amber.",
      groups: [
        {
          heading: "The form covers",
          points: [
            "Health questionnaire and medical history.",
            "Medication, especially anything affecting blood pressure, heart rate or balance.",
            "Falls, dizziness, fractures and joint replacements.",
            "Current activity and mobility, and pain and joint function.",
            "Resting blood pressure when appropriate, and medical clearance when symptoms, unstable disease or screening call for it.",
          ],
        },
        {
          heading: "Movement tests (re-test every 8 weeks)",
          points: [
            "Five-times sit-to-stand, if safe.",
            "A comfortable walking test, such as a 6-minute walk.",
            "Supported single-leg balance or tandem stance.",
            "Comfortable shoulder movement.",
            "Standing posture and basic gait.",
          ],
        },
        {
          heading: "Refer first",
          points: [
            "Frail clients, recurrent falls, osteoporosis-related fractures, significant neurological conditions or unstable heart disease may need a clinician's or physiotherapist's assessment before progressing.",
          ],
        },
      ],
    },
    {
      title: "Rules for every session",
      icon: "🛡️",
      groups: [
        {
          heading: "Always",
          points: [
            "Begin with a 5-8 minute warm-up.",
            "Controlled movement before heavier weights.",
            "No breath-holding: breathe out as they lift or push.",
            "Use stable supports where needed.",
            "No forced ranges of motion and no loaded spinal twisting.",
            "Add resistance only after correct technique is shown.",
            "Use the next-day response to judge recovery.",
          ],
        },
        {
          heading: "Stop and pain",
          points: [
            "Stop for chest pain, faintness, unusual breathlessness or new neurological symptoms.",
            "Mild, familiar discomfort may be acceptable. Sharp pain, swelling, instability or worsening pain needs modification or assessment.",
            "Modify exercises if joint pain increases. Clients can tap This hurts for a kinder version.",
          ],
        },
      ],
    },
    {
      title: "The three programs",
      icon: "🗓️",
      intro: "Each is 24 weeks in three 8-week blocks. Week 8 of each block is the reassess week. Find them under Longevity (60+) when picking a program.",
      groups: [
        {
          heading: "1. Beginner Foundation (months 1-6)",
          points: [
            "Sedentary, first-time or returning after a long break. Confidence, mobility, basic strength, walking and consistency.",
            "2 strength days in weeks 1-16, 3 in weeks 17-24 when tolerated. Walking or recumbent cycling from 10-15 minutes, building to 30.",
            "Graduate when: safe independent chair transfers, better walking tolerance, good basic technique, better balance and confidence. Only move on when movement, symptoms and recovery allow.",
          ],
        },
        {
          heading: "2. Strength & Stability (months 7-12)",
          points: [
            "3 strength days at about RPE 5-7, cardio 25-40 minutes on 3-4 days, a recovery and mobility day.",
            "Weeks 9-16 can add optional intervals (1 min brisk, 2 easy, 4-6 times) for those who tolerate it.",
            "Graduate when: consistent, stronger legs, good control, longer walks and recovering from 3 strength sessions a week.",
          ],
        },
        {
          heading: "3. Functional Strength & Independence (months 13-18)",
          points: [
            "Lower body and core, upper body and core, and full-body functional days, with cardio and balance between.",
            "Weeks 9-16 add safe power: light loads, rise or push with intent to move faster, lower slowly, never trade balance or technique for speed, no ballistic moves unless assessed.",
            "The goal is not maximal strength: it's getting out of chairs and beds, stairs, carrying shopping, walking, balance and staying independent.",
          ],
        },
      ],
    },
    {
      title: "Progression and deloads",
      icon: "📈",
      groups: [
        {
          heading: "Effort (RPE 0-10)",
          points: ["Beginner RPE 4-6, intermediate 5-7, established 6-8 where appropriate."],
        },
        {
          heading: "Add resistance only when they",
          points: [
            "Complete all reps with good technique.",
            "Keep posture and breathing steady.",
            "Have no concerning pain.",
            "Recover before the next session.",
            "Use the smallest practical jump, about 2-5%. Lower-body lifts can sometimes take more.",
          ],
        },
        {
          heading: "Each 8-week block",
          points: [
            "Weeks 1-2: technique and first loading. Weeks 3-4: a little more volume or reps. Weeks 5-6: progressive resistance. Week 7: consolidate. Week 8: re-test and optional deload.",
            "Accumulated fatigue: cut total sets by about 30-50% for a week. Deloads follow fatigue, not the calendar.",
          ],
        },
      ],
    },
    {
      title: "Cardio and balance",
      icon: "🚶",
      groups: [
        {
          heading: "Cardio",
          points: [
            "Consistent low-impact work, building to moderate: walking, stationary or recumbent cycling, water exercise, swimming, elliptical when balance allows.",
            "Most at a pace where they can talk but not comfortably sing.",
            "Build duration and frequency before intensity. Intervals are optional, and HIIT isn't needed for excellent health.",
            "Work toward 120-150 minutes a week as tolerated, a target to aim for, not a requirement for everyone.",
          ],
        },
        {
          heading: "Balance, at least 3 days a week",
          points: [
            "Progress: supported standing, narrow stance, tandem stance, supported single-leg, controlled stepping in different directions, then functional balance tasks.",
            "Always give a stable support or stay close when fall risk exists.",
          ],
        },
      ],
    },
    {
      title: "Five coaching priorities",
      icon: "⭐",
      groups: [
        {
          heading: "In order",
          points: [
            "Movement quality: train the pattern before adding resistance.",
            "Leg strength: the base of mobility, transfers, stairs and independence.",
            "Core stability: anti-rotation, bracing, carrying and control rather than repeated crunching.",
            "Cardio consistency: frequent, sustainable activity beats occasional exhausting sessions.",
            "Recovery: 48 hours between hard sessions for the same muscles when needed. Watch sleep, fatigue, joints and tolerance.",
          ],
        },
      ],
    },
    {
      title: "Daily check-in and tracking",
      icon: "🚦",
      groups: [
        {
          heading: "Before training",
          points: [
            "Green: normal symptoms, good energy, stable movement. Follow the plan.",
            "Amber: more fatigue, soreness or low energy. Lighter resistance, fewer sets or lower-impact work.",
            "Red: chest pain, fainting, acute neurological symptoms, significant new breathlessness or sudden severe pain. Stop and get urgent medical assessment.",
            "The colours don't replace clinical judgement.",
          ],
        },
        {
          heading: "Every 8 weeks (Re-test on the pre-start card)",
          points: [
            "Sit-to-stand, walking, balance, weights and reps, joint symptoms, attendance, confidence and everyday function.",
            "Age alone doesn't decide capacity: progress on ability, health, technique, symptoms and recovery.",
          ],
        },
      ],
    },
  ],
};
