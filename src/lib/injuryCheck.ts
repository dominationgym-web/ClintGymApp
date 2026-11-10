// Weekly injury check (0209, GRIZZ 2026-11-10): once a week every open injury
// is asked about on the client's Today tab, so the trainer knows whether to
// change the program. "All better" offers to remove it there and then.
import { parseIsoDate, toIsoDate } from "@/lib/dates";
import type { ClientInjury, InjuryCheckAnswer } from "@/types/database";

export const INJURY_CHECK_EVERY_DAYS = 7;

export const INJURY_CHECK_ANSWERS: { key: InjuryCheckAnswer; label: string; color: string }[] = [
  { key: "better", label: "✅ All better", color: "#22C55E" },
  { key: "improving", label: "📈 Improving", color: "#38BDF8" },
  { key: "same", label: "➖ The same", color: "#F59E0B" },
  { key: "worse", label: "📉 Worse", color: "#EF4444" },
];

export function injuryCheckLabel(answer: InjuryCheckAnswer): string {
  return INJURY_CHECK_ANSWERS.find((a) => a.key === answer)?.label ?? answer;
}

export function injuryCheckColor(answer: InjuryCheckAnswer): string {
  return INJURY_CHECK_ANSWERS.find((a) => a.key === answer)?.color ?? "#94A3B8";
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseIsoDate(toIso).getTime() - parseIsoDate(fromIso).getTime()) / 86_400_000);
}

/** The day it was last answered, or the day it was added. */
function lastAskedOn(injury: Pick<ClientInjury, "created_at" | "last_check_on">): string {
  return injury.last_check_on ?? toIsoDate(new Date(injury.created_at));
}

/** Open and a week or more since it was added or last answered. */
export function injuryCheckDue(injury: Pick<ClientInjury, "created_at" | "last_check_on" | "healed_on">, today: string): boolean {
  if (injury.healed_on) return false;
  return daysBetween(lastAskedOn(injury), today) >= INJURY_CHECK_EVERY_DAYS;
}

/** "This week", "Last week" or "3 weeks ago", for the trainer's list. */
export function injuryCheckWhen(checkedOn: string, today: string): string {
  const days = daysBetween(checkedOn, today);
  if (days < 7) return "this week";
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "last week" : `${weeks} weeks ago`;
}
