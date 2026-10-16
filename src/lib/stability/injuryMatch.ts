import type { StabilityArea } from "./types";

// Which stability areas fit an injury a client reported (check-in pain area,
// notes, or the intake injuries box), so the trainer is pointed to the right
// rehab program (GRIZZ, 2026-10-16). Plain keyword matching, in body order.
const AREA_WORDS: [StabilityArea, RegExp][] = [
  ["ankle", /\b(ankle|foot|feet|achilles|heel|plantar|calf|calves|shin)/i],
  ["knee", /\b(knee|acl|mcl|menisc|patell)/i],
  ["hip", /\b(hip|groin|glute|adductor|it band)/i],
  ["core", /\b(lower back|spine|spinal|disc|sciatica|lumbar|core|abs?\b|abdominal)/i],
  ["shoulder", /\b(shoulder|rotator|upper back|shoulder blade|scapula|collarbone|trap)/i],
  ["wrist", /\b(wrist|hand|finger|thumb|forearm|elbow|tennis elbow|golfer|carpal)/i],
  ["neck", /\b(neck|cervical|whiplash)/i],
];

export function stabilityAreasFor(...texts: (string | null | undefined)[]): StabilityArea[] {
  const text = texts.filter(Boolean).join(" ");
  if (!text.trim()) return [];
  // A plain "back" (not upper back) is usually the lower back.
  const plainBack = /\bback\b/i.test(text.replace(/upper back/gi, ""));
  return AREA_WORDS.filter(([area, re]) => re.test(text) || (area === "core" && plainBack)).map(([area]) => area);
}
