/**
 * Turns whatever a client types into the reminder time box into "HH:MM", or
 * null if it isn't a real time. Phones make the colon awkward to reach, so
 * "8", "8:00", "8.00", "8h00", "0800" and "18 30" are all accepted.
 */
export function parseReminderTime(input: string): string | null {
  const raw = input.trim().toLowerCase();
  let hours: number;
  let minutes: number;

  const separated = raw.match(/^(\d{1,2})\s*[:.,h\s-]\s*(\d{1,2})$/);
  const digitsOnly = raw.match(/^\d{1,4}$/);
  if (separated) {
    if (separated[2].length !== 2) return null;
    hours = Number(separated[1]);
    minutes = Number(separated[2]);
  } else if (digitsOnly) {
    // "8" / "18" are whole hours; "830" / "0830" / "1830" carry minutes.
    if (raw.length <= 2) {
      hours = Number(raw);
      minutes = 0;
    } else {
      hours = Number(raw.slice(0, -2));
      minutes = Number(raw.slice(-2));
    }
  } else {
    return null;
  }

  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
