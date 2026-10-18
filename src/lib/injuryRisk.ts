import { findArea, stabilityAreasFor } from "@/lib/stability";
import type { StabilityArea } from "@/lib/stability";
import { swapGroup } from "@/lib/exerciseFilter";

// Injury check (GRIZZ, 2026-10-17): when a client has an injury on file (the
// intake injuries box) or an open pain report, every exercise in their plan
// that could aggravate it is flagged with the injury it affects. Plain name
// and body-part matching, so it errs on the side of flagging and is a prompt
// to check, not a clinical assessment. Since the 2026-10-18 review it warns
// instead of blocking: the trainer sees the risk and safer swaps, and can
// still keep the exercise (lighter load, shorter range, slower tempo).
// Exercises the app's own rehab programs prescribe (step-ups, split squats,
// wall sits, back extensions, carries) only get a gentle note.

/** Areas a client picks from when listing an injury (same as the check-in's pain areas). */
export const INJURY_AREAS = ["Neck", "Shoulder", "Upper back", "Lower back", "Elbow", "Wrist or hand", "Hip", "Knee", "Ankle or foot", "Other"];

/** "check": worth changing or adjusting. "note": used in the rehab programs, usually fine adjusted. */
export type InjuryRisk = { area: StabilityArea; title: string; why: string; level: "check" | "note" };

type Rule = { area: StabilityArea; why: string; name?: RegExp; categories?: string[] };

const JUMPS = /jump|bound|hop|pogo|burpee|skip|sprint|\brun\b|running|trail run|tempo run|long run|shuffle|agility|ladder|backpedal|high knees|crossover run|jumping jack|jump rope|wall drive|man maker/;

const RULES: Rule[] = [
  // Knee
  { area: "knee", why: "bends the knee under load", name: /squat|lunge|step-up|step-down|leg press|leg extension|wall sit|cossack|curtsy|thruster|wall ball|calf press/ },
  { area: "knee", why: "jumping, running or landing hard on the knee", name: JUMPS, categories: ["Plyometrics", "Speed & Agility"] },
  { area: "knee", why: "puts a lot of strain on the knee", name: /nordic|clean|snatch|jerk|stair climber|hill climb|versaclimber/ },
  // Lower back and core
  { area: "core", why: "heavy load on the lower back", name: /deadlift|good morning|rack pull|back squat|front squat|zercher|smith machine squat|kettlebell swing|clean|snatch|thruster|man maker|overhead squat|sled push|sled pull|farmer/ },
  { area: "core", why: "bent-over pulling strains the lower back", name: /bent-over|barbell row|pendlay|yates|t-bar row|meadows row|gorilla row|underhand barbell row/ },
  { area: "core", why: "bends or twists the spine", name: /sit-up|v-up|toes-to-bar|russian twist|side bend|windmill|jefferson|superman|back extension|hyperextension|decline crunch|wood chopper|medicine ball slam|rotational throw/ },
  // Hip and groin
  { area: "hip", why: "deep hip bend under load", name: /squat|lunge|leg press|step-up|good morning|deadlift|hip thrust|kettlebell swing/ },
  { area: "hip", why: "loads or stretches the groin and inner hip", name: /adduct|lateral lunge|lateral bound|cossack|sumo|straddle|frog|butterfly stretch|pigeon|split stretch|90\/90|hip airplane/, categories: ["Adductors"] },
  { area: "hip", why: "impact through the hip", name: JUMPS, categories: ["Plyometrics", "Speed & Agility"] },
  // Shoulder
  { area: "shoulder", why: "pressing overhead", name: /overhead press|military press|arnold|push press|jerk|thruster|clean and press|man maker|behind-the-neck|z-press|cuban|overhead squat|snatch|wall ball/, categories: ["Overhead Press"] },
  { area: "shoulder", why: "puts the shoulder in a risky position", name: /upright row|dip|pullover|wide-grip barbell bench|bench press|floor press|decline barbell|incline barbell|wide-grip pull|behind-the-back|kettlebell windmill|turkish/ },
  { area: "shoulder", why: "hanging from the arms overhead", name: /pull-up|chin-up|dead hang|toes-to-bar|hanging|muscle-up/ },
  // Wrist and elbow
  { area: "wrist", why: "weight on bent wrists", name: /push-up|hand plank|burpee|mountain climber|front squat|clean|snatch|jerk|handstand|bench dip|inchworm|bear crawl/ },
  { area: "wrist", why: "strains the wrist, forearm or elbow", name: /skull crusher|jm press|tate press|overhead.*extension|close-grip bench|preacher|reverse curl|reverse-grip|zottman|wrist|plate pinch|farmer|chin-up|dip\b|battle ropes|kettlebell swing/, categories: ["Forearms & Grip"] },
  // Ankle, foot and Achilles
  { area: "ankle", why: "jumping, running or landing on the ankle", name: JUMPS, categories: ["Plyometrics", "Speed & Agility"] },
  { area: "ankle", why: "loads the ankle and Achilles", name: /calf raise|calf press|tibialis|lunge|step-up|stair|hill|hiking|trail|sled push|deep squat|ankle knee-to-wall/, categories: ["Calves"] },
  // Neck
  { area: "neck", why: "loads or strains the neck", name: /shrug|upright row|behind-the-neck|neck curl|neck extension|sit-up|v-up|decline crunch|headstand|back squat|smith machine squat|good morning|barbell banded/, categories: ["Neck", "Traps"] },
];

