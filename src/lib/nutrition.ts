// Nutrition section: GRIZZ's hand-portion guideline (2026-10-10) and the
// optional calorie calculator.
import type { GuidelineGroup } from "@/lib/sleep";

export const NUTRITION_GUIDE: GuidelineGroup[] = [
  {
    icon: "❤️",
    heading: "Guidelines for your health, not your goals",
    hook: "These are guidelines to support your health, not your specific goals.",
    points: [
      { emoji: "🍽️", title: "Everyday eating", text: "These portions are for general, everyday eating. Your meals will change as your needs change." },
      { emoji: "⚖️", title: "Losing weight", text: "If you're trying to lose weight, there will be adjustments to these guidelines." },
      { emoji: "🏋️", title: "Gaining weight", text: "If you're trying to gain weight, there will be adjustments too." },
      { emoji: "🥑", title: "Health and wellbeing", text: "If you're looking to improve your health and wellbeing, you might need to increase your healthy fat intake." },
    ],
  },
  {
    icon: "✋",
    heading: "Your portions at each meal",
    hook: "Your hand is your measuring cup. It goes everywhere with you.",
    points: [
      { emoji: "🥩", title: "Protein", text: "1–2 palm-sized portions." },
      { emoji: "🍚", title: "Carbohydrates", text: "1 cupped-hand portion, adjusted for activity and goals." },
      { emoji: "🥦", title: "Vegetables", text: "1–2 fists or more." },
      { emoji: "🥑", title: "Healthy fats", text: "1 small thumb-sized portion." },
      { emoji: "🍓", title: "Fruit", text: "1 medium piece or a small bowl of berries." },
    ],
  },
  {
    icon: "💧",
    heading: "Carbs and water weight",
    hook: "The scale jumped after a carb meal? It's water, not fat.",
    points: [
      { emoji: "🔋", title: "Carbs are stored with water", text: "Your body stores carbs in your muscles and liver as glycogen, and every gram of stored carbs holds about 3 grams of water with it." },
      { emoji: "⚖️", title: "1 gram becomes 4", text: "So 1 gram of carbs adds roughly 4 grams to the scale: the carb itself plus its water." },
      { emoji: "📈", title: "Why the scale jumps", text: "That's why the scale can jump the day after a higher-carb meal. It's only water weight, not fat." },
      { emoji: "🏃", title: "It goes again", text: "It disappears again as you train and burn those carbs." },
    ],
    closing: "Judge your progress over weeks, not one morning's weigh-in.",
  },
  {
    icon: "💡",
    heading: "Good to know",
    points: [
      { emoji: "🌱", title: "Organic where you can", text: "All foods should be certified organic where available." },
      { emoji: "📏", title: "Approximate values", text: "Nutritional values are approximate. Meat and fish values refer to raw food, while grains and legumes are listed cooked unless specified otherwise." },
    ],
  },
];

