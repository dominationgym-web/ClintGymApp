import AsyncStorage from "@react-native-async-storage/async-storage";

// Public holidays for the trainer's country (GRIZZ, 2026-11-25): before a
// month's invoices are made, the trainer is asked if they're working each
// public holiday that has sessions booked. South Africa is built in; other
// countries come from the free Nager.Date list and are kept on the phone.

export type PublicHoliday = {
  /** "2026-12-16" */
  day: string;
  name: string;
  /** false: not a public holiday by law, but many people take it off (Old Year's Day). */
  official: boolean;
};

const pad = (n: number) => String(n).padStart(2, "0");
const key = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Easter Sunday (month 1-12, day) for a year, Gregorian calendar. */
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function shiftDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + n));
  return key(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate());
}

function weekday(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * South Africa's public holidays for a year. A holiday on a Sunday makes the
 * Monday after it a public holiday too (Public Holidays Act). Old Year's Day
 * (31 Dec) isn't a public holiday, but GRIZZ asked for it, so it's asked too.
 */
export function southAfricaHolidays(year: number): PublicHoliday[] {
  const e = easterSunday(year);
  const easter = key(year, e.month, e.day);
  const fixed: PublicHoliday[] = [
    { day: key(year, 1, 1), name: "New Year's Day", official: true },
    { day: key(year, 3, 21), name: "Human Rights Day", official: true },
    { day: shiftDays(easter, -2), name: "Good Friday", official: true },
    { day: shiftDays(easter, 1), name: "Family Day", official: true },
    { day: key(year, 4, 27), name: "Freedom Day", official: true },
    { day: key(year, 5, 1), name: "Workers' Day", official: true },
    { day: key(year, 6, 16), name: "Youth Day", official: true },
    { day: key(year, 8, 9), name: "National Women's Day", official: true },
    { day: key(year, 9, 24), name: "Heritage Day", official: true },
    { day: key(year, 12, 16), name: "Day of Reconciliation", official: true },
    { day: key(year, 12, 25), name: "Christmas Day", official: true },
    { day: key(year, 12, 26), name: "Day of Goodwill (Boxing Day)", official: true },
  ];
  const days = new Set(fixed.map((h) => h.day));
  const moved: PublicHoliday[] = [];
  for (const h of fixed) {
    if (weekday(h.day) !== 0) continue;
    const monday = shiftDays(h.day, 1);
    if (days.has(monday)) continue;
    days.add(monday);
    moved.push({ day: monday, name: `${h.name} (Monday off)`, official: true });
  }
  const all = [...fixed, ...moved, { day: key(year, 12, 31), name: "Old Year's Day", official: false }];
  return all.sort((a, b) => a.day.localeCompare(b.day));
}

type NagerHoliday = { date: string; localName?: string; name: string; global?: boolean };

/** Nager.Date's list, only the ones for the whole country (not one state or county). */
export function fromNager(list: NagerHoliday[]): PublicHoliday[] {
  const seen = new Set<string>();
  const out: PublicHoliday[] = [];
  for (const h of list) {
    if (h.global === false || !/^\d{4}-\d{2}-\d{2}$/.test(h.date) || seen.has(h.date)) continue;
    seen.add(h.date);
    out.push({ day: h.date, name: h.name || h.localName || "Public holiday", official: true });
  }
  return out.sort((a, b) => a.day.localeCompare(b.day));
}

const memory = new Map<string, PublicHoliday[]>();
const storeKey = (country: string, year: number) => `public-holidays:${country}:${year}`;

/** A year's public holidays for a country ("ZA", "GB"...). Empty when it can't be found. */
export async function publicHolidays(country: string, year: number): Promise<PublicHoliday[]> {
  const cc = (country || "ZA").toUpperCase();
  if (cc === "ZA") return southAfricaHolidays(year);
  const k = storeKey(cc, year);
  const hit = memory.get(k);
  if (hit) return hit;
  try {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${cc}`);
    if (res.ok) {
      const list = fromNager((await res.json()) as NagerHoliday[]);
      memory.set(k, list);
      AsyncStorage.setItem(k, JSON.stringify(list)).catch(() => {});
      return list;
    }
  } catch {
    // Offline: the list kept from last time, below.
  }
  try {
    const kept = await AsyncStorage.getItem(k);
    if (kept) {
      const list = JSON.parse(kept) as PublicHoliday[];
      memory.set(k, list);
      return list;
    }
  } catch {
    // Nothing kept.
  }
  return [];
}

/** Public holidays from `from` to `until` (both "YYYY-MM-DD", included). */
export async function publicHolidaysBetween(country: string, from: string, until: string): Promise<PublicHoliday[]> {
  const years: number[] = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(until.slice(0, 4)); y++) years.push(y);
  const lists = await Promise.all(years.map((y) => publicHolidays(country, y)));
  return lists.flat().filter((h) => h.day >= from && h.day <= until);
}

/**
 * Which days to ask about now: from today to the end of this month, and from
 * the 15th, next month too, so the answers are in before the 1st's invoices.
 */
export function askWindow(today: string): { from: string; until: string } {
  const [y, m, d] = today.split("-").map(Number);
  const months = d >= 15 ? 2 : 1;
  const end = new Date(Date.UTC(y, m - 1 + months, 0));
  return { from: today, until: key(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate()) };
}
