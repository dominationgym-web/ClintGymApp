// One file with all of a trainer's clients (0190, GRIZZ 2026-11-03).
//
// A big export is read in two steps so its size doesn't matter: Claude looks
// at the first rows only and says which column holds what (columnMap), then
// this code reads every row (applyColumnMap) and splits it by person. Each
// person's rows come out in the same raw shape Claude's save_history tool
// gives, so shape.ts cleanResult checks them the same way.
//
// Plain TypeScript with no imports at all (the app's type check can't follow
// Deno's "./shape.ts" paths): the edge function and the app's tests both use it.

type Units = "metric" | "imperial";
const LB_TO_KG = 0.45359237;
/** Same as shape.ts nameKey: lower case, letters and digits only. */
const nameKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

/** The delimiter of a CSV-like text: comma, semicolon or tab, by the first lines. */
export function sniffDelimiter(text: string): string {
  const head = text.split(/\r?\n/).slice(0, 5).join("\n");
  const count = (c: string) => head.split(c).length - 1;
  const options = [",", ";", "\t"].map((c) => [c, count(c)] as const).sort((a, b) => b[1] - a[1]);
  return options[0][1] > 0 ? options[0][0] : ",";
}

/** CSV rows, with quoted cells ("a, b" and "" for a quote) handled. */
export function parseCsv(text: string, delimiter = sniffDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

/** The first rows written out with row and column numbers, for Claude to map. */
export function sampleForMapping(rows: string[][], max = 40): string {
  return rows
    .slice(0, max)
    .map((r, i) => `row ${i}: ${r.map((c, j) => `[${j}]=${c.slice(0, 40)}`).join(" | ")}`)
    .join("\n");
}

/** Which column holds what, by 0-based column number (Claude's map_columns answer). */
export type ColumnMap = {
  tabular: boolean;
  header_rows: number;
  name: number[];
  date: number | null;
  date_format: "ymd" | "dmy" | "mdy" | null;
  session: number | null;
  exercise: number | null;
  set_number: number | null;
  weights: number[];
  reps: number[];
  unit_column: number | null;
  unit: "kg" | "lb" | null;
  body_weight: number | null;
  body_fat: number | null;
};

const int = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 500 ? v : null);
const ints = (v: unknown): number[] => (Array.isArray(v) ? v.map(int).filter((n): n is number => n !== null) : []);