// "Understanding Carbs": GRIZZ's own words (2026-10-10), laid out in short
// visual blocks like Understanding Insulin (2026-10-14). Shown by CarbsGuide.
export const UNDERSTANDING_CARBS = {
  title: "Understanding Carbs",
  subtitle: "Eating for performance vs eating for long term health",
  hook: "Eating carbs for gym performance is not the same as eating for long term health.",
  hookNote: "That distinction gets conveniently blurred.",
  myth: {
    title: "“You need carbs for performance. You cannot train without carbs.”",
    points: [
      "Fine. If your goal is explosive output, marathons, bodybuilding, competition prep, or squeezing every last rep out of your body, carbohydrates can be used that way.",
      "That is performance nutrition. That is not automatically health nutrition.",
    ],
  },
  loading: {
    intro: "Athletes and bodybuilders who load carbohydrates know exactly what they are doing. They are manipulating their metabolism to squeeze out more output.",
    steps: [
      { emoji: "💪", title: "More glycogen in the muscle", text: "Stored carbs, ready to use." },
      { emoji: "⚡", title: "More fuel for explosive effort", text: "For the heavy, fast, all-out work." },
      { emoji: "🩸", title: "More glucose available", text: "When the body needs fast energy." },
    ],
    outro: "It works for that purpose.",
  },
  notRequired: {
    title: "But carbs are not required to train",
    steps: [
      { emoji: "🔄", title: "Your body adapts", text: "The human body can adapt to lower carbohydrate intake." },
      { emoji: "🔥", title: "It burns fat for fuel", text: "It can use fat for fuel." },
      { emoji: "🧬", title: "It makes its own glucose", text: "It can produce glucose when needed." },
    ],
    outro: "You do not suddenly stop functioning because you stopped eating bowls of pasta before the gym.",
  },
  builtFor: {
    intro: "And honestly, constantly pushing the body harder and harder just to chase output is not healthy either.",
    right: { label: "Built for", text: "The body was built to move, lift, walk, sprint, recover, and repeat." },
    wrong: {
      label: "Not built for",
      text: "It was not built to live in a constant state of extreme output, extreme food intake, extreme recovery demand, and metabolic stress just so somebody can perform at the highest possible level for a few years.",
    },
  },
  whoFor: {
    intro: "There is a difference between training for health and training for performance.",
    tiles: [
      { emoji: "🏆", title: "Elite athletes", text: "Running 100km a week or training twice a day." },
      { emoji: "🪑", title: "Most people", text: "Sitting at desks for eight hours, sleeping badly, stressed out, then copying the diet of people whose entire lives revolve around performance." },
    ],
    line: "Most people don't need to eat like a performance athlete. Eat whole-food carbs to suit how active you are, and cut the sugar and sugary drinks first.",
  },
  // Nutrition review (2026-10-18): normal blood sugar after a meal does no
  // harm in a healthy person, and whole-food carbs are linked with better
  // health, so this part no longer suggests every carb meal causes damage.
  leftOut: {
    title: "What often gets left out",
    points: [
      "Not all carbs are the same. Vegetables, fruit, beans, lentils, whole grains, potatoes and pap come with fibre, vitamins and minerals, and are linked with a longer, healthier life.",
      "Sugar, sweets and sugary drinks give you energy and little else, don't fill you up and are easy to overeat. Cut those first.",
      "The normal rise in blood sugar after a meal does no harm in a healthy person. Harm comes from blood sugar that stays high, as in diabetes. If you have diabetes or prediabetes, follow your doctor's or dietitian's advice on carbs.",
    ],
  },
  myWhy: ["I eat for health.", "For longevity.", "For what my cells look like at 75, not for what I can lift in the gym."],
  question: "So the real question is: are you eating for long term health, or are you eating for short term output?",
};

