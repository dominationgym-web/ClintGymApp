import type { ClientStatusFlag } from "@/types/database";

// How the trainer's dashboard decides who needs attention first. Kept out of
// the screen so the ordering can be tested without rendering anything.

export type FlagRow = {
  statusFlag: ClientStatusFlag;
  distressFlag: boolean; // distress/pain flagged on today's check-in
  hasCheckedInToday: boolean;
};

/**
 * Lower number = higher up the trainer's list: a client asking for urgent
 * guidance first, then distress or pain flagged on today's check-in, then a
 * client wanting feedback, then a missing check-in, then everyone who's done.
 */
export function clientPriority({ statusFlag, distressFlag, hasCheckedInToday }: FlagRow): number {
  if (statusFlag === "red") return 0;
  if (distressFlag) return 1;
  if (statusFlag === "orange") return 2;
  if (!hasCheckedInToday) return 3;
  return 4;
}

/** Highlight colour for a flagged client's card; undefined leaves it plain. */
export function flagBorderColor(statusFlag: ClientStatusFlag): string | undefined {
  if (statusFlag === "red") return "#EF4444";
  if (statusFlag === "orange") return "#F59E0B";
  return undefined;
}
