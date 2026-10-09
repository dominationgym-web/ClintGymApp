// The extra sections reached from the menu button in the client app's header.
// A section with `content` shows it. One without is a placeholder until the
// coach writes it: `topics` is what it will cover, shown to clients as "coming
// soon" so the page isn't empty. The menu picks sections up from this list.
import { SLEEP_GUIDELINES, type GuidelineGroup } from "@/lib/sleep";
import { WOMENS_HEALTH_GUIDE } from "@/lib/cycle";
import { SUPPLEMENT_GUIDE } from "@/lib/supplements";

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
    summary: "What's worth taking for energy, muscle, performance and recovery, and what to skip.",
    topics: [],
    content: SUPPLEMENT_GUIDE,
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
    summary: "Train, eat and supplement with your cycle, not against it. Log your period and the app guides you through each phase.",
    topics: [],
    content: WOMENS_HEALTH_GUIDE,
  },
];

export function findSection(key: SectionKey): Section | undefined {
  return SECTIONS.find((s) => s.key === key);
}