// "Understanding Insulin": GRIZZ's talk on carbs, insulin and fat burning
// (2026-10-10), tidied into short visual blocks. Shown by InsulinGuide.
// Rewritten to match the trainer guide (nutrition review, 2026-10-18): fat
// loss comes from a calorie deficit; protein, fibre and whole foods help with
// fullness; lower carb is fine if preferred but burns no more fat at the same
// calories.
export const UNDERSTANDING_INSULIN = {
  title: "Understanding Insulin",
  subtitle: "Carbs, insulin and fat loss for your fitness goals",
  hook: "Carbs don't make you fat. Eating more than your body uses does.",
  intro:
    "People think carbs are bad. They're not. Depending on who you are and what you do, carbs can be a big help. Here's what insulin really does, and what really decides fat loss.",
  steps: [
    { emoji: "🍬", title: "You eat carbs", text: "Your blood sugar rises and your body releases insulin. That's normal and healthy." },
    { emoji: "📈", title: "Insulin does its job", text: "It moves the sugar into your muscles and liver, to use now or store for later." },
    { emoji: "⏸️", title: "Fat burning pauses, then picks up", text: "For a few hours your body burns a bit less fat. Over days and weeks, your total calories decide your fat loss, not insulin." },
  ],
  oneSweet: {
    title: "“But I only had one sweet”",
    points: [
      "One sweet won't stop your fat loss. Over weeks, it's the total calories that count.",
      "The problem with sweets and sugary drinks is that they don't fill you up and they're easy to overeat, so the calories add up fast.",
      "If you're overweight or insulin resistant, sugar can hit harder and bring a crash and cravings soon after. Another reason to keep it small.",
      "Cardio before or after eating burns the same fat over weeks. Eat first if it helps you train better.",
      "The takeaway: build meals on protein, vegetables, fruit and whole-food carbs, which keep you full, and keep sweets for now and then.",
    ],
  },
  whoFor: [
    { emoji: "🐢", title: "Overweight or insulin resistant", text: "Cut sugar and sugary drinks first, and have carbs from whole foods with protein and veg. Fewer carbs is fine if it helps your hunger." },
    { emoji: "💪", title: "Big and muscular", text: "More carbs around training fuel hard sessions and help you recover." },
  ],
  order: {
    title: "Order matters",
    wrong: {
      label: "Run first, weights after",
      text: "A 20 minute run before weights tires you out and uses up some of your muscles' glycogen (stored carbs). You can't move the weights you need to grow.",
    },
    right: {
      label: "Weights first, run after",
      text: "Lift while you're fresh and fuelled, then run 20 minutes. You get the most out of your weights and still get your cardio in.",
    },
    note: "If you're lifting weights, surely your aim is to gain muscle or strength?",
  },
  goals: [
    { emoji: "🏃", goal: "Want to get fit?" },
    { emoji: "⚖️", goal: "Want to lose weight?" },
    { emoji: "🏋️", goal: "Want to put on muscle?" },
  ],
  goalsLine: "There's a specific way to eat and train for each one. It's horses for courses: there is no one shoe fits all. For fat loss, it's a calorie deficit you can stick to, with enough protein.",
  warning:
    "This is where people make a big mistake. They listen to influencers who have no clue what they're talking about. Don't listen to some muscle monkey saying “do this and you'll put on muscle”. If you're not a muscle monkey, it's not going to work for you.",
  closing: "You are different. Do what helps you reach your goals, not someone else's.",
};

// Energy per gram. Carbohydrate here is the figure on South African labels,
// which leaves fibre out; fibre is counted separately at about 2 kcal a gram.
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fibre: 2, fat: 9 } as const;

export type Macros = { protein: number; carbs: number; fibre: number; fat: number };
export type MacroKey = keyof Macros;

/** Turns what was typed ("25", "12,5", "") into grams; blank or invalid is 0. */
export function parseGrams(text: string): number {
  const n = Number(text.trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Estimated calories for each nutrient and in total, rounded to whole kcal. */
export function estimateCalories(grams: Macros): { total: number; parts: Macros } {
  const parts = {
    protein: Math.round(grams.protein * KCAL_PER_GRAM.protein),
    carbs: Math.round(grams.carbs * KCAL_PER_GRAM.carbs),
    fibre: Math.round(grams.fibre * KCAL_PER_GRAM.fibre),
    fat: Math.round(grams.fat * KCAL_PER_GRAM.fat),
  };
  return { total: parts.protein + parts.carbs + parts.fibre + parts.fat, parts };
}

// Picture examples for each portion, shown above the guide.
export type FoodGroupExample = { title: string; portion: string; emojis: string; examples: string };

export const FOOD_GROUP_EXAMPLES: FoodGroupExample[] = [
  { title: "Protein", portion: "1–2 palms", emojis: "🍗 🐟 🥩 🥚", examples: "Chicken, fish, lean beef, eggs, ostrich, Greek yoghurt" },
  { title: "Carbohydrates", portion: "1 cupped hand", emojis: "🍠 🍚 🥔 🌽", examples: "Sweet potato, brown rice, potatoes, beans, lentils, quinoa" },
  { title: "Vegetables", portion: "1–2 fists or more", emojis: "🥦 🥬 🥕 🥒", examples: "Broccoli, spinach, carrots, peppers, green beans, cauliflower" },
  { title: "Healthy fats", portion: "1 thumb", emojis: "🥑 🥜 🌰", examples: "Avocado, olive oil, nuts, seeds, nut butter" },
  { title: "Fruit", portion: "1 piece or a small bowl of berries", emojis: "🍎 🍓 🍌 🍊", examples: "Apple, berries, banana, orange, pear" },
];
