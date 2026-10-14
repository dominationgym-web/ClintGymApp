import { toIsoDate } from "@/lib/dates";
import type { ClientStatusFlag } from "@/types/database";

// The client's "How are you doing?" answers. Shared by the Profile tab and
// the once-a-day pop-up so both read the same.
export const STATUS_FLAGS: { key: ClientStatusFlag; label: string; color: string }[] = [
  { key: "red", label: "Urgent - I need guidance", color: "#EF4444" },
  { key: "orange", label: "I'd like some feedback", color: "#F59E0B" },
  { key: "green", label: "All good, no feedback needed", color: "#22C55E" },
];

/**
 * Whether the client has already answered "How are you doing?" today, so the
 * daily pop-up can stay away. True when the flag or note last changed today
 * (stamped by the server), or when this phone remembers an answer from today -
 * picking the same answer again changes nothing on the server.
 */
export function answeredStatusToday(flagUpdatedAt: string | null, answeredOn: string | null, now: Date = new Date()): boolean {
  const today = toIsoDate(now);
  if (answeredOn === today) return true;
  return !!flagUpdatedAt && toIsoDate(new Date(flagUpdatedAt)) === today;
}
