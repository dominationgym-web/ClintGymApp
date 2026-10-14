import type { Exercise } from "@/types/database";

// Home equipment list (0092, GRIZZ 2026-10-14). A client who trains at home
// lists what they have; the trainer sees it as a reminder and loads the
// exercises a multi station can do. Once the list has anything on it, the
// app's home exercise choices (swaps, home alternatives) only use exercises
// the list covers.

export type EquipmentType =
  | "dumbbells"
  | "kettlebells"
  | "barbell"
  | "bench"
  | "bands"
  | "multi_station"
  | "ab_bench"
  | "pullup_bar"
  | "cardio"
  | "other";

export type EquipmentItem = {
  id: string;
  type: EquipmentType;
  // How many: dumbbells (1 or 2), kettlebells, bands.
  count?: number;
  // Free text, e.g. "10 kg" or "2 to 24 kg".
  weight?: string;
  // One of the type's options, e.g. "Flat" or "Adjustable".
  option?: string;
  // Type, model or resistance, in the client's words.
  note?: string;
  // Storage path in equipment-photos.
  photo?: string | null;
  // Multi station only: library exercises the trainer says it can do.
  exercises?: string[];
};

export type EquipmentKind = {
  type: EquipmentType;
  label: string;
  icon: string;
  hint: string;
  count?: { label: string; max: number };
  weight?: string;
  options?: string[];
  note?: string;
  photo?: string;
};

export const EQUIPMENT_KINDS: EquipmentKind[] = [
  {
    type: "dumbbells",
    label: "Dumbbells",
    icon: "🏋️",
    hint: "Add one entry per weight. Got 2 x 10 kg and 1 x 15 kg? Add two entries.",
    count: { label: "How many", max: 2 },
    weight: "Weight (e.g. 10 kg, or 2 to 24 kg if adjustable)",
    options: ["Fixed weight", "Adjustable"],
  },
  {
    type: "kettlebells",
    label: "Kettlebells",
    icon: "🔔",
    hint: "One entry per weight.",
    count: { label: "How many", max: 4 },
    weight: "Weight (e.g. 12 kg)",
  },
  {
    type: "barbell",
    label: "Barbell",
    icon: "➖",
    hint: "With plates you can change, or a bar with a set weight.",
    options: ["Adjustable (plates)", "Set weight"],
    weight: "Weight (e.g. 20 kg bar + 40 kg plates)",
  },
  { type: "bench", label: "Bench", icon: "🪑", hint: "Flat, or one that inclines.", options: ["Flat", "Adjustable"] },
  {
    type: "bands",
    label: "Resistance bands",
    icon: "🎗️",
    hint: "How many, and how strong. A photo helps.",
    count: { label: "How many", max: 10 },
    note: "Resistance (e.g. light, medium, heavy)",
    photo: "Photo of the bands",
  },
  {
    type: "multi_station",
    label: "Multi station / home gym",
    icon: "🏗️",
    hint: "Take a photo so your trainer can see what it does.",
    note: "Type or model",
    photo: "Photo of the station",
  },
  { type: "ab_bench", label: "Ab bench", icon: "🧘", hint: "A photo shows your trainer which kind.", photo: "Photo of the ab bench" },
  { type: "pullup_bar", label: "Pull-up bar", icon: "🚪", hint: "Doorway, wall or ceiling bar.", note: "Where it is (optional)" },
  {
    type: "cardio",
    label: "Cardio machine",
    icon: "🚴",
    hint: "Treadmill, bike, rower, skipping rope...",
    note: "Which machine",
    photo: "Photo (optional)",
  },
  { type: "other", label: "Something else", icon: "➕", hint: "Medicine ball, box, TRX, anything.", note: "What is it?", photo: "Photo (optional)" },
];

export function equipmentKind(type: EquipmentType): EquipmentKind {
  return EQUIPMENT_KINDS.find((k) => k.type === type) ?? EQUIPMENT_KINDS[EQUIPMENT_KINDS.length - 1];
}

/** "2 x Dumbbells, 10 kg": one line per item. */
export function equipmentSummary(item: EquipmentItem): string {
  const kind = equipmentKind(item.type);
  const parts: string[] = [];
  const label = item.type === "cardio" || item.type === "other" ? item.note?.trim() || kind.label : kind.label;
  parts.push(item.count && item.count > 0 && kind.count ? `${item.count} x ${label}` : label);
  if (item.option) parts.push(item.option.toLowerCase());
  if (item.weight?.trim()) parts.push(item.weight.trim());
  if (item.note?.trim() && item.type !== "cardio" && item.type !== "other") parts.push(item.note.trim());
  return parts.join(", ");
}

