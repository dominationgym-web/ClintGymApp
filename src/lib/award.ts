// Trainer of the Half-Year (0194-0196, GRIZZ spec 2026-11-08). Plain helpers,
// kept free of Supabase and React Native so they can be unit tested.
//
// Everything is behind award_settings.enabled (off until the owner switches
// it on). The scoring itself runs in the database (award_daily).

import { parseIsoDate } from "@/lib/dates";

export const AWARD_NAME = "Trainer of the Half-Year";
export const AWARD_FACES_BUCKET = "award-faces";
export const AWARD_PROOFS_BUCKET = "award-proofs";

export type GoalDirection = "lose_fat" | "build_muscle" | "maintain";

export const GOAL_DIRECTIONS: { key: GoalDirection; label: string; hint: string }[] = [
  { key: "lose_fat", label: "Lose fat", hint: "Going down on the scale and tape counts as progress." },
  { key: "build_muscle", label: "Build muscle", hint: "Going up on the scale, chest, arms and legs counts as progress." },
  { key: "maintain", label: "Maintain", hint: "Staying steady counts as progress." },
];

export const FACE_PHOTO_WHY =
  "A clear photo of your face, used only to confirm it's really you if we ever ask for a short proof video of a lift or weigh-in. " +
  "Only you, your trainer and the app owner can see it. A person checks it by eye; no automatic face recognition is used.";

export const FACE_PHOTO_CONSENT =
  "I agree that my face photo is stored securely and used only to confirm my identity on proof videos, as explained above (POPIA).";

export type AwardProofKind = "lift" | "jump" | "weight" | "measurements";
export type AwardProofStatus = "requested" | "uploaded" | "approved" | "rejected" | "expired";

export const PROOF_KIND_LABEL: Record<AwardProofKind, string> = {
  lift: "Big lift",
  jump: "Sudden jump",
  weight: "Fast weight change",
  measurements: "Measurements don't match weight",
};

export const PROOF_STATUS_LABEL: Record<AwardProofStatus, string> = {
  requested: "Waiting for video",
  uploaded: "Video to check",
  approved: "Approved",
  rejected: "Turned down",
  expired: "No video in time",
};

export interface AwardClientProof {
  id: string;
  kind: AwardProofKind;
  detail: string;
  due_on: string;
  status: AwardProofStatus;
}

export interface AwardClientNeeds {
  enabled: boolean;
  needs_photo?: boolean;
  needs_goal?: boolean;
  proofs?: AwardClientProof[];
}

export interface AwardPrizeTier {
  trainers: number;
  places: number[];
}

