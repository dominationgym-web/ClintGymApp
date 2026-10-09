// The extra sections reached from the menu button in the client app's header.
// A section with `content` shows it. One without is a placeholder until the
// coach writes it: `topics` is what it will cover, shown to clients as "coming
// soon" so the page isn't empty. The menu picks sections up from this list.
import { SLEEP_GUIDELINES, type GuidelineGroup } from "@/lib/sleep";

export type SectionKey = "nutrition" | "supplementation" | "sleepRecovery" | "womensHealthReset";

export type Section = {
  key: SectionKey;
  title: string;
  summary: string;
  topics: string[];
  content?: GuidelineGroup[];
};

export const SECTIONS: Section[] = [
  {
    key: "nutrition",
    title: "Nutrition",
    summary: "How to eat to support your training and your goals.",
    topics: [
      "Your daily calorie and protein targets",
      "Meal plans and meal ideas",
      "Healthy food swaps",
      "Eating out and social occasions",
    ],
  },
  {
    key: "supplementation",
    title: "Supplementation",
    summary: "Which supplements are worth taking, and which aren't.",
    topics: [
      "The basics most people benefit from",
      "When and how much to take",
      "What to skip and save your money on",
    ],
  },
  {
    key: "sleepRecovery",
    title: "Sleep & Recovery",
    summary: "Simple habits for better sleep and faster recovery.",
    topics: [],
    content: SLEEP_GUIDELINES,
  },
  {
    key: "womensHealthReset",
    title: "Women's Health Reset",
    summary: "A dedicated program for women's health and hormones.",
    topics: [
      "How the program works",
      "Training around your cycle",
      "Nutrition for hormone health",
      "Weekly check-ins and progress",
    ],
  },
];

export function findSection(key: SectionKey): Section | undefined {
  return SECTIONS.find((s) => s.key === key);
}
