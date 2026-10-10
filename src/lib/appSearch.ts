import type { Section, SectionKey } from "@/lib/sections";
import type { ClientTabParamList, TrainerTabParamList } from "@/navigation/types";

// The search screen (header magnifying glass) looks through everything a user
// can open: app pages, the guide sections, exercises and, for trainers, their
// clients and programs. Every search word has to appear, in any order.

export function searchWords(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

export function matchesAll(text: string, words: string[]): boolean {
  if (words.length === 0) return false;
  const lower = text.toLowerCase();
  return words.every((w) => lower.includes(w));
}

/** A page of the app, found by its title or by what's on it. */
export type AppPage<K extends string> = { tab: K; title: string; keywords: string };

export const CLIENT_PAGES: AppPage<keyof ClientTabParamList>[] = [
  { tab: "CheckIn", title: "Check-in", keywords: "daily check in weight mood energy sleep water steps flag today" },
  { tab: "Habits", title: "Habits", keywords: "habits streaks daily goals" },
  { tab: "Reset", title: "Lifestyle Reset", keywords: "reset daily 6 weekly check-in" },
  { tab: "Training", title: "Training", keywords: "training proof video upload form check record" },
  { tab: "Exercises", title: "Exercises", keywords: "workout program today's session rest timer log a set exercise library gym home" },
  { tab: "Profile", title: "Profile", keywords: "profile progress photos coach messages quote payment banking plan account delete" },
];

export const TRAINER_PAGES: AppPage<keyof TrainerTabParamList>[] = [
  { tab: "Dashboard", title: "Dashboard", keywords: "dashboard today's compliance alerts flags check-ins" },
  { tab: "Clients", title: "Clients", keywords: "clients payments plans expiring access" },
  { tab: "Programs", title: "Programs", keywords: "programs workouts build a program weekly quick" },
  { tab: "Trainers", title: "Trainers", keywords: "trainers approve signup" },
  { tab: "TrainerProfile", title: "Profile", keywords: "profile business name logo phone whatsapp payment banking trainer code" },
];

export function searchPages<K extends string>(pages: AppPage<K>[], query: string): AppPage<K>[] {
  const words = searchWords(query);
  return pages.filter((p) => matchesAll(`${p.title} ${p.keywords}`, words));
}

/** A guide section that matches, with the line that matched so the user sees why. */
export type SectionHit = { key: SectionKey; title: string; snippet: string };

export function searchSections(sections: Section[], query: string): SectionHit[] {
  const words = searchWords(query);
  if (words.length === 0) return [];
  const hits: SectionHit[] = [];
  for (const s of sections) {
    if (matchesAll(`${s.title} ${s.summary}`, words)) {
      hits.push({ key: s.key, title: s.title, snippet: s.summary });
      continue;
    }
    const lines = [
      ...s.topics,
      ...(s.content ?? []).flatMap((g) => g.points.map((p) => `${g.heading}: ${p}`)),
    ];
    const line = lines.find((l) => matchesAll(l, words));
    if (line) hits.push({ key: s.key, title: s.title, snippet: line });
  }
  return hits;
}
