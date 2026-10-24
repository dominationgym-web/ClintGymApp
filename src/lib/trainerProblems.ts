import type { AccessStatus, OwnerTrainerClientRow, TrainerProblem, TrainerProblemArea, TrainerProblemStatus } from "@/types/database";

// Trainer problems (0151, GRIZZ 2026-10-24): trainers report a problem in the
// app instead of by email; it goes to the owner, linked to them.

export const TRAINER_PROBLEMS_MENU_ITEM = {
  key: "trainerProblems",
  title: "Report a problem",
  icon: "🛠",
  summary: "Something not working? Tell the app owner straight away and get an answer here.",
};

// The owner's name for the same page.
export const OWNER_PROBLEMS_MENU_ITEM = {
  ...TRAINER_PROBLEMS_MENU_ITEM,
  title: "Trainer problems",
  summary: "Problems your trainers sent you. Reply, mark Busy fixing or Fixed.",
};

export const PROBLEM_AREAS: { key: TrainerProblemArea; label: string }[] = [
  { key: "app", label: "📱 The app" },
  { key: "clients", label: "👥 My clients" },
  { key: "programs", label: "🏋️ Programs" },
  { key: "billing", label: "💰 Billing" },
  { key: "other", label: "💬 Something else" },
];

export function problemAreaLabel(area: TrainerProblemArea): string {
  return PROBLEM_AREAS.find((a) => a.key === area)?.label ?? "💬 Something else";
}

export const PROBLEM_STATUS_LABEL: Record<TrainerProblemStatus, string> = {
  new: "New",
  fixing: "Busy fixing",
  fixed: "Fixed",
};

// What the trainer who sent it sees.
export const PROBLEM_STATUS_FOR_TRAINER: Record<TrainerProblemStatus, string> = {
  new: "Sent, waiting for an answer",
  fixing: "🛠 Being fixed",
  fixed: "✅ Fixed",
};

export const PROBLEM_STATUS_COLOR: Record<TrainerProblemStatus, string> = {
  new: "#F59E0B",
  fixing: "#38BDF8",
  fixed: "#22C55E",
};

export const PROBLEM_MAX_LENGTH = 2000;

export function problemsWithStatus(list: TrainerProblem[], status: TrainerProblemStatus): TrainerProblem[] {
  return list.filter((p) => p.status === status);
}

/** Open problems (not yet fixed) per trainer, for the Trainers tab. */
export function openProblemsByTrainer(list: Pick<TrainerProblem, "trainer_id" | "status">[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of list) {
    if (p.status === "fixed") continue;
    counts.set(p.trainer_id, (counts.get(p.trainer_id) ?? 0) + 1);
  }
  return counts;
}

/** "24 Oct, 14:05" */
export function problemWhen(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${day}, ${time}`;
}

const CLIENT_STATUS: Record<AccessStatus, string> = {
  active: "Active",
  expiring_soon: "Plan ending soon",
  expired: "Not active",
};

export type ClientCounts = { active: number; waiting: number; archived: number };

/** A trainer's clients split for the owner's list. */
export function clientCounts(rows: OwnerTrainerClientRow[]): ClientCounts {
  const c: ClientCounts = { active: 0, waiting: 0, archived: 0 };
  for (const r of rows) {
    if (r.archived) c.archived++;
    else if (r.access_status === "expired") c.waiting++;
    else c.active++;
  }
  return c;
}

/** "Active · last check-in 23 Oct · last workout 22 Oct" */
export function ownerClientLine(r: OwnerTrainerClientRow): string {
  const status = r.archived ? "Archived" : CLIENT_STATUS[r.access_status] ?? r.access_status;
  const short = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
  const parts = [status];
  parts.push(r.last_checkin ? `check-in ${short(r.last_checkin)}` : "no check-ins yet");
  if (r.last_workout) parts.push(`workout ${short(r.last_workout)}`);
  return parts.join(" · ");
}
