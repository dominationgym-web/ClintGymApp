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

export type HabitReminderSlot = { id: string; habitName: string; weekday: number; hour: number; minute: number };

// iOS keeps at most 64 scheduled notifications per app, shared with the sleep,
// cycle and Reset reminders, so habit reminders stop at this many.
export const MAX_HABIT_REMINDERS = 35;

/**
 * The weekly phone reminders for the client's habits: one per active day of
 * each running habit with a reminder switched on and a time saved. weekday
 * follows expo-notifications (Sunday 1 ... Saturday 7); active_days is 0-6
 * from Sunday.
 */
export function habitReminderSlots(
  habits: { id: string; name: string; active_days: number[]; reminder_enabled: boolean; reminder_time: string | null; end_date: string | null }[],
  today: string
): HabitReminderSlot[] {
  const slots: HabitReminderSlot[] = [];
  for (const h of habits) {
    if (!h.reminder_enabled || !h.reminder_time) continue;
    if (h.end_date && h.end_date < today) continue;
    const time = parseReminderTime(h.reminder_time.slice(0, 5));
    if (!time) continue;
    const [hour, minute] = time.split(":").map(Number);
    for (const day of [...h.active_days].sort()) {
      slots.push({ id: `habit-${h.id}-${day}`, habitName: h.name, weekday: day + 1, hour, minute });
    }
  }
  return slots.slice(0, MAX_HABIT_REMINDERS);
}
