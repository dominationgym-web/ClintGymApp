// The extra sections reached from the menu button in the client app's header.
// A section with `content` shows it. One without is a placeholder until the
// coach writes it: `topics` is what it will cover, shown to clients as "coming
// soon" so the page isn't empty. The menu picks sections up from this list.
import { SLEEP_GUIDELINES, type GuidelineGroup } from "@/lib/sleep";
import { WOMENS_HEALTH_GUIDE } from "@/lib/cycle";
import { SUPPLEMENT_GUIDE, SUPPLEMENTS } from "@/lib/supplements";
import { LIGHT_SAUCES, PROTEIN_COOKING } from "@/lib/proteinCooking";
import { NUTRITION_GUIDE, UNDERSTANDING_CARBS, UNDERSTANDING_INSULIN } from "@/lib/nutrition";

export type SectionKey = "nutrition" | "supplementation" | "sleepRecovery" | "womensHealthReset";

export type Section = {
  key: SectionKey;
  title: string;
  // Shown on the menu and the page header.
  icon: string;
  accent: string;
  summary: string;
  topics: string[];
  content?: GuidelineGroup[];
};

export const SECTIONS: Section[] = [
  {
    key: "nutrition",
    icon: "🥗",
    accent: "#22C55E",
    title: "Nutrition",
    summary: "How to eat to support your training and your goals: simple hand portions, plus a meal builder and calorie calculator if you like to count.",
    // Not shown (the section has content); here so search finds these pieces.
    topics: [
      `${UNDERSTANDING_CARBS.title}: ${UNDERSTANDING_CARBS.hook}`,
      `${UNDERSTANDING_INSULIN.title}: ${UNDERSTANDING_INSULIN.hook} Fat burning, insulin resistance, sugar.`,
      "Meal builder and calorie calculator: add up calories, protein, carbs and fat for a meal.",
      `Cooking ideas for your protein, recipes: ${PROTEIN_COOKING.map((p) => p.title).join(", ")}.`,
      `Low-calorie sauces: ${LIGHT_SAUCES.map((s) => s.name).join(", ")}.`,
    ],
    content: NUTRITION_GUIDE,
  },
  {
    key: "supplementation",
    icon: "💊",
    accent: "#A78BFA",
    title: "Supplementation",
    summary: "What's worth taking for energy, muscle, performance and recovery, and what to skip.",
    // Not shown (the section has content); here so search finds each supplement.
    topics: SUPPLEMENTS.map((s) => `${s.name}: ${s.what}`),
    content: SUPPLEMENT_GUIDE,
  },
  {
    key: "sleepRecovery",
    icon: "🌙",
    accent: "#60A5FA",
    // Was "Sleep & Recovery", next to the Recovery item (app-flow review C7, 2026-10-18).
    title: "Sleep",
    summary: "Simple habits for better sleep, and an evening wind-down tip. Recovery activities are under Recovery.",
    topics: [],
    content: SLEEP_GUIDELINES,
  },
  {
    key: "womensHealthReset",
    icon: "🌸",
    accent: "#F472B6",
    // Was "Women's Health Reset", easily mixed up with the 12-week Reset tab (C7).
    title: "Cycle tracker",
    summary: "Train, eat and supplement with your cycle, not against it. Log your period and the app guides you through each phase.",
    topics: [],
    content: WOMENS_HEALTH_GUIDE,
  },
];

export function findSection(key: SectionKey): Section | undefined {
  return SECTIONS.find((s) => s.key === key);
}

/** The sections a client sees: men don't get the Women's Health Reset (0057). */
export function sectionsFor(sex: "male" | "female" | null | undefined): Section[] {
  return sex === "male" ? SECTIONS.filter((s) => s.key !== "womensHealthReset") : SECTIONS;
}
