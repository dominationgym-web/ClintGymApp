// The morning check-in form keeps every answer as the text the client typed,
// and only turns it into numbers and times when it is saved. These helpers do
// that conversion, and the reverse when a saved check-in is opened again.

import type { Checkin, HighGiTiming } from "@/types/database";

export type CheckinForm = {
  alcoholUnits: string;
  bedTime: string;
  asleepTime: string;
  wakeTime: string;
  sleepQuality: 1 | 2 | 3 | 4 | 5 | null;
  waterLitres: string;
  electrolytes: boolean;
  mealsTotal: string;
  highGiCount: string;
  highGiTiming: HighGiTiming[];
  screenTimeMinutes: string;
  readNonBacklit: boolean;
  breathingOrStretching: boolean;
  distressFlag: boolean;
  distressNotes: string;
};

export type CheckinValues = Omit<Checkin, "id" | "client_id" | "checkin_date" | "created_at">;

export const EMPTY_CHECKIN_FORM: CheckinForm = {
  alcoholUnits: "",
  bedTime: "",
  asleepTime: "",
  wakeTime: "",
  sleepQuality: null,
  waterLitres: "",
  electrolytes: false,
  mealsTotal: "",
  highGiCount: "",
  highGiTiming: [],
  screenTimeMinutes: "",
  readNonBacklit: false,
  breathingOrStretching: false,
  distressFlag: false,
  distressNotes: "",
};

/**
 * Reads a number the client typed. South African phones often type a comma as
 * the decimal mark ("1,5"), which `Number()` rejects, so a comma is accepted
 * too. Blank means 0. Anything else unreadable is `null`.
 */
export function parseAmount(text: string): number | null {
  const cleaned = text.trim().replace(",", ".");
  if (cleaned === "") return 0;
  if (!/^\d*\.?\d+$|^\d+\.$/.test(cleaned)) return null;
  return Number(cleaned);
}

/**
 * Reads a time of day as `HH:MM`. Accepts "22:30", "22.30", "22h30", "2230",
 * "930" and a bare hour like "22". Blank is `""` (not answered). Anything that
 * is not a real 24-hour time is `null`.
 */
export function parseTime(text: string): string | null {
  const cleaned = text.trim().toLowerCase();
  if (cleaned === "") return "";
  const match =
    cleaned.match(/^(\d{1,2})\s*[:.h]\s*(\d{2})$/) ?? cleaned.match(/^(\d{1,2})(\d{2})$/) ?? cleaned.match(/^(\d{1,2})()$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] || "0");
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Shows a saved Postgres `time` ("22:30:00") as the client typed it ("22:30"). */
function timeToText(value: string | null): string {
  return value ? value.slice(0, 5) : "";
}

function amountToText(value: number | null): string {
  return value === null || value === 0 ? "" : String(value);
}

/** Fills the form from a check-in that was already saved today. */
export function formFromCheckin(row: Checkin): CheckinForm {
  return {
    alcoholUnits: amountToText(Number(row.alcohol_units)),
    bedTime: timeToText(row.sleep_bed_time),
    asleepTime: timeToText(row.sleep_asleep_time),
    wakeTime: timeToText(row.sleep_wake_time),
    sleepQuality: row.sleep_quality,
    waterLitres: amountToText(Number(row.water_litres)),
    electrolytes: row.electrolytes,
    mealsTotal: amountToText(row.meals_total),
    highGiCount: amountToText(row.high_gi_count),
    highGiTiming: row.high_gi_timing ?? [],
    screenTimeMinutes: amountToText(row.screen_time_before_bed_minutes),
    readNonBacklit: row.read_non_backlit_device,
    breathingOrStretching: row.breathing_or_stretching_done,
    distressFlag: row.distress_flag,
    distressNotes: row.distress_notes ?? "",
  };
}

export type CheckinValidation = { ok: true; values: CheckinValues } | { ok: false; title: string; message: string };

/**
 * Checks the form and turns it into the values to save. Every problem comes
 * back as a plain message the client can act on, instead of a database error.
 */
export function validateCheckinForm(form: CheckinForm): CheckinValidation {
  const fail = (title: string, message: string): CheckinValidation => ({ ok: false, title, message });

  const amounts = [
    { text: form.alcoholUnits, name: "Alcohol units", max: 99, whole: false },
    { text: form.waterLitres, name: "Water", max: 20, whole: false },
    { text: form.mealsTotal, name: "Meals", max: 20, whole: true },
    { text: form.highGiCount, name: "High-GI meals", max: 20, whole: true },
    { text: form.screenTimeMinutes, name: "Screen time", max: 720, whole: true },
  ].map((field) => ({ ...field, value: parseAmount(field.text) }));

  for (const field of amounts) {
    if (field.value === null) return fail(`Check ${field.name}`, `"${field.text}" isn't a number. Type just the number, like 2 or 1,5.`);
    if (field.whole && !Number.isInteger(field.value)) return fail(`Check ${field.name}`, `${field.name} should be a whole number.`);
    if (field.value > field.max) return fail(`Check ${field.name}`, `${field.value} looks too high for ${field.name.toLowerCase()}. Is there a typo?`);
  }
  const [alcohol, water, meals, highGi, screen] = amounts.map((field) => field.value as number);

  const times = [
    { text: form.bedTime, name: "Bed time" },
    { text: form.asleepTime, name: "Asleep time" },
    { text: form.wakeTime, name: "Wake time" },
  ].map((field) => ({ ...field, value: parseTime(field.text) }));
  for (const field of times) {
    if (field.value === null) {
      return fail(`Check ${field.name}`, `"${field.text}" isn't a time we can read. Use the 24-hour clock, like 22:30 or 06:15.`);
    }
  }
  const [bed, asleep, wake] = times.map((field) => field.value as string);

  if (highGi > meals && form.mealsTotal.trim() !== "") {
    return fail("Check your meals", "You've logged more high-GI meals than meals in total.");
  }
  if (form.distressFlag && !form.distressNotes.trim()) {
    return fail("Add a note", "Since you've flagged distress or pain, add a quick note so your trainer has context.");
  }

  return {
    ok: true,
    values: {
      alcohol_units: alcohol,
      sleep_bed_time: bed || null,
      sleep_asleep_time: asleep || null,
      sleep_wake_time: wake || null,
      sleep_quality: form.sleepQuality,
      water_litres: water,
      electrolytes: form.electrolytes,
      meals_total: meals,
      high_gi_count: highGi,
      high_gi_timing: highGi > 0 ? form.highGiTiming : [],
      screen_time_before_bed_minutes: screen,
      read_non_backlit_device: form.readNonBacklit,
      breathing_or_stretching_done: form.breathingOrStretching,
      distress_flag: form.distressFlag,
      distress_notes: form.distressFlag ? form.distressNotes.trim() : null,
    },
  };
}

/** Which of the optional answers are still blank, so the client can be reminded. */
export function unansweredSections(form: CheckinForm): string[] {
  const missing: string[] = [];
  if (!form.bedTime.trim() || !form.asleepTime.trim() || !form.wakeTime.trim()) missing.push("sleep times");
  if (form.sleepQuality === null) missing.push("sleep quality");
  if (!form.waterLitres.trim()) missing.push("water");
  if (!form.mealsTotal.trim()) missing.push("meals");
  return missing;
}
