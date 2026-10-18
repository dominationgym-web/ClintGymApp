// Body and mind on the daily check-in (0055): pain or injury, fatigue and
// mental exhaustion. The client answers all three every day. "I'm okay" is
// one tap; "Something's up" needs what it is and a short note, so the trainer
// can adjust the program. The trainer sees reports in three sections on the
// client's Notes tab and gets a phone notification.

import type { Checkin } from "@/types/database";

export type WellbeingKey = "pain" | "fatigue" | "mental";
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
}[] = [
  {
    key: "pain",
    icon: "🩹",
    title: "Injury or pain",
    question: "Any discomfort, pain or injury? Even if it's not from training.",
    kindLabel: "Where is it?",
    kinds: ["Neck", "Shoulder", "Upper back", "Lower back", "Elbow", "Wrist or hand", "Hip", "Knee", "Ankle or foot", "Other"],
    notesPlaceholder: "What is it and how did it happen? e.g. Sharp pain in my left knee going down stairs since Saturday.",
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
];

/** Pain areas picked on the check-in, saved as one line: "Knee, Lower back". */
export function splitKinds(kind: string): string[] {
  return kind.split(",").map((k) => k.trim()).filter(Boolean);
}

/** Adds or removes one area from the saved line, keeping the list's order. */
export function toggleKind(kind: string, area: string): string {
  const picked = splitKinds(kind);
  const next = picked.includes(area) ? picked.filter((k) => k !== area) : [...picked, area];
  const order = WELLBEING_TOPICS[0].kinds;
  return next.sort((a, b) => order.indexOf(a) - order.indexOf(b)).join(", ");
}

const blankAnswer = (): WellbeingAnswer => ({ status: null, kind: "", notes: "" });

export const EMPTY_WELLBEING: WellbeingForm = { pain: blankAnswer(), fatigue: blankAnswer(), mental: blankAnswer() };

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
  | "distress_flag"
  | "distress_notes"
>;

const KIND_COLUMN = { pain: "pain_area", fatigue: "fatigue_cause", mental: "mental_cause" } as const;

/** The answers saved on a check-in, back into the form. */
export function wellbeingFromCheckin(row: Checkin): WellbeingForm {
  const answer = (key: WellbeingKey): WellbeingAnswer => ({
    status: row[`${key}_status`],
    kind: row[KIND_COLUMN[key]] ?? "",
    notes: row[`${key}_notes`] ?? "",
  });
  return { pain: answer("pain"), fatigue: answer("fatigue"), mental: answer("mental") };
}

/** One line per report, e.g. "Pain (Knee): sore going down stairs". */
export function wellbeingSummary(form: WellbeingForm): string {
  return WELLBEING_TOPICS.filter((t) => form[t.key].status === "reported")
    .map((t) => `${t.title} (${form[t.key].kind}): ${form[t.key].notes.trim()}`)
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
    if (a.status === "reported" && !a.notes.trim()) {
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
      // Keeps the dashboard's existing alert and sorting working (0055).
      distress_flag: summary !== "",
      distress_notes: summary || null,
    },
  };
}

/** The topics reported on a saved check-in, e.g. ["Injury or pain", "Fatigue"]. */
export function reportedTopics(row: Pick<Checkin, "pain_status" | "fatigue_status" | "mental_status">): string[] {
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
      .map((r) => ({ date: r.checkin_date, kind: r[KIND_COLUMN[key]] ?? "", notes: r[`${key}_notes`] ?? "" }));
  return { pain: pick("pain"), fatigue: pick("fatigue"), mental: pick("mental") };
}
