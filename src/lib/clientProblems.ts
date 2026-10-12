import type { ClientProblem, ClientProblemTopic } from "@/types/database";

// Problems a client raised (0075): open shows a red dot, Busy fixing an orange
// one, and Fixed makes the dot go away.

export const PROBLEM_LABELS: Record<ClientProblemTopic, { icon: string; title: string }> = {
  pain: { icon: "🩹", title: "Pain or injury" },
  fatigue: { icon: "😴", title: "Fatigue" },
  mental: { icon: "🧠", title: "Mental exhaustion" },
  flag: { icon: "🚩", title: "Asked for help" },
};

export const PROBLEM_RED = "#EF4444";
export const PROBLEM_ORANGE = "#F59E0B";

export type ProblemLevel = "red" | "orange" | null;

type Pick_ = Pick<ClientProblem, "status">;

/** Red while any problem is still open, orange while all are being fixed. */
export function problemLevel(problems: Pick_[]): ProblemLevel {
  if (problems.some((p) => p.status === "open")) return "red";
  if (problems.some((p) => p.status === "fixing")) return "orange";
  return null;
}

export function problemColor(level: ProblemLevel): string | undefined {
  if (level === "red") return PROBLEM_RED;
  if (level === "orange") return PROBLEM_ORANGE;
  return undefined;
}

/** Problems grouped by client, leaving out fixed ones. */
export function unfixedByClient<T extends Pick<ClientProblem, "client_id" | "status">>(problems: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const p of problems) {
    if (p.status === "fixed") continue;
    const list = map.get(p.client_id) ?? [];
    list.push(p);
    map.set(p.client_id, list);
  }
  return map;
}

/** One short line for a dashboard row, e.g. "🩹 Pain or injury: Knee: sore". */
export function problemLine(p: Pick<ClientProblem, "topic" | "detail" | "status">): string {
  const { icon, title } = PROBLEM_LABELS[p.topic];
  const what = p.topic === "flag" && p.detail ? p.detail : p.detail ? `${title}: ${p.detail}` : title;
  return p.status === "fixing" ? `🟠 Busy fixing · ${what}` : `${icon} ${what}`;
}

export const QUICK_REPLIES = ["Much better 👍", "A bit better", "Still the same", "It's worse"];
