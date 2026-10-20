// Body and mind on the daily check-in (0055): pain or injury, fatigue and
// mental exhaustion. The client answers all three every day. "I'm okay" is
// one tap; "Something's up" needs what it is and a short note, so the trainer
// can adjust the program. The trainer sees reports in three sections on the
// client's Notes tab and gets a phone notification.

//
// Dizziness or balance, and serious symptoms (0133, GRIZZ, 2026-10-20) are
// asked the same way. Serious symptoms tell the client to stop and get
// medical help, and hold their workouts until the trainer clears it.

import type { Checkin } from "@/types/database";
import { SERIOUS_SYMPTOMS } from "@/lib/medicalHold";

export type WellbeingKey = "pain" | "fatigue" | "mental" | "balance" | "symptoms";
export type WellbeingStatus = "ok" | "reported";

export type WellbeingAnswer = { status: WellbeingStatus | null; kind: string; notes: string };
export type WellbeingForm = Record<WellbeingKey, WellbeingAnswer>;

export const WELLBEING_TOPICS: {
  key: WellbeingKey;
  icon: string;
  title: string;
  question: string;
  kindLabel: string;
  kinds: string[];
  notesPlaceholder: string;
  /** More than one kind can be picked. */
  multi?: boolean;
  /** The note is optional. */
  noteOptional?: boolean;
}[] = [
  {
    key: "pain",
    icon: "🩹",
    title: "Injury or pain",
    question: "Any discomfort, pain or injury? Even if it's not from training.",
    kindLabel: "Where is it?",
    kinds: ["Neck", "Shoulder", "Upper back", "Lower back", "Elbow", "Wrist or hand", "Hip", "Knee", "Ankle or foot", "Other"],
    notesPlaceholder: "What is it and how did it happen? e.g. Sharp pain in my left knee going down stairs since Saturday.",
    multi: true,
  },
  {
    key: "fatigue",
    icon: "😴",
    title: "Fatigue",
    question: "Feeling physically tired or run down?",
    kindLabel: "Why do you think?",
    kinds: ["Lack of sleep", "Heavy weekend", "Feeling ill", "Long work hours", "Other"],
    notesPlaceholder: "Tell your trainer a bit more, e.g. Only slept 4 hours, baby was up all night.",
  },
  {
    key: "mental",
    icon: "🧠",
    title: "Mental exhaustion",
    question: "Feeling mentally drained or stressed?",
    kindLabel: "What's weighing on you?",
    kinds: ["Kids", "Family commitments", "Work", "Money", "Relationships", "Other"],
    notesPlaceholder: "Whatever you're happy to share, e.g. Busy week with the kids' exams.",
  },
  {
    key: "balance",
    icon: "💫",
    title: "Dizziness or balance",
    question: "Felt dizzy, light-headed or unsteady on your feet?",
    kindLabel: "What happened?",
    kinds: ["Dizzy or light-headed", "Unsteady on my feet", "Nearly fell", "Had a fall", "Worried about falling"],
    notesPlaceholder: "When was it and what were you doing? e.g. Light-headed when I stood up this morning.",
    noteOptional: true,
  },
  {
    key: "symptoms",
    icon: "🚨",
    title: "Serious symptoms",
    question: "Any chest pain, fainting, new numbness or weakness, trouble speaking or seeing, or unusual severe breathlessness?",
    kindLabel: "Tap everything you've had.",
    kinds: SERIOUS_SYMPTOMS,
    notesPlaceholder: "When did it start? Is it still happening?",
    multi: true,
    noteOptional: true,
  },
];

/** Shown as soon as serious symptoms are picked, and after the check-in is saved. */
export const STOP_EXERCISE_ADVICE =
  "Stop. Don't exercise today. These can be signs of a heart, lung or brain problem, so see a doctor today. If it's happening now or getting worse, call an ambulance. Your workouts are on hold until your coach clears you.";

/** Pain areas picked on the check-in, saved as one line: "Knee, Lower back". */
export function splitKinds(kind: string): string[] {
  return kind.split(",").map((k) => k.trim()).filter(Boolean);
}

/** Adds or removes one area from the saved line, keeping the list's order. */
export function toggleKind(kind: string, area: string, order: string[] = WELLBEING_TOPICS[0].kinds): string {
  const picked = splitKinds(kind);
  const next = picked.includes(area) ? picked.filter((k) => k !== area) : [...picked, area];
  return next.sort((a, b) => order.indexOf(a) - order.indexOf(b)).join(", ");
}

const blankAnswer = (): WellbeingAnswer => ({ status: null, kind: "", notes: "" });

export const EMPTY_WELLBEING: WellbeingForm = {
  pain: blankAnswer(),
  fatigue: blankAnswer(),
  mental: blankAnswer(),
  balance: blankAnswer(),
  symptoms: blankAnswer(),
};

export type WellbeingValues = Pick<
  Checkin,
  | "pain_status"
  | "pain_area"
  | "pain_notes"
  | "fatigue_status"
  | "fatigue_cause"
  | "fatigue_notes"
  | "mental_status"
  | "mental_cause"
  | "mental_notes"
  | "balance_status"
  | "balance_notes"
  | "symptoms_status"
  | "symptoms"
  | "distress_flag"
  | "distress_notes"
>;

const KIND_COLUMN = { pain: "pain_area", fatigue: "fatigue_cause", mental: "mental_cause" } as const;
type OldKey = keyof typeof KIND_COLUMN;

