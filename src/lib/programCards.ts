import type { Program } from "@/types/database";
import { PROGRAM_FAMILIES, programFamily, type ProgramFamily, type ProgramGroup } from "@/lib/programs";

// Version cards (GRIZZ, 2026-11-15: the programming side "seems very cluttered
// and unorganised", picked option 1). Most built-in programs are versions of
// the same thing (Chest & Bi 1-4, Drop Set Quads 1-3, 12-Week Strength for
// nine sports), so each set shows as one card with small buttons for the
// version, sport or level: 185 lines become about 30 cards. Cards with two
// rows of buttons (Drop sets: muscle, then 1 2 3) pick in two steps.

type CardProgram = Pick<Program, "id" | "name" | "trainer_id">;

export type ProgramCardOption<P extends CardProgram = Program> = {
  program: P;
  /** The button on the first row (a version, a sport, a level). */
  label: string;
  /** The button on the second row, for two-step cards. */
  sub?: string;
};

export type ProgramCard<P extends CardProgram = Program> = {
  key: string;
  title: string;
  icon: string;
  family: ProgramFamily;
  group: ProgramGroup;
  /** Same programs as in options, so the group headings can count them. */
  programs: P[];
  options: ProgramCardOption<P>[];
  /** Hint under the title of two-step cards. */
  hint?: string;
};

type Placement = { key: string; title: string; label: string; sub?: string; hint?: string };

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** "Off-Season – Rugby" → ["Off-Season", "Rugby"]; null when there is no dash part. */
function dashParts(name: string): [string, string] | null {
  const m = name.match(/^(.+?)\s+[–-]\s+(.+)$/);
  return m ? [m[1], m[2]] : null;
}

function placement(p: CardProgram, family: ProgramFamily, familyTitle: string): Placement {
  const name = p.name.trim();
  if (family === "own") return { key: `own:${p.id}`, title: name, label: name };
  const dash = dashParts(name);
  switch (family) {
    case "foundation": {
      // "Beginner Foundation - Bodybuilding": one card per goal, Beginner | Intermediate.
      if (dash) {
        const level = dash[0].split(/\s+/)[0];
        return { key: `foundation:${dash[1].toLowerCase()}`, title: `Foundation · ${dash[1]}`, label: cap(level) };
      }
      break;
    }
    case "dropset": {
      const m = name.match(/^drop set\s+(.+?)\s+(\d+)$/i);
      if (m) return { key: "dropset", title: "Drop sets", label: cap(m[1]), sub: m[2], hint: "Pick a muscle, then a version" };
      break;
    }
    case "sportStrength12":
    case "sportEndurance12":
    case "sportSpeed12": {
      // Three families, one card: pick the sport, then Strength | Endurance | Speed.
      const m = name.match(/^12-week\s+(\w+)\s+[–-]\s+(.+)$/i);
      if (m) return { key: "sport12", title: "12-week sport programs", label: m[2], sub: cap(m[1].toLowerCase()), hint: "Pick the sport, then the focus" };
      break;
    }
    case "offSeason":
      if (dash) return { key: family, title: "Off-season: 8 weeks", label: dash[1] };
      break;
    case "fight":
      if (dash) return { key: family, title: "Fight sports: 8 weeks", label: dash[1] };
      break;
    case "goalBlock": {
      const label = name.replace(/\s*\d+-week program$/i, "").trim();
      return { key: family, title: familyTitle, label: label || name };
    }
    case "sportsPower":
    case "sportsSpeed":
    case "sportsStrength":
    case "sportsMobility":
    case "sportsFlexibility":
    case "olderAdult":
    case "muscleYear":
      // "Explosive Power 1 – Jump & Throw Basics": the part after the dash.
      return { key: family, title: familyTitle, label: dash ? dash[1] : name };
  }
  // "Chest & Bi 3", "HIIT 10", "Full Body 3 x week option 2": one card per name, a button per number.
  const numbered = name.match(/^(.*?)\s+(?:option\s+)?(\d+)$/i);
  // "Home Chest & Bi 2" sits under the Home tab already, so its card is "Chest & Bi".
  if (numbered) return { key: `${family}:${numbered[1].toLowerCase()}`, title: numbered[1].replace(/^home\s+/i, ""), label: numbered[2] };
  // Anything else in the family shares one card.
  return { key: `family:${family}`, title: familyTitle, label: name };
}

/** Drops the words every label starts with ("Quick upper body", "Quick lower body" → "Upper body", "Lower body"). */
function trimCommonStart(labels: string[]): string[] {
  if (labels.length < 2) return labels;
  const words = labels.map((l) => l.split(/\s+/));
  let n = 0;
  while (words.every((w) => w.length > n + 1 && w[n].toLowerCase() === words[0][n].toLowerCase())) n++;
  return n === 0 ? labels : words.map((w) => cap(w.slice(n).join(" ")));
}

const byNumber = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/** The cards for a list of programs, in the families' order (PROGRAM_FAMILIES). */
export function programCards<P extends CardProgram>(programs: P[]): ProgramCard<P>[] {
  const order = new Map<string, number>(PROGRAM_FAMILIES.map((f, i) => [f.key, i]));
  const cards = new Map<string, ProgramCard<P>>();
  const sorted = programs
    .map((p) => ({ p, family: programFamily(p) }))
    .sort((a, b) => (order.get(a.family) ?? 99) - (order.get(b.family) ?? 99));
  for (const { p, family } of sorted) {
    const fam = PROGRAM_FAMILIES.find((f) => f.key === family)!;
    const at = placement(p, family, fam.title);
    let card = cards.get(at.key);
    if (!card) {
      card = { key: at.key, title: at.title, icon: fam.icon, family, group: fam.group, programs: [], options: [], hint: at.hint };
      cards.set(at.key, card);
    }
    card.programs.push(p);
    card.options.push({ program: p, label: at.label, sub: at.sub });
  }
  const list = [...cards.values()];
  for (const card of list) {
    // In name order, so "Speed 1 – Acceleration" comes before "Speed 2 – Top Speed".
    card.options.sort((a, b) => byNumber(a.program.name, b.program.name));
    if (card.key.startsWith("family:")) {
      const trimmed = trimCommonStart(card.options.map((o) => o.label));
      card.options.forEach((o, i) => (o.label = trimmed[i]));
    }
    // A card with one program is just that program.
    if (card.options.length === 1) {
      card.title = card.options[0].program.name;
      card.hint = undefined;
    }
    card.programs = card.options.map((o) => o.program);
  }
  return list;
}

/** The first-row buttons of a card, each once, in order. */
export function cardLabels(card: Pick<ProgramCard<CardProgram>, "options">): string[] {
  return [...new Set(card.options.map((o) => o.label))];
}

/** True when the card picks in two steps (a label, then a sub). */
export function isTwoStep(card: Pick<ProgramCard<CardProgram>, "options">): boolean {
  return card.options.some((o) => o.sub !== undefined);
}
