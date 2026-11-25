// How to get each kind of heart rate monitor showing up in the app (GRIZZ,
// 2026-11-25: "how would we go about linking to the different watches?").
// Chest straps and arm bands just work. Most sports watches can send their
// heart rate out over Bluetooth like a strap ("broadcast"), but it has to be
// switched on, and each brand calls it something a little different. Apple
// Watch and Samsung Galaxy Watch can't broadcast, so they're "coming soon".

export type MonitorBrand = {
  key: string;
  name: string;
  /** Tap-through steps, one short line each. */
  steps: string[];
  /** Can't connect yet. */
  comingSoon?: boolean;
};

const STRAP_STEPS = [
  "Wet the two pads on the back of the strap (a little water is fine).",
  "Put it on just under your chest, logo facing out. It wakes up by itself.",
  "Keep your phone close and tap Find my monitor.",
];

export const MONITOR_BRANDS: MonitorBrand[] = [
  {
    key: "strap",
    name: "Chest strap or arm band",
    steps: [
      ...STRAP_STEPS.slice(0, 2),
      "Arm band (Polar Verity, Coospo, Scosche, Wahoo TICKR Fit): put it on your forearm and press its button.",
      STRAP_STEPS[2],
    ],
  },
  {
    key: "garmin",
    name: "Garmin watch",
    steps: [
      "On the watch, hold the middle-left (Menu / Up) button.",
      "Go to Settings › Sensors & Accessories › Wrist Heart Rate (some models: Health & Wellness › Wrist Heart Rate).",
      "Tap Broadcast Heart Rate (or Broadcast During Activity).",
      "Leave the watch on that screen and tap Find my monitor here.",
    ],
  },
  {
    key: "polar",
    name: "Polar watch",
    steps: [
      "Open the Polar Flow app on your phone, go to Training profiles and turn on Share HR with other devices.",
      "Sync your watch so it gets the change.",
      "On the watch, pick a sport as if to start training, but don't start yet.",
      "Tap Find my monitor here while the watch shows your heart rate.",
    ],
  },
  {
    key: "coros",
    name: "Coros watch",
    steps: [
      "On the watch, press the dial to open the menu.",
      "Go to Settings › Heart Rate Broadcast (some models: System › Heart Rate Broadcast) and turn it on.",
      "Tap Find my monitor here.",
    ],
  },
  {
    key: "suunto",
    name: "Suunto watch",
    steps: [
      "On the watch, open Settings › Connectivity (or HR sensor).",
      "Turn on Share HR (some models: HR broadcast).",
      "Tap Find my monitor here.",
    ],
  },
  {
    key: "amazfit",
    name: "Amazfit watch",
    steps: [
      "On the watch, open Settings › Heart Rate (or Workout settings).",
      "Turn on Heart rate sharing / Broadcast heart rate.",
      "Tap Find my monitor here.",
    ],
  },
  {
    key: "wahoo",
    name: "Wahoo ELEMNT watch",
    steps: [
      "In the ELEMNT app, open your watch's settings and turn on Broadcast HR.",
      "Tap Find my monitor here.",
    ],
  },
  {
    key: "apple",
    name: "Apple Watch",
    comingSoon: true,
    steps: [
      "Apple Watch can't send live heart rate to other apps yet. A Daily Evolution watch app is coming.",
      "For now, use a chest strap or arm band. Your Apple Watch workouts still come into the app through Apple Health.",
    ],
  },
  {
    key: "samsung",
    name: "Samsung Galaxy Watch",
    comingSoon: true,
    steps: [
      "Galaxy Watch can't send live heart rate to other apps yet. Support is coming.",
      "For now, use a chest strap or arm band. Your watch workouts still come in through Health Connect.",
    ],
  },
];
