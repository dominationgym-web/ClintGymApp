// Linking a new app client to their name on the 1 on 1 calendar (0208,
// GRIZZ 2026-11-10). The trainer's app asks about every new sign-up, and
// about older clients only when a calendar name looks like theirs.

export type LinkClient = { id: string; name: string; created_at: string };
export type LinkName = { key: string; name: string; coming: number };

/** Days a sign-up counts as new, so it's asked about even without a name match. */
export const NEW_CLIENT_DAYS = 14;

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/**
 * How well a calendar name fits a client's name: 3 the full name, 2 the first
 * name (with or without a surname or initial), 1 a nickname start ("Rob" for
 * Robert, "Sam" for Samantha) or the surname alone, 0 no match.
 */
export function nameMatch(calendarName: string, clientName: string): number {
  const cal = words(calendarName);
  const me = words(clientName);
  if (!cal.length || !me.length) return 0;
  if (cal.join(" ") === me.join(" ")) return 3;
  const [first, ...rest] = cal;
  const last = me[me.length - 1];
  if (first === me[0]) {
    // "Rob V" for Rob Venter fits, "Rob K" doesn't.
    if (!rest.length || me.length < 2 || rest.every((w) => me.slice(1).some((m) => m.startsWith(w)))) return 2;
    return 0;
  }
  if (first.length >= 3 && me[0].startsWith(first)) return 1;
  if (me.length > 1 && cal.length === 1 && first.length >= 3 && first === last) return 1;
  return 0;
}

/** The calendar names, best fit first, with whether each is a likely match. */
export function rankNames(names: LinkName[], clientName: string): (LinkName & { match: number })[] {
  return names
    .map((n) => ({ ...n, match: nameMatch(n.name, clientName) }))
    .sort((a, b) => b.match - a.match || b.coming - a.coming || a.name.localeCompare(b.name));
}

/** Who the pop-up asks about: new sign-ups, plus older clients with a likely name on the calendar. */
export function clientsToAsk(clients: LinkClient[], names: LinkName[], now = new Date()): LinkClient[] {
  if (!names.length) return [];
  const since = now.getTime() - NEW_CLIENT_DAYS * 86400000;
  return clients.filter((c) => new Date(c.created_at).getTime() >= since || names.some((n) => nameMatch(n.name, c.name) >= 2));
}
