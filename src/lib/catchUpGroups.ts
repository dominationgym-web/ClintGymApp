import type { LiveSession } from "@/types/database";

/** One client (or diary name) per catch-up group. */
export const catchUpWhoKey = (s: Pick<LiveSession, "client_id" | "guest_name">) =>
  s.client_id ? `c:${s.client_id}` : `g:${(s.guest_name ?? "").trim().toLowerCase()}`;

/**
 * Catch-ups put together per client, keeping the order given (the group sits
 * where its first one was). GRIZZ 2026-11-13: one slot per client with the
 * number of catch-ups owed.
 */
export function groupCatchUps<T extends { s: Pick<LiveSession, "client_id" | "guest_name"> }>(rows: T[]): T[][] {
  const groups: T[][] = [];
  const at = new Map<string, T[]>();
  for (const r of rows) {
    const k = catchUpWhoKey(r.s);
    const g = at.get(k);
    if (g) g.push(r);
    else {
      const n = [r];
      at.set(k, n);
      groups.push(n);
    }
  }
  return groups;
}
