import type { ClientStatusFlag } from "@/types/database";

// Rules for the trainer's reply to a client (0034). Kept out of the screens so
// they can be tested without rendering anything.

/** Must match the length check on coach_messages.body. */
export const MAX_MESSAGE_LENGTH = 2000;

/** The trimmed message, or null if there is nothing worth sending. */
export function cleanMessage(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) return null;
  return trimmed;
}

/** Whether a dashboard row is an alert the trainer may want to answer. */
export function needsReply(statusFlag: ClientStatusFlag, distressFlag: boolean): boolean {
  return statusFlag !== "green" || distressFlag;
}

/** One line on the reply screen reminding the trainer what they're answering. */
export function alertSummary(statusFlag: ClientStatusFlag, distressFlag: boolean): string | null {
  if (statusFlag === "red") return "🚩 Urgent - needs guidance";
  if (statusFlag === "orange") return "🟠 Wants feedback";
  if (distressFlag) return "⚠ Distress/pain flagged today";
  return null;
}