export interface AwardTrainerStatus {
  enabled: boolean;
  prize_text?: string;
  prize_tiers?: { trainers: number; prize: string }[] | null;
  start_at?: number;
  rules_text?: string | null;
  period_starts?: string | null;
  period_ends?: string | null;
  first_start?: string | null;
  cooldown_until?: string | null;
  message?: { sent_on: string; kind: "top" | "not_top" | "cooldown"; body: string; tip: string | null } | null;
  // Owner preview only (award_preview_status, 0198).
  rules_published?: boolean;
  stream_url?: string | null;
  sample_places?: { place: number; prize: string }[] | null;
  reveal?: {
    period_ends: string;
    revealed_at: string;
    winner: string;
    logo_path: string | null;
    is_me: boolean;
    my_place: number | null;
    places: { place: number; name: string; logo_path: string | null; prize: number | null }[] | null;
    prize_text: string | null;
    stream_url: string | null;
  } | null;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "30 June 2027" from "2027-06-30". */
export function longDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = parseIsoDate(iso.slice(0, 10));
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Days left to send a proof video, as words. */
export function proofDueText(dueOn: string, todayIsoDate: string): string {
  const days = Math.round((parseIsoDate(dueOn).getTime() - parseIsoDate(todayIsoDate).getTime()) / 86400000);
  if (days < 0) return "This request has closed";
  if (days === 0) return "Send it today";
  if (days === 1) return "Send it by tomorrow";
  return `Send it within ${days} days`;
}

/** What the trainer's award line says. Never a score or a rank. */
export function trainerAwardHeadline(status: AwardTrainerStatus): string {
  if (status.cooldown_until) return `Sitting out until ${longDate(status.cooldown_until)}`;
  if (status.message && status.message.kind !== "cooldown") return status.message.body;
  if (!status.period_starts && status.first_start) return `Starts on ${longDate(status.first_start)}`;
  if (!status.period_starts && status.start_at) return `Starts once ${status.start_at.toLocaleString("en-ZA")} trainers are on the app`;
  return "Your first update comes on the 1st of the month.";
}

// ---------------------------------------------------------------------------
// Owner settings form: every number and message, editable without a rebuild.
// ---------------------------------------------------------------------------

export type AwardSettingKind = "number" | "text" | "longtext" | "date" | "switch" | "tiers" | "goals";

export interface AwardSettingField {
  key: string;
  label: string;
  kind: AwardSettingKind;
  hint?: string;
  group: "basics" | "score" | "progress" | "flags" | "words";
}

export const AWARD_SETTING_GROUPS: { key: AwardSettingField["group"]; title: string }[] = [
  { key: "basics", title: "Prize, dates and who can win" },
  { key: "score", title: "Score out of 100" },
  { key: "progress", title: "Client progress" },
  { key: "flags", title: "Red flags and proof videos" },
  { key: "words", title: "Rules and messages" },
];

export const AWARD_SETTING_FIELDS: AwardSettingField[] = [
  {
    key: "prize_tiers",
    label: "Prizes by number of trainers",
    kind: "tiers",
    group: "basics",
    hint: "One line each: trainers: 1st, 2nd, 3rd… e.g. 1000: 1500, 500",
  },
  { key: "prize_currency", label: "Prize currency (USD or ZAR)", kind: "text", group: "basics" },
  {
    key: "prize_zar_per_usd",
    label: "South African prize: rand per $1",
    kind: "number",
    group: "basics",
    hint: "Same ratio as the subscription fees (R100 for $10 = 10), so $500 is R5 000",
  },
  { key: "prize_text", label: "Prize note (optional)", kind: "text", group: "basics", hint: "e.g. Paid by EFT within 30 days" },
  { key: "start_at_trainers", label: "Starts once this many trainers are on the app", kind: "number", group: "basics" },
  {
    key: "first_period_start",
    label: "First period starts (YYYY-MM-DD)",
    kind: "date",
    group: "basics",
    hint: "Leave empty: it starts by itself on the 1st of the month after the trainer number above is reached.",
  },
  { key: "trainer_goals", label: "Trainer counter goals", kind: "goals", group: "basics", hint: "e.g. 1000, 5000" },
  { key: "period_months", label: "Months in a period", kind: "number", group: "basics" },
  { key: "cooldown_months", label: "Months a winner sits out", kind: "number", group: "basics" },
  { key: "min_verified_clients", label: "Verified clients needed to win", kind: "number", group: "basics" },
  { key: "min_interactions", label: "Two-way interactions a month for a verified client", kind: "number", group: "basics" },
  { key: "stream_url", label: "Live reveal stream link", kind: "text", group: "basics", hint: "The link trainers tap to watch the reveal" },
  { key: "signup_weight", label: "New sign-ups that stay (%)", kind: "number", group: "score" },
  { key: "retention_weight", label: "Client retention (%)", kind: "number", group: "score" },
  { key: "progress_weight", label: "Client progress (%)", kind: "number", group: "score" },
  { key: "signup_stay_days", label: "Days a sign-up must stay", kind: "number", group: "score" },
  { key: "top_percent", label: "Top group trainers hear about (%)", kind: "number", group: "score" },
  { key: "strength_weight", label: "Strength (%)", kind: "number", group: "progress" },
  { key: "bodyweight_weight", label: "Body weight (%)", kind: "number", group: "progress" },
  { key: "measurement_weight", label: "Measurements (%)", kind: "number", group: "progress" },
  { key: "cap_strength_pct", label: "Strength cap per month (%)", kind: "number", group: "progress", hint: "Reaching the cap = full marks" },
  { key: "cap_weight_pct", label: "Body weight cap per month (%)", kind: "number", group: "progress" },
  { key: "cap_measure_pct", label: "Measurements cap per month (%)", kind: "number", group: "progress" },
  { key: "flag_lift_pct", label: "Flag a lift up more than (% in a month)", kind: "number", group: "flags" },
  { key: "flag_weight_kg_week", label: "Flag weight changing faster than (kg a week)", kind: "number", group: "flags" },
  { key: "flag_waist_cm", label: "Flag waist change with no weight change (cm)", kind: "number", group: "flags" },
  { key: "flag_jump_pct", label: "Flag a jump since last time of (%)", kind: "number", group: "flags" },
  { key: "flag_jump_gap_days", label: "…after a gap with nothing logged of (days)", kind: "number", group: "flags" },
  { key: "proof_days", label: "Days to send a proof video", kind: "number", group: "flags" },
  { key: "trainer_review_after", label: "Review a trainer after this many failed proofs", kind: "number", group: "flags" },
  { key: "rules_published", label: "Show the rules to trainers", kind: "switch", group: "words" },
  { key: "rules_text", label: "Competition rules", kind: "longtext", group: "words" },
  { key: "message_top", label: "Message: in the top group", kind: "longtext", group: "words" },
  { key: "message_not_top", label: "Message: not in the top group yet", kind: "longtext", group: "words" },
  { key: "tip_signups", label: "Tip when sign-ups are weakest", kind: "longtext", group: "words" },
  { key: "tip_retention", label: "Tip when retention is weakest", kind: "longtext", group: "words" },
  { key: "tip_progress", label: "Tip when client progress is weakest", kind: "longtext", group: "words" },
];

const PLACE_WORDS = ["1st", "2nd", "3rd"];
export const placeWord = (place: number) => PLACE_WORDS[place - 1] ?? `${place}th`;

/** Prize tiers as the owner edits them: one line per tier, "1000: 1500, 500". */
export function formatPrizeTiers(tiers: AwardPrizeTier[] | null | undefined): string {
  return (tiers ?? []).map((t) => `${t.trainers}: ${t.places.join(", ")}`).join("\n");
}

export function parsePrizeTiers(text: string): { ok: true; value: AwardPrizeTier[] } | { ok: false; error: string } {
  const tiers: AwardPrizeTier[] = [];
  for (const line of text.split(/\n/).map((l) => l.trim()).filter(Boolean)) {
    const m = /^(\d[\d ]*)\s*:\s*(.+)$/.exec(line);
    const places = m?.[2].split(",").map((p) => Number(p.replace(/[\s$R]/g, "")));
    if (!m || !places || places.some((p) => !Number.isFinite(p) || p < 0))
      return { ok: false, error: `Prizes: "${line}" should look like 1000: 1500, 500` };
    tiers.push({ trainers: Number(m[1].replace(/\s/g, "")), places });
  }
  if (tiers.length === 0) return { ok: false, error: "Prizes: add at least one line." };
  return { ok: true, value: tiers.sort((a, b) => a.trainers - b.trainers) };
}

/** The prize places for a number of trainers: the highest tier reached. */
export function prizePlacesFor(tiers: AwardPrizeTier[], trainers: number): number[] {
  return [...tiers].sort((a, b) => b.trainers - a.trainers).find((t) => t.trainers <= trainers)?.places ?? [];
}

/** The next counter goal above a number, or null when all are passed. */
export function nextGoal(goals: number[], count: number): number | null {
  return [...goals].sort((a, b) => a - b).find((g) => g > count) ?? null;
}

/** Turns what the owner typed into the value to save, or an error to show. */
export function parseAwardSetting(
  field: AwardSettingField,
  raw: string
): { ok: true; value: string | number | number[] | AwardPrizeTier[] | null } | { ok: false; error: string } {
  const text = raw.trim();
  if (field.kind === "tiers") return parsePrizeTiers(text);
  if (field.kind === "goals") {
    const goals = text.split(",").map((g) => Number(g.replace(/\s/g, "")));
    if (!text || goals.some((g) => !Number.isInteger(g) || g <= 0)) return { ok: false, error: `${field.label}: e.g. 1000, 5000` };
    return { ok: true, value: goals };
  }
  if (field.key === "prize_currency") {
    const c = text.toUpperCase();
    if (!/^[A-Z]{3}$/.test(c)) return { ok: false, error: "Prize currency: USD or ZAR." };
    return { ok: true, value: c };
  }
  if (field.kind === "number") {
    const n = Number(text.replace(",", "."));
    if (!text || !Number.isFinite(n) || n < 0) return { ok: false, error: `${field.label}: type a number.` };
    return { ok: true, value: n };
  }
  if (field.kind === "date") {
    if (!text) return { ok: true, value: null };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(parseIsoDate(text).getTime()))
      return { ok: false, error: `${field.label}: use the form 2027-01-01.` };
    return { ok: true, value: text };
  }
  if (field.key === "stream_url" || field.key === "prize_text") return { ok: true, value: text || null };
  if (!text) return { ok: false, error: `${field.label} can't be empty.` };
  return { ok: true, value: text };
}

/** A warning when the weights don't add up to 100 (they still work, scaled). */
export function weightsWarning(values: Record<string, unknown>): string | null {
  const sum = (keys: string[]) => keys.reduce((t, k) => t + (Number(values[k]) || 0), 0);
  const score = sum(["signup_weight", "retention_weight", "progress_weight"]);
  const progress = sum(["strength_weight", "bodyweight_weight", "measurement_weight"]);
  if (score !== 100) return `The score parts add up to ${score}%, not 100%.`;
  if (progress !== 100) return `The client progress parts add up to ${progress}%, not 100%.`;
  return null;
}

/** File extension for an uploaded video, from its name or type. */
export function videoExtension(uri: string, mimeType?: string | null): string {
  const fromName = uri.split("?")[0].split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,4}$/.test(fromName)) return fromName;
  if (mimeType?.startsWith("video/")) return mimeType.slice(6) || "mp4";
  return "mp4";
}