// Exercises the rehab programs themselves use for these areas (src/lib/stability):
// loading them sensibly is part of getting better, so they only get a note.
const REHAB_NOTE = "used in rehab: usually fine with a lighter load, shorter range or slower tempo";
const NOTES: { area: StabilityArea; name: RegExp }[] = [
  { area: "knee", name: /step-up|step-down|split squat|wall sit/ },
  { area: "core", name: /back extension|hyperextension|superman|farmer|suitcase carry|wood chop/ },
  { area: "hip", name: /step-up|split squat/ },
  { area: "ankle", name: /calf raise|tibialis|step-up/ },
];

/** The injured areas for a client, from the intake injuries box and open pain reports. */
export function injuryAreas(...texts: (string | null | undefined)[]): StabilityArea[] {
  const usable = texts.filter((t) => t && !/^\s*(none|no|n\/a|nil|-)\b/i.test(t) && !/none on file/i.test(t));
  return stabilityAreasFor(...usable);
}

/** What an exercise might aggravate among the client's injured areas, one line per area. */
export function exerciseRisks(exercise: { name: string; category?: string | null }, areas: StabilityArea[]): InjuryRisk[] {
  if (areas.length === 0) return [];
  const name = exercise.name.toLowerCase();
  const out: InjuryRisk[] = [];
  for (const area of areas) {
    if (NOTES.some((n) => n.area === area && n.name.test(name))) {
      out.push({ area, title: findArea(area).title, why: REHAB_NOTE, level: "note" });
      continue;
    }
    const rule = RULES.find(
      (r) => r.area === area && ((r.name && r.name.test(name)) || (!!exercise.category && !!r.categories?.includes(exercise.category))),
    );
    if (rule) out.push({ area, title: findArea(area).title, why: rule.why, level: "check" });
  }
  return out;
}

/** Only the risks worth checking, leaving out the gentle rehab notes. */
export function checkRisks(risks: InjuryRisk[]): InjuryRisk[] {
  return risks.filter((r) => r.level === "check");
}

/** How the trainer will keep a flagged exercise safe enough (stored with the keep, 0119). */
export const KEEP_REASONS = [
  "Lighter load",
  "Shorter range",
  "Slower tempo",
  "Pain stays within the pain rule",
  "Cleared by their physio, biokineticist or doctor",
];

/** How a kept exercise is matched: the exercise id, or its name for one not in the library. */
export function exerciseKey(e: { exercise_id?: string | null; name: string }): string {
  return e.exercise_id ?? e.name.toLowerCase();
}

/** A keep still covers an exercise when it was made for every area now flagged. */
export function keepCovers(keep: { areas: string[] } | undefined, risks: InjuryRisk[]): boolean {
  return !!keep && checkRisks(risks).every((r) => keep.areas.includes(r.area));
}

/** "Knee: bends the knee under load · Hip: deep hip bend under load". */
export function riskLine(risks: InjuryRisk[]): string {
  return risks.map((r) => `${r.title}: ${r.why}`).join(" · ");
}

// Body parts to look in when every exercise of the same body part is risky,
// e.g. a knee injury rules out quads work, so glutes and hamstrings come next.
const NEARBY: Record<string, string[]> = {
  Quads: ["Glutes", "Hamstrings", "Adductors"],
  Legs: ["Glutes", "Hamstrings", "Quads"],
  Glutes: ["Hamstrings"],
  Hamstrings: ["Glutes"],
  Calves: ["Hamstrings", "Glutes"],
  Plyometrics: ["Glutes", "Cardio"],
  "Speed & Agility": ["Cardio"],
  "Full Body": ["Cardio", "Glutes", "Core"],
  "Overhead Press": ["Shoulders", "Push"],
  Shoulders: ["Push", "Pull"],
  Push: ["Shoulders", "Triceps"],
  Pull: ["Biceps", "Shoulders"],
  Traps: ["Shoulders", "Pull"],
  Triceps: ["Push"],
  Biceps: ["Pull"],
  "Forearms & Grip": ["Biceps"],
  Core: ["Mobility"],
  Neck: ["Mobility"],
};

const GENTLE = /machine|cable|seated|supported|band|lying|incline|bridge|floor|isometric|hold/i;
// Solid main lifts that are usually kind to injured joints.
const SOLID = /hip thrust|glute bridge|leg curl|chest press|row|pulldown|landmine|external rotation|face pull|bike|rowing|swim|elliptical/i;

/**
 * Up to `count` swaps with nothing to check (gentle notes allowed) for an exercise: the same body part first (names
 * sharing a word with the original, then gentler machine, cable or supported
 * versions), then nearby body parts.
 */
export function safeSuggestions<T extends { id: string; name: string; category: string | null }>(
  original: { id: string | null; name: string; category: string | null },
  library: T[],
  areas: StabilityArea[],
  count = 3,
): T[] {
  const words = original.name.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);
  const score = (e: T) =>
    (words.some((w) => e.name.toLowerCase().includes(w)) ? 2 : 0) + (GENTLE.test(e.name) ? 1 : 0) + (SOLID.test(e.name) ? 1 : 0);
  const safe = library.filter((e) => e.id !== original.id && checkRisks(exerciseRisks(e, areas)).length === 0);
  const group = swapGroup(original.category);
  const groups = [group, ...(group ? NEARBY[group] ?? [] : [])];
  const picked: T[] = [];
  for (const g of groups) {
    const inGroup = safe.filter((e) => swapGroup(e.category) === g && !picked.includes(e)).sort((a, b) => score(b) - score(a));
    picked.push(...inGroup.slice(0, count - picked.length));
    if (picked.length >= count) break;
  }
  return picked;
}
