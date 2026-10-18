// A simple full body stretch routine for the Recovery section (GRIZZ,
// 2026-10-18: "When stretching is suggested or selected. Can we put a nice
// simple full body stretch program for the client to follow with video
// links."). Top to bottom, about 12 minutes, one stretch per page. Each has
// a video link (a YouTube search, so it never breaks; see watchOnline.ts).

export type Stretch = {
  name: string;
  hold: string;
  /** What it loosens. */
  for: string;
  /** How to do it, in two or three short steps. */
  how: string[];
  /** Search term for the video link. */
  search: string;
};

export const FULL_BODY_STRETCH: Stretch[] = [
  {
    name: "Neck side stretch",
    hold: "30 sec each side",
    for: "Neck and top of the shoulders",
    how: ["Sit or stand tall, shoulders down.", "Tilt your ear towards your shoulder until you feel a gentle pull on the other side.", "Rest your hand lightly on your head; don't pull."],
    search: "neck side stretch",
  },
  {
    name: "Doorway chest stretch",
    hold: "30 sec",
    for: "Chest and front of the shoulders",
    how: ["Put your forearms on either side of a doorway, elbows at shoulder height.", "Step one foot through and lean forward gently until you feel it across your chest."],
    search: "doorway chest stretch",
  },
  {
    name: "Cross-body shoulder stretch",
    hold: "30 sec each side",
    for: "Back of the shoulders",
    how: ["Bring one straight arm across your chest.", "Hold it above the elbow with the other hand and draw it in gently."],
    search: "cross body shoulder stretch",
  },
  {
    name: "Overhead triceps stretch",
    hold: "30 sec each side",
    for: "Triceps and lats",
    how: ["Reach one arm overhead and bend the elbow so your hand drops behind your head.", "Use the other hand to ease the elbow back. Keep your ribs down."],
    search: "overhead triceps stretch",
  },
  {
    name: "Cat-Cow",
    hold: "10 slow rounds",
    for: "The whole spine",
    how: ["On hands and knees, breathe in and let your belly drop as you look up.", "Breathe out and round your back up, tucking your chin."],
    search: "cat cow stretch",
  },
  {
    name: "Child's pose",
    hold: "45 sec",
    for: "Lower back, lats and hips",
    how: ["Kneel, big toes together, knees apart.", "Sit back towards your heels and walk your hands forward. Let your chest sink and breathe into your back."],
    search: "childs pose stretch",
  },
  {
    name: "Lying spinal twist",
    hold: "30 sec each side",
    for: "Lower back and sides",
    how: ["Lie on your back, arms out wide.", "Bring one knee up and let it fall across your body. Keep both shoulders on the floor."],
    search: "lying spinal twist stretch",
  },
  {
    name: "Figure-four glute stretch",
    hold: "30 sec each side",
    for: "Glutes and hips",
    how: ["Lie on your back with knees bent. Cross one ankle over the other knee.", "Pull the bottom leg towards you until you feel it in the crossed side's glute."],
    search: "figure four glute stretch lying",
  },
  {
    name: "Half-kneeling hip flexor stretch",
    hold: "30 sec each side",
    for: "Front of the hips (tight from sitting)",
    how: ["Kneel on one knee, the other foot in front.", "Squeeze the glute of the kneeling leg and shift your hips forward a little. Stay tall."],
    search: "half kneeling hip flexor stretch",
  },
  {
    name: "Lying hamstring stretch",
    hold: "30 sec each side",
    for: "Back of the thighs",
    how: ["Lie on your back, a towel around one foot.", "Lift the straight leg until you feel the back of the thigh. Keep the other leg on the floor."],
    search: "lying hamstring stretch towel",
  },
  {
    name: "Standing quad stretch",
    hold: "30 sec each side",
    for: "Front of the thighs",
    how: ["Stand tall, holding a wall for balance.", "Bend one knee and hold your foot behind you. Knees together, hips pushed slightly forward."],
    search: "standing quad stretch",
  },
  {
    name: "Wall calf stretch",
    hold: "30 sec each side",
    for: "Calves and ankles",
    how: ["Hands on a wall, one foot back with the leg straight and the heel down.", "Lean forward until you feel the calf. Bend the back knee a little to reach lower down."],
    search: "wall calf stretch",
  },
];

/** About how long the routine takes, in minutes. */
export const FULL_BODY_STRETCH_MINUTES = 12;
