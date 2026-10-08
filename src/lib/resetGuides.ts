// How-to guidance for each habit in the Women's Health Reset daily checklist.
// The client taps the "?" on a habit and gets this as a short coaching card:
// why it matters, how to do it, and what to do on a day it feels hard.

export type ResetHabitKey =
  | "morning_daylight"
  | "breathing"
  | "daily_movement"
  | "protein_meals"
  | "strength_training"
  | "aerobic_exercise"
  | "consistent_sleep"
  | "evening_winddown";

export type HabitGuide = {
  icon: string;
  title: string;
  why: string;
  steps: string[];
  tips: string[];
  easier: string;
};

export const RESET_GUIDES: Record<ResetHabitKey, HabitGuide> = {
  morning_daylight: {
    icon: "☀️",
    title: "Morning daylight",
    why: "Light in your eyes early tells your body clock the day has started. That's what helps you feel awake in the morning and sleepy at night.",
    steps: [
      "Within 30-60 minutes of waking, step outside.",
      "Stay out for 10-20 minutes. On a cloudy day, aim for the longer end.",
      "Face the sky, not the sun. No sunglasses if you can help it.",
      "Combine it with a short walk, your coffee or the school run.",
    ],
    tips: [
      "Light through a window is much weaker. Outside counts, inside doesn't.",
      "Never stare directly at the sun.",
    ],
    easier: "Short on time? Five minutes on the stoep or balcony still counts. Tick it.",
  },
  breathing: {
    icon: "🫁",
    title: "Breathing",
    why: "Slow breathing with a longer exhale switches your body out of stress mode. Five minutes a day trains it to calm down faster.",
    steps: [
      "Sit or lie somewhere comfortable. Relax your shoulders and jaw.",
      "Put one hand on your belly. Breathe in and out through your nose.",
      "Breathe in gently for about 4 seconds. Let your belly rise, not your chest.",
      "Breathe out slowly for about 6 seconds, like you're fogging a window with your mouth closed.",
      "Keep going for 5 minutes. Set a timer so you don't watch the clock.",
    ],
    tips: [
      "Don't force big breaths. Quiet and slow beats deep.",
      "Feeling lightheaded means you're breathing too hard. Make it softer.",
      "Use it again whenever stress spikes: before a meeting, in traffic, before bed.",
    ],
    easier: "If 5 minutes feels long, start with 10 slow breaths. That's a win.",
  },
  daily_movement: {
    icon: "🚶",
    title: "Daily movement",
    why: "Walking and moving through the day does more for your energy, blood sugar and mood than one hard workout followed by sitting all day.",
    steps: [
      "Check today's steps on your phone and add a bit to your usual. You don't need 10,000 on day one.",
      "Take a 5-15 minute walk after your biggest meal.",
      "Every hour you're sitting, get up for 2-3 minutes: stairs, water, a lap of the office.",
      "Take calls standing or walking where you can.",
    ],
    tips: [
      "Build gradually towards 7,000-10,000 steps a day.",
      "Comfortable pace is fine. This is movement, not training.",
    ],
    easier: "Busy day? One 10-minute walk counts. Tick it.",
  },
  protein_meals: {
    icon: "🥗",
    title: "Protein-focused meals",
    why: "Protein keeps you full, steadies your energy and protects your muscle. It's the base we build every meal on.",
    steps: [
      "Start each meal by choosing your protein first.",
      "Aim for a palm-sized portion (about 25-30 g of protein): 3 eggs, a chicken breast, a tin of tuna, a cup of Greek yoghurt.",
      "Fill the rest of the plate with vegetables or fruit, a carb, and a little healthy fat.",
      "Tick this when most of today's meals had protein.",
    ],
    tips: [
      "Breakfast is the meal most people miss. Eggs, yoghurt or a protein shake fix it fast.",
      "Plant options: lentils, beans, chickpeas, tofu.",
    ],
    easier: "Can't plan every meal? Just get protein into breakfast and build from there.",
  },
  strength_training: {
    icon: "🏋️",
    title: "Strength training",
    why: "Strength training builds muscle and bone, supports your hormones and metabolism, and makes everyday life easier.",
    steps: [
      "Follow this week's session from your 12-Week Training Plan below.",
      "Warm up for 5 minutes: walk, then a light set of your first exercise.",
      "Pick a weight you could lift 2-3 more reps with at the end of each set.",
      "Rest 1-2 minutes between sets.",
      "Log the weight, reps and how it felt in your Training Log (Exercises tab).",
    ],
    tips: [
      "Good form first, then add weight slowly.",
      "Not sure how to do a movement? Open it in the Exercises tab to watch the video.",
      "You should leave feeling better than when you arrived, not wrecked.",
    ],
    easier: "Low energy or stressed? Do the session with lighter weights, or just the first two exercises. Still counts.",
  },
  aerobic_exercise: {
    icon: "🚴",
    title: "Aerobic exercise",
    why: "Easy cardio builds your heart and lung fitness and helps you recover between strength sessions.",
    steps: [
      "Choose something you enjoy: brisk walk, cycling, swimming, a hike or an easy jog.",
      "Go for 20-40 minutes.",
      "Keep it at a pace where you can still talk in full sentences.",
      "Tick it on the days you do a session. Your target is 2-4 a week.",
    ],
    tips: [
      "If you can't talk, slow down. Most sessions should feel comfortable.",
      "Your everyday walking counts as movement. This is a longer, planned session.",
    ],
    easier: "Short on time? A 15-minute brisk walk is a perfectly good session.",
  },
  consistent_sleep: {
    icon: "😴",
    title: "Consistent sleep",
    why: "Sleep is when your body repairs. Waking at the same time every day is the easiest way to sleep better.",
    steps: [
      "Pick a wake-up time you can keep every day, weekends included (give or take 30 minutes).",
      "Count back 7-9 hours to find your bedtime.",
      "Keep the bedroom dark, cool and quiet.",
      "Tick it when you got to bed and woke up close to your times.",
    ],
    tips: [
      "Sleeping in on weekends feels good but makes Monday harder.",
      "Avoid caffeine after about 2pm.",
    ],
    easier: "Bad night? Still get up at your normal time and get morning daylight. Don't nap long.",
  },
  evening_winddown: {
    icon: "🌙",
    title: "Evening wind-down",
    why: "Your body can't go from busy to asleep in five minutes. A routine gives it the signal that the day is ending.",
    steps: [
      "Set an alarm for 60-90 minutes before bedtime. That's your wind-down start.",
      "Dim the lights and put the phone on charge outside the bedroom if you can.",
      "Finish eating by now where possible.",
      "Do something calm: a warm shower, reading, light stretching or 5 minutes of breathing.",
    ],
    tips: [
      "Same routine every night works best. It becomes a cue for sleep.",
      "Avoid work emails, the news and scrolling in this window.",
    ],
    easier: "Even 20 minutes of no phone and dim lights before bed counts.",
  },
};
