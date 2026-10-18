import type { Client } from "@/types/database";

/**
 * The client's goals: what the trainer typed, or else the goals they picked on
 * the intake form (clients from before the intake form filled `goals` in).
 */
export function clientGoals(client: Pick<Client, "goals" | "intake_responses">): string {
  const typed = client.goals?.trim();
  if (typed) return typed;
  const picked = client.intake_responses?.training_goals;
  return typeof picked === "string" ? picked.trim() : "";
}