export function newEquipmentId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** The list read safely from clients.home_equipment (old rows, bad data). */
export function equipmentList(value: unknown): EquipmentItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is EquipmentItem =>
      !!v && typeof v === "object" && typeof (v as EquipmentItem).id === "string" && !!EQUIPMENT_KINDS.find((k) => k.type === (v as EquipmentItem).type),
  );
}

// What an exercise needs, worked out from its name. Each inner list is a
// choice ("dumbbells or kettlebells"); every one of them must be covered.
// "bench_incline" is an adjustable bench; "other:ball" is a "Something else"
// item whose description mentions a ball.
type Need = EquipmentType | "bench_incline" | `other:${string}`;

const BARBELL =
  /barbell|ez-bar|\bplate\b|skull crusher|jm press|good morning|pendlay|yates|meadows|seal row|rack pull|\bclean\b|snatch|jerk|z-press|behind-the-neck|zercher|front squat|pause squat|bench press|floor press|conventional deadlift|deficit deadlift|^romanian deadlift$|stiff-leg|wrist roller|^hip thrust$/;
const DUMBBELL =
  /dumbbell|hammer curl|concentration curl|zottman|spider curl|bayesian|kickback|arnold|lateral raise|front raise|rear-delt|reverse fly|chest fly|cuban|man maker|tricep extension|tate press|chest-supported row/;

export function exerciseNeeds(name: string): Need[][] {
  const n = name.toLowerCase();
  const needs: Need[][] = [];
  const isBand = /\bband(ed)?\b/.test(n);
  const isKettlebell = n.includes("kettlebell");

  if (isBand) needs.push(["bands"]);
  if (isKettlebell) needs.push(["kettlebells"]);
  if (!isBand && !isKettlebell) {
    if (n.includes("trap bar")) needs.push(["other:trap bar"]);
    else if (n.includes("goblet")) needs.push(["dumbbells", "kettlebells"]);
    else if (!n.includes("dumbbell") && BARBELL.test(n)) needs.push(["barbell"]);
    else if (DUMBBELL.test(n)) needs.push(["dumbbells"]);
  }
  // Barbell exercises with "dumbbell" in the name were caught above; a
  // "Barbell Banded Back Squat" also needs the barbell.
  if (isBand && n.includes("barbell")) needs.push(["barbell"]);

  if (/pull-up|chin-up|hanging|toes-to-bar|dead hang/.test(n) && !n.includes("pullover")) needs.push(["pullup_bar"]);
  if (n.includes("inverted row")) needs.push(["pullup_bar", "barbell", "multi_station"]);
  if (/stability ball|wall ball/.test(n)) needs.push(["other:ball"]);

  if (n.includes("decline sit-up")) needs.push(["ab_bench", "bench_incline"]);
  else if (/incline|decline/.test(n) && !n.includes("push-up")) needs.push(["bench_incline"]);
  else if (/bench press|seated|preacher|chest-supported|spider curl|seal row|skull crusher|tate press|jm press|chest fly|chest press|flat dumbbell press/.test(n))
    needs.push(["bench"]);
  return needs;
}

function covers(need: Need, items: EquipmentItem[]): boolean {
  if (need === "bench_incline") return items.some((i) => i.type === "bench" && i.option === "Adjustable");
  if (need === "bench") return items.some((i) => i.type === "bench");
  if (need.startsWith("other:")) {
    const word = need.slice(6);
    return items.some((i) => (i.type === "other" || i.type === "multi_station") && (i.note ?? "").toLowerCase().includes(word));
  }
  return items.some((i) => i.type === need);
}

/** The multi station exercises the trainer loaded, lower-cased. */
export function stationExercises(items: EquipmentItem[]): Set<string> {
  const names = new Set<string>();
  for (const i of items) if (i.type === "multi_station") for (const e of i.exercises ?? []) names.add(e.trim().toLowerCase());
  return names;
}

/** Whether a client with this equipment can do the exercise at home. */
export function fitsEquipment(exercise: Pick<Exercise, "name" | "home_friendly">, items: EquipmentItem[]): boolean {
  if (stationExercises(items).has(exercise.name.trim().toLowerCase())) return true;
  if (!exercise.home_friendly) return false;
  return exerciseNeeds(exercise.name).every((choice) => choice.some((need) => covers(need, items)));
}

/**
 * The home check for a client: null when their list is empty (every
 * home-friendly exercise counts, as before), otherwise "fits their list".
 */
export function homeFit(items: EquipmentItem[] | null | undefined): ((e: Pick<Exercise, "name" | "home_friendly">) => boolean) | null {
  const list = equipmentList(items);
  if (list.length === 0) return null;
  return (e) => fitsEquipment(e, list);
}