/** Claude's answer made safe: only whole column numbers, known formats and units. */
export function cleanColumnMap(raw: unknown): ColumnMap | null {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (o.tabular !== true) return null;
  const unit = o.unit === "kg" || o.unit === "lb" ? o.unit : null;
  const fmt = o.date_format === "ymd" || o.date_format === "dmy" || o.date_format === "mdy" ? o.date_format : null;
  const map: ColumnMap = {
    tabular: true,
    header_rows: int(o.header_rows) ?? 1,
    name: ints(o.name),
    date: int(o.date),
    date_format: fmt,
    session: int(o.session),
    exercise: int(o.exercise),
    set_number: int(o.set_number),
    weights: ints(o.weights),
    reps: ints(o.reps),
    unit_column: int(o.unit_column),
    unit,
    body_weight: int(o.body_weight),
    body_fat: int(o.body_fat),
  };
  // Nothing to read without people and either sets or body weights.
  if (!map.name.length) return null;
  if (!(map.exercise !== null && map.reps.length) && map.body_weight === null) return null;
  return map;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/** A date cell as yyyy-mm-dd, or null. Numbers like 45321 are Excel day numbers. */
export function parseDateCell(cell: string, format: ColumnMap["date_format"]): string | null {
  const s = cell.trim();
  if (!s) return null;
  const make = (y: number, m: number, d: number) => {
    if (y < 100) y += 2000;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
  };
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return make(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const [a, b, y] = [+m[1], +m[2], +m[3]];
    if (format === "mdy" || (format !== "dmy" && b > 12)) return make(y, a, b);
    return make(y, b, a);
  }
  m = s.match(/^(\d{1,2})\s+([a-z]{3})[a-z]*\.?,?\s+(\d{4})/i);
  if (m && MONTHS.includes(m[2].toLowerCase())) return make(+m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1]);
  m = s.match(/^([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/i);
  if (m && MONTHS.includes(m[1].toLowerCase())) return make(+m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, +m[2]);
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const days = Math.floor(Number(s));
    if (days > 30000 && days < 70000) {
      const dt = new Date(Date.UTC(1899, 11, 30) + days * 86400000);
      return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
    }
  }
  return null;
}

/** "22,5 kg" → 22.5 and kg; "" → null. */
export function numberCell(cell: string | undefined): { n: number | null; unit: "kg" | "lb" | null } {
  const s = (cell ?? "").trim().toLowerCase();
  const m = s.match(/-?\d+(?:[.,]\d+)?/);
  const unit = /\b(lb|lbs|pounds?)\b/.test(s) ? "lb" : /\b(kg|kgs|kilos?)\b/.test(s) ? "kg" : null;
  return { n: m ? Number(m[0].replace(",", ".")) : null, unit };
}

type RawSet = { weight: number | null; reps: number | null; unit: "kg" | "lb" | null; order: number };
type RawWorkout = { date: string | null; session: string | null; exercise: string; unit: "kg" | "lb" | null; sets: { weight: number | null; reps: number | null }[] };
export type RawPerson = { name: string; workouts: RawWorkout[]; body: Record<string, unknown>[] };

/** Every row read with the map, split by person (in the order people first appear). */
export function applyColumnMap(rows: string[][], map: ColumnMap, units: Units = "metric"): RawPerson[] {
  const people = new Map<string, { name: string; groups: Map<string, { w: Omit<RawWorkout, "sets" | "unit">; sets: RawSet[] }>; body: Map<string, Record<string, unknown>> }>();
  const at = (r: string[], c: number | null) => (c === null ? "" : (r[c] ?? "").trim());
  rows.slice(map.header_rows).forEach((r, rowIndex) => {
    const name = map.name.map((c) => at(r, c)).filter(Boolean).join(" ").replace(/\s+/g, " ");
    if (!name) return;
    const key = nameKey(name);
    if (!key) return;
    let p = people.get(key);
    if (!p) people.set(key, (p = { name, groups: new Map(), body: new Map() }));
    const date = map.date === null ? null : parseDateCell(at(r, map.date), map.date_format);
    const session = at(r, map.session) || null;
    const rowUnit = numberCell(at(r, map.unit_column)).unit ?? (/^(lb|lbs)$/i.test(at(r, map.unit_column)) ? "lb" : null);

    const exercise = at(r, map.exercise);
    if (exercise && map.reps.length) {
      const g = `${date ?? ""}|${session ?? ""}|${nameKey(exercise)}`;
      let group = p.groups.get(g);
      if (!group) p.groups.set(g, (group = { w: { date, session, exercise }, sets: [] }));
      map.reps.forEach((repsCol, i) => {
        const reps = numberCell(at(r, repsCol));
        const weight = map.weights[i] === undefined ? { n: null, unit: null } : numberCell(at(r, map.weights[i]));
        if (reps.n === null && weight.n === null) return;
        const setNo = map.set_number === null ? null : numberCell(at(r, map.set_number)).n;
        group!.sets.push({
          weight: weight.n,
          reps: reps.n,
          unit: weight.unit ?? rowUnit ?? map.unit,
          order: setNo !== null && map.reps.length === 1 ? setNo : rowIndex * 100 + i,
        });
      });
    }
    if (date && (map.body_weight !== null || map.body_fat !== null)) {
      const bw = numberCell(at(r, map.body_weight));
      const bf = numberCell(at(r, map.body_fat));
      if (bw.n !== null || bf.n !== null) {
        const b = p.body.get(date) ?? { date };
        if (bw.n !== null) {
          b.weight = bw.n;
          b.weight_unit = bw.unit ?? rowUnit ?? map.unit;
        }
        if (bf.n !== null) b.body_fat_pct = bf.n;
        p.body.set(date, b);
      }
    }
  });
  return [...people.values()].map((p) => ({
    name: p.name,
    workouts: [...p.groups.values()].map(({ w, sets }) => {
      sets.sort((a, b) => a.order - b.order);
      // One unit for the exercise when its sets agree. When they don't, every
      // set is changed to kg here (no unit shown: the trainer's units).
      const kinds = new Set(sets.map((s) => s.unit));
      if (kinds.size <= 1) return { ...w, unit: sets[0]?.unit ?? null, sets: sets.map(({ weight, reps }) => ({ weight, reps })) };
      return {
        ...w,
        unit: "kg" as const,
        sets: sets.map((s) => ({
          weight: s.weight === null ? null : (s.unit ?? (units === "imperial" ? "lb" : "kg")) === "lb" ? s.weight * LB_TO_KG : s.weight,
          reps: s.reps,
        })),
      };
    }),
    body: [...p.body.values()],
  }));
}

/** People found in more than one file (or Claude read), put together by name. */
export function mergePeople(lists: RawPerson[][]): RawPerson[] {
  const out = new Map<string, RawPerson>();
  for (const list of lists)
    for (const p of list) {
      const k = nameKey(p.name);
      if (!k) continue;
      const have = out.get(k);
      if (have) {
        have.workouts.push(...p.workouts);
        have.body.push(...p.body);
      } else out.set(k, { name: p.name, workouts: [...p.workouts], body: [...p.body] });
    }
  return [...out.values()];
}

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** The trainer's client this name belongs to: same name, or one name inside the
 *  other ("Jade" and "Jade Smith") when only one client fits. Otherwise null. */
export function matchClient(name: string, clients: { id: string; name: string }[]): string | null {
  const k = nameKey(name);
  const exact = clients.filter((c) => nameKey(c.name) === k);
  if (exact.length === 1) return exact[0].id;
  if (exact.length > 1) return null;
  const mine = words(name);
  if (!mine.length) return null;
  const fits = clients.filter((c) => {
    const theirs = words(c.name);
    if (!theirs.length) return false;
    return mine.every((w) => theirs.includes(w)) || theirs.every((w) => mine.includes(w));
  });
  return fits.length === 1 ? fits[0].id : null;
}
