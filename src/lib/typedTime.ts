/**
 * Puts the colon in a time as it's typed (GRIZZ, 2026-11-16: "if someone
 * types 2030 it automatically adjusts it"). Digits fill from the right, so
 * "7" → "7", "73" → "73", "730" → "7:30" and "2030" → "20:30". A colon the
 * person types themselves is kept ("7:" stays "7:").
 */
export function formatTypedTime(text: string): string {
  const typed = /^(\d{0,2}):(\d{0,2})$/.exec(text.replace(/[.h,\s]/g, ":"));
  if (typed && typed[1]) return `${typed[1]}:${typed[2]}`;
  const digits = text.replace(/\D/g, "").slice(0, 4);
  if (digits.length < 3) return digits;
  return `${digits.slice(0, -2)}:${digits.slice(-2)}`;
}

/**
 * When the box is left: a whole hour gets ":00" and a single-digit hour gets
 * a leading 0, so "7" → "07:00", "730" → "07:30", "20" → "20:00". Anything
 * that isn't a real 24-hour time is left as typed so the screen can flag it.
 */
export function finishTypedTime(text: string): string {
  const m = /^(\d{1,2})(?::(\d{0,2}))?$/.exec(formatTypedTime(text));
  if (!m) return text;
  const hours = Number(m[1]);
  const minutes = m[2] ? Number(m[2]) : 0;
  if (m[2] && m[2].length === 1) return text;
  if (hours > 23 || minutes > 59) return text;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