// Balance and symptoms keep what it was and the note in one column each:
// "Nearly fell: on the stairs".
const joined = (a: WellbeingAnswer) => [a.kind, a.notes.trim()].filter(Boolean).join(": ");
const splitJoined = (text: string | null, kinds: string[]): { kind: string; notes: string } => {
  const t = text ?? "";
  const cut = t.indexOf(": ");
  const head = cut >= 0 ? t.slice(0, cut) : t;
  return splitKinds(head).every((k) => kinds.includes(k)) && head ? { kind: head, notes: cut >= 0 ? t.slice(cut + 2) : "" } : { kind: "", notes: t };
};
const topic = (key: WellbeingKey) => WELLBEING_TOPICS.find((t) => t.key === key)!;

/** What was saved for a topic: its status, what it was and the note. */
function savedAnswer(row: Checkin, key: WellbeingKey): WellbeingAnswer {
  if (key === "balance") return { status: row.balance_status ?? null, ...splitJoined(row.balance_notes, topic("balance").kinds) };
  if (key === "symptoms") return { status: row.symptoms_status ?? null, ...splitJoined(row.symptoms, topic("symptoms").kinds) };
  const k = key as OldKey;
  return { status: row[`${k}_status`], kind: row[KIND_COLUMN[k]] ?? "", notes: row[`${k}_notes`] ?? "" };
}

/** The answers saved on a check-in, back into the form. */
export function wellbeingFromCheckin(row: Checkin): WellbeingForm {
  const form = { ...EMPTY_WELLBEING };
  for (const t of WELLBEING_TOPICS) form[t.key] = savedAnswer(row, t.key);
  return form;
}

/** One line per report, e.g. "Pain (Knee): sore going down stairs". */
export function wellbeingSummary(form: WellbeingForm): string {
  return WELLBEING_TOPICS.filter((t) => form[t.key].status === "reported")
    .map((t) => `${t.title} (${form[t.key].kind})${form[t.key].notes.trim() ? `: ${form[t.key].notes.trim()}` : ""}`)
    .join("\n");
}

export type WellbeingValidation = { ok: true; values: WellbeingValues } | { ok: false; title: string; message: string };

/** Every topic answered; every report has what it is and a note. */
export function validateWellbeing(form: WellbeingForm): WellbeingValidation {
  for (const t of WELLBEING_TOPICS) {
    const a = form[t.key];
    if (!a.status) {
      return { ok: false, title: `${t.title}?`, message: `Tap "I'm okay" or "Something's up" for ${t.title.toLowerCase()}.` };
    }
    if (a.status === "reported" && !a.kind) {
      return { ok: false, title: t.title, message: `${t.kindLabel} Pick one so your trainer knows.` };
    }
    if (a.status === "reported" && !a.notes.trim() && !t.noteOptional) {
      return { ok: false, title: t.title, message: "Add a short note about what it is and why, so your trainer can adjust your program." };
    }
  }
  const reported = (key: WellbeingKey) => form[key].status === "reported";
  const summary = wellbeingSummary(form);
  return {
    ok: true,
    values: {
      pain_status: form.pain.status,
      pain_area: reported("pain") ? form.pain.kind : null,
      pain_notes: reported("pain") ? form.pain.notes.trim() : null,
      fatigue_status: form.fatigue.status,
      fatigue_cause: reported("fatigue") ? form.fatigue.kind : null,
      fatigue_notes: reported("fatigue") ? form.fatigue.notes.trim() : null,
      mental_status: form.mental.status,
      mental_cause: reported("mental") ? form.mental.kind : null,
      mental_notes: reported("mental") ? form.mental.notes.trim() : null,
      balance_status: form.balance.status,
      balance_notes: reported("balance") ? joined(form.balance).slice(0, 1000) : null,
      symptoms_status: form.symptoms.status,
      symptoms: reported("symptoms") ? joined(form.symptoms).slice(0, 300) : null,
      // Keeps the dashboard's existing alert and sorting working (0055).
      distress_flag: summary !== "",
      distress_notes: summary || null,
    },
  };
}

/** The topics reported on a saved check-in, e.g. ["Injury or pain", "Fatigue"]. */
export function reportedTopics(
  row: Pick<Checkin, "pain_status" | "fatigue_status" | "mental_status"> & Partial<Pick<Checkin, "balance_status" | "symptoms_status">>,
): string[] {
  return WELLBEING_TOPICS.filter((t) => row[`${t.key}_status`] === "reported").map((t) => t.title);
}

/** A saved report for the trainer's Notes tab. */
export type WellbeingReport = { date: string; kind: string; notes: string };

/** Each topic's reports from a list of check-ins, newest first. */
export function reportsByTopic(rows: Checkin[]): Record<WellbeingKey, WellbeingReport[]> {
  const sorted = [...rows].sort((a, b) => b.checkin_date.localeCompare(a.checkin_date));
  const pick = (key: WellbeingKey) =>
    sorted
      .filter((r) => r[`${key}_status`] === "reported")
      .map((r) => {
        const a = savedAnswer(r, key);
        return { date: r.checkin_date, kind: a.kind, notes: a.notes };
      });
  return { pain: pick("pain"), fatigue: pick("fatigue"), mental: pick("mental"), balance: pick("balance"), symptoms: pick("symptoms") };
}
