import { diaryKey } from "@/lib/calendarRegular";
import type { LiveSession, SessionInvoice, SessionPair } from "@/types/database";

// Pairs set up once (0224, GRIZZ 2026-11-18): two people who train together,
// in the app or known only by their calendar name.

/** One side of a pair: an app client, or a calendar name. */
export type PairPerson = { clientId: string | null; name: string };

/** One string per person: the client id, or "name:" + their calendar key. */
export function personKey(p: { clientId: string | null; name: string }): string {
  return p.clientId ?? `name:${diaryKey(p.name)}`;
}

export function pairSides(pr: SessionPair): [PairPerson, PairPerson] {
  return [
    { clientId: pr.a_client, name: pr.a_name },
    { clientId: pr.b_client, name: pr.b_name },
  ];
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** "Dave & Sharde" */
export function pairTitle(pr: SessionPair): string {
  return `${firstName(pr.a_name)} & ${firstName(pr.b_name)}`;
}

/** Who pays when it's one invoice. */
export function pairPayer(pr: SessionPair): PairPerson {
  return pairSides(pr)[pr.payer === "a" ? 0 : 1];
}

/** The active pair this person is in. */
export function pairOf(pairs: SessionPair[], who: { clientId: string | null; name?: string | null; key?: string | null }): SessionPair | undefined {
  const key = who.clientId ? null : (who.key ?? diaryKey(who.name ?? ""));
  return pairs.find(
    (pr) =>
      !pr.ended_at &&
      ((who.clientId && (pr.a_client === who.clientId || pr.b_client === who.clientId)) ||
        (!who.clientId && key && ((!pr.a_client && pr.a_key === key) || (!pr.b_client && pr.b_key === key))))
  );
}

/** The pair an invoice belongs to (its person is in one). */
export function invoicePair(pairs: SessionPair[], inv: SessionInvoice): SessionPair | undefined {
  return pairOf(pairs, { clientId: inv.client_id, key: inv.guest_key ?? null, name: inv.guest_name ?? null });
}

/** Side ('a' or 'b') of this invoice's person in the pair. */
export function invoiceSide(pr: SessionPair, inv: SessionInvoice): "a" | "b" {
  if (inv.client_id) return pr.a_client === inv.client_id ? "a" : "b";
  return !pr.a_client && pr.a_key === inv.guest_key ? "a" : "b";
}

/** "Dave & Sharde" when an invoice holds more than one person's sessions, else the fallback. */
export function invoiceTitle(inv: SessionInvoice, fallback: string): string {
  const names = [...new Set(inv.lines.map((l) => (l.who ?? "").trim()).filter(Boolean))];
  if (names.length < 2) return fallback;
  // The payer's name first.
  const first = names.find((n) => firstName(n).toLowerCase() === firstName(fallback).toLowerCase()) ?? names[0];
  return [first, ...names.filter((n) => n !== first)].map(firstName).join(" & ");
}

/**
 * People who keep turning up in the same time slot, two at a time, and
 * aren't set up as a pair yet: "Looks like a pair". Most shared sessions first.
 */
export function suggestPairs(
  sessions: Pick<LiveSession, "client_id" | "guest_name" | "status" | "starts_at">[],
  nameOf: (clientId: string) => string | undefined,
  pairs: SessionPair[],
  min = 3
): { a: PairPerson; b: PairPerson; n: number }[] {
  const bySlot = new Map<string, Map<string, PairPerson>>();
  for (const s of sessions) {
    if (s.status === "removed") continue;
    let p: PairPerson | null = null;
    if (s.client_id) {
      const n = nameOf(s.client_id);
      if (n) p = { clientId: s.client_id, name: n };
    } else if (s.guest_name) {
      const k = diaryKey(s.guest_name);
      if (k && !k.includes("???") && /\p{L}/u.test(k)) p = { clientId: null, name: s.guest_name.trim() };
    }
    if (!p) continue;
    const slot = bySlot.get(s.starts_at) ?? new Map<string, PairPerson>();
    if (!slot.has(personKey(p))) slot.set(personKey(p), p);
    bySlot.set(s.starts_at, slot);
  }
  const counts = new Map<string, { a: PairPerson; b: PairPerson; n: number }>();
  for (const slot of bySlot.values()) {
    if (slot.size !== 2) continue;
    const [a, b] = [...slot.values()].sort((x, y) => x.name.localeCompare(y.name));
    const k = `${personKey(a)}|${personKey(b)}`;
    const row = counts.get(k) ?? { a, b, n: 0 };
    row.n += 1;
    counts.set(k, row);
  }
  const paired = (p: PairPerson) => !!pairOf(pairs, { clientId: p.clientId, name: p.name });
  return [...counts.values()].filter((r) => r.n >= min && !paired(r.a) && !paired(r.b)).sort((x, y) => y.n - x.n);
}
