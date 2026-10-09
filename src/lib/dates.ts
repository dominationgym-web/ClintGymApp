// Calendar dates in this app are always the date the person is living in, not
// the date in UTC. A check-in, a habit log and a `log_date` in Postgres are all
// plain calendar dates, so they have to be built from local year/month/day.
//
// Do NOT use `toISOString().slice(0, 10)` for this. It converts to UTC first,
// so in any timezone ahead of UTC - South Africa is UTC+2 - it hands back the
// previous day for part or all of the day, and habit streaks silently lose a
// day's credit. See src/lib/dates.test.ts.

/** The calendar date of `date` in the local timezone, as `YYYY-MM-DD`. */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Today's calendar date in the local timezone, as `YYYY-MM-DD`. */
export function todayIso(): string {
  return toIsoDate(new Date());
}

/** Local midnight at the start of `date`'s day, for day-by-day iteration. */
export function startOfLocalDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** Parses a `YYYY-MM-DD` calendar date as local midnight on that day. */
export function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

/**
 * How long someone has been signed up, counted in whole local calendar days
 * from `since` to `now`, as a short phrase like "3 weeks" or "1 year 2 months".
 */
export function describeTimeSince(since: Date, now: Date = new Date()): string {
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  const start = startOfLocalDay(since);
  const end = startOfLocalDay(now);
  const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  if (days === 0) return "Joined today";
  if (days < 14) return plural(days, "day");

  let months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
  if (end.getDate() < start.getDate()) months -= 1;
  if (months < 2) return plural(Math.floor(days / 7), "week");
  if (months < 12) return plural(months, "month");
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? plural(years, "year") : `${plural(years, "year")} ${plural(rest, "month")}`;
}
