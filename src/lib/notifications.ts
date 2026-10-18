// Phone notifications. These only work in the installed app (a preview or
// store build), not in Expo Go: Expo Go dropped expo-notifications support in
// SDK 53 and importing it there crashed the app for every client. So the
// module is loaded lazily and never in Expo Go, where everything here quietly
// does nothing and the in-app banners do the reminding instead.
//
// Reminders are scheduled on the phone itself (local notifications), so no
// server is involved. Messages from the trainer are the one exception: those
// come from the server through Expo's push service (0034), using the token
// registerForCoachMessages() saves.
import { Platform } from "react-native";
import { isRunningInExpoGo } from "expo";
import Constants from "expo-constants";
import { supabase } from "@/lib/supabase";
import { progressPhotoReminderAt } from "@/lib/progressPhotos";
import { upcomingSleepReminders } from "@/lib/sleep";
import { SUPPLEMENT_PREP_BODY, SUPPLEMENT_PREP_TITLE, supplementPrepDates, upcomingPhases } from "@/lib/cycle";
import { upcomingResetReminders } from "@/lib/resetProgram";
import { parseIsoDate, todayIso } from "@/lib/dates";
import { habitReminderSlots } from "@/lib/reminderTime";

type NotificationsModule = typeof import("expo-notifications");

const PROGRESS_PHOTO_ID = "progress-photo-reminder";
const REMINDERS_CHANNEL = "reminders";
// Must match channelId in notify_coach_message() (0034).
const MESSAGES_CHANNEL = "messages";

let loaded: NotificationsModule | null | undefined;

function notifications(): NotificationsModule | null {
  if (loaded !== undefined) return loaded;
  if (Platform.OS === "web" || isRunningInExpoGo()) {
    loaded = null;
    return loaded;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  loaded = require("expo-notifications") as NotificationsModule;
  return loaded;
}

/** Call once at startup so reminders also show while the app is open. */
export function setUpNotifications(): void {
  const N = notifications();
  if (!N) return;
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function canNotify(N: NotificationsModule): Promise<boolean> {
  if (Platform.OS === "android") {
    await N.setNotificationChannelAsync(REMINDERS_CHANNEL, {
      name: "Reminders",
      importance: N.AndroidImportance.DEFAULT,
    });
  }
  const current = await N.getPermissionsAsync();
  if (current.granted) return true;
  // Only ask once; if they said no, respect it rather than asking every time.
  if (!current.canAskAgain) return false;
  return (await N.requestPermissionsAsync()).granted;
}

/**
 * (Re)schedules the 6-week progress photo notification from the date of the
 * client's latest photo. Safe to call on every app open: it replaces the one
 * already scheduled rather than adding another.
 */
export async function scheduleProgressPhotoReminder(lastTakenOn: string | null): Promise<void> {
  const N = notifications();
  if (!N) return;
  try {
    await N.cancelScheduledNotificationAsync(PROGRESS_PHOTO_ID);
    const at = progressPhotoReminderAt(lastTakenOn, new Date());
    if (!at || !(await canNotify(N))) return;
    await N.scheduleNotificationAsync({
      identifier: PROGRESS_PHOTO_ID,
      content: {
        title: "Progress photo day 📸",
        body: "It's been 6 weeks. Front, side and back, full body, same spot and lighting as last time.",
      },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: at, channelId: REMINDERS_CHANNEL },
    });
  } catch (e) {
    // A reminder failing to schedule must never break the screen it runs from.
    console.warn("Couldn't schedule the progress photo reminder", e);
  }
}

const SLEEP_ID_PREFIX = "sleep-reminder-";
// Each night is scheduled separately so each can carry its own tip. Two weeks
// ahead, topped up every time the app opens, stays well inside iOS's limit of
// 64 scheduled notifications.
const SLEEP_NIGHTS_AHEAD = 14;

/**
 * (Re)schedules the 6pm sleep tip for the next two weeks, or clears them all
 * when `enabled` is false. Safe to call on every app open.
 */
export async function scheduleSleepReminders(enabled: boolean): Promise<void> {
  const N = notifications();
  if (!N) return;
  try {
    const scheduled = await N.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.identifier.startsWith(SLEEP_ID_PREFIX))
        .map((n) => N.cancelScheduledNotificationAsync(n.identifier))
    );
    if (!enabled || !(await canNotify(N))) return;
    for (const night of upcomingSleepReminders(new Date(), SLEEP_NIGHTS_AHEAD)) {
      await N.scheduleNotificationAsync({
        identifier: night.id,
        content: { title: "Time to start winding down 🌙", body: night.tip },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: night.at, channelId: REMINDERS_CHANNEL },
      });
    }
  } catch (e) {
    console.warn("Couldn't schedule the sleep reminders", e);
  }
}

// The token this phone registered, so sign-out can remove it.
let registeredPushToken: string | null = null;

/**
 * Saves this phone's push token so messages from the trainer arrive as phone
 * notifications. Safe to call on every app open. Quietly does nothing in Expo
 * Go, or if the client said no to notifications, or if the build can't get a
 * token (an Android build needs Firebase set up in Expo for that).
 */
export async function registerForCoachMessages(): Promise<void> {
  const N = notifications();
  if (!N) return;
  try {
    if (Platform.OS === "android") {
      await N.setNotificationChannelAsync(MESSAGES_CHANNEL, {
        name: "Messages from your coach",
        importance: N.AndroidImportance.HIGH,
      });
    }
    if (!(await canNotify(N))) return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: token } = await N.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const { error } = await supabase.rpc("register_push_token", { p_token: token });
    if (error) throw error;
    registeredPushToken = token;
  } catch (e) {
    console.warn("Couldn't register for message notifications", e);
  }
}

/** Stops this phone getting the signed-in user's messages. Call before signing out. */
export async function unregisterForCoachMessages(): Promise<void> {
  if (!registeredPushToken) return;
  try {
    await supabase.from("push_tokens").delete().eq("expo_push_token", registeredPushToken);
    registeredPushToken = null;
  } catch (e) {
    console.warn("Couldn't clear the message notification token", e);
  }
}

const CYCLE_ID_PREFIX = "cycle-reminder-";
const CYCLE_DAYS_AHEAD = 14;
const CYCLE_REMINDER_HOUR = 8;
// An hour after the phase reminder, so the two don't land together.
const SUPPLEMENT_PREP_HOUR = 9;

/**
 * (Re)schedules the 8am Women's Health Reset nudge for the next two weeks,
 * each one for the phase she'll be in that day, plus a supplement check a
 * week before each of her next three periods, or clears them all when
 * `enabled` is false or she hasn't logged a period. Safe to call on every open.
 */
export async function scheduleCycleReminders(periodStarts: string[], enabled: boolean): Promise<void> {
  const N = notifications();
  if (!N) return;
  try {
    const scheduled = await N.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.identifier.startsWith(CYCLE_ID_PREFIX))
        .map((n) => N.cancelScheduledNotificationAsync(n.identifier))
    );
    if (!enabled || periodStarts.length === 0 || !(await canNotify(N))) return;
    const now = new Date();
    for (const { date, phase } of upcomingPhases(periodStarts, todayIso(), CYCLE_DAYS_AHEAD)) {
      const at = parseIsoDate(date);
      at.setHours(CYCLE_REMINDER_HOUR, 0, 0, 0);
      if (at <= now) continue;
      await N.scheduleNotificationAsync({
        identifier: `${CYCLE_ID_PREFIX}${date}`,
        content: { title: `${phase.emoji} ${phase.name}`, body: phase.reminder },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: at, channelId: REMINDERS_CHANNEL },
      });
    }
    // A week before each of her next three periods: check her supplements.
    for (const date of supplementPrepDates(periodStarts, todayIso(), 3)) {
      const at = parseIsoDate(date);
      at.setHours(SUPPLEMENT_PREP_HOUR, 0, 0, 0);
      if (at <= now) continue;
      await N.scheduleNotificationAsync({
        identifier: `${CYCLE_ID_PREFIX}supplements-${date}`,
        content: { title: SUPPLEMENT_PREP_TITLE, body: SUPPLEMENT_PREP_BODY },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: at, channelId: REMINDERS_CHANNEL },
      });
    }
  } catch (e) {
    console.warn("Couldn't schedule the cycle reminders", e);
  }
}

const RESET_ID_PREFIX = "reset-reminder-";
const RESET_DAYS_AHEAD = 14;

/**
 * (Re)schedules the daily Women's Health Reset reminder at the time she
 * picked for the next two weeks, each naming that day's week, or clears them
 * when it's off or she hasn't started. Safe to call on every open.
 */
export async function scheduleResetReminders(startedOn: string | null, enabled: boolean, time: string): Promise<void> {
  const N = notifications();
  if (!N) return;
  try {
    const scheduled = await N.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.identifier.startsWith(RESET_ID_PREFIX))
        .map((n) => N.cancelScheduledNotificationAsync(n.identifier))
    );
    if (!enabled || !startedOn || !(await canNotify(N))) return;
    for (const r of upcomingResetReminders(startedOn, time, new Date(), RESET_DAYS_AHEAD)) {
      await N.scheduleNotificationAsync({
        identifier: r.id,
        content: { title: r.title, body: r.body },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: REMINDERS_CHANNEL },
      });
    }
  } catch (e) {
    console.warn("Couldn't schedule the Reset reminders", e);
  }
}

const HABIT_ID_PREFIX = "habit-";

/**
 * Weekly reminders for the client's habits at the time they saved, on each of
 * the habit's days. Replaces the ones already scheduled, so call it whenever
 * the habit list changes (the Habits tab does, each time it opens).
 */
export async function scheduleHabitReminders(
  habits: Parameters<typeof habitReminderSlots>[0]
): Promise<void> {
  const N = notifications();
  if (!N) return;
  try {
    const scheduled = await N.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.identifier.startsWith(HABIT_ID_PREFIX))
        .map((n) => N.cancelScheduledNotificationAsync(n.identifier))
    );
    const slots = habitReminderSlots(habits, todayIso());
    if (slots.length === 0 || !(await canNotify(N))) return;
    for (const slot of slots) {
      await N.scheduleNotificationAsync({
        identifier: slot.id,
        content: { title: `✅ ${slot.habitName}`, body: "Time for your habit. Tick it off on the Habits tab." },
        trigger: {
          type: N.SchedulableTriggerInputTypes.WEEKLY,
          weekday: slot.weekday,
          hour: slot.hour,
          minute: slot.minute,
          channelId: REMINDERS_CHANNEL,
        },
      });
    }
  } catch (e) {
    console.warn("Couldn't schedule the habit reminders", e);
  }
}

// Taps already handled, so the one that opened the app isn't handled twice.
const handledTaps = new Set<string>();

/**
 * Calls `handle` with the push's data whenever a notification is tapped,
 * including the tap that opened the app from closed. Returns the unsubscribe.
 */
export function onNotificationTap(handle: (data: Record<string, unknown>) => void): () => void {
  const N = notifications();
  if (!N) return () => undefined;
  const take = (response: { notification: { request: { identifier: string; content: { data?: unknown } } } } | null) => {
    if (!response) return;
    const { identifier, content } = response.notification.request;
    if (handledTaps.has(identifier)) return;
    handledTaps.add(identifier);
    if (content.data && typeof content.data === "object") handle(content.data as Record<string, unknown>);
  };
  N.getLastNotificationResponseAsync()
    .then(take)
    .catch(() => undefined);
  const subscription = N.addNotificationResponseReceivedListener(take);
  return () => subscription.remove();
}

/** Clears this phone's reminders, so the next person to sign in doesn't get them. */
export async function cancelAllReminders(): Promise<void> {
  const N = notifications();
  if (!N) return;
  try {
    await N.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.warn("Couldn't clear scheduled reminders", e);
  }
}

const SUGGESTION_BOX_ID = "suggestion-box-reminder";
// Sunday is 1 in expo-notifications' weekly trigger, so Monday is 2.
const SUGGESTION_BOX_WEEKDAY = 2;
const SUGGESTION_BOX_HOUR = 9;

/**
 * The app owner's weekly nudge to read the suggestion box (0046): Mondays at
 * 9am. Safe to call on every app open: it replaces the one already scheduled.
 */
export async function scheduleSuggestionBoxReminder(): Promise<void> {
  const N = notifications();
  if (!N) return;
  try {
    await N.cancelScheduledNotificationAsync(SUGGESTION_BOX_ID);
    if (!(await canNotify(N))) return;
    await N.scheduleNotificationAsync({
      identifier: SUGGESTION_BOX_ID,
      content: {
        title: "Suggestion box 💡",
        body: "See what your clients and trainers have suggested this week. Menu > Suggestion box.",
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.WEEKLY,
        weekday: SUGGESTION_BOX_WEEKDAY,
        hour: SUGGESTION_BOX_HOUR,
        minute: 0,
        channelId: REMINDERS_CHANNEL,
      },
    });
  } catch (e) {
    console.warn("Couldn't schedule the suggestion box reminder", e);
  }
}

const CYCLE_NUDGE_ID = "cycle-tracker-nudge";
// Sunday is 1, so Saturday is 7.
const CYCLE_NUDGE_WEEKDAY = 7;
const CYCLE_NUDGE_HOUR = 9;
export const CYCLE_NUDGE_TITLE = "🌸 Your cycle tracker";
export const CYCLE_NUDGE_BODY =
  "Log the first day of your last period and the app will guide your training, food and supplements through every phase. Menu ☰ → Women's Health Reset.";

/**
 * Saturdays at 9am, a nudge for women who haven't used the cycle tracker yet
 * (GRIZZ, 2026-10-14). `wanted` is false once she has logged a period (or for
 * men), which cancels it for good. Safe to call on every open.
 */
export async function scheduleCycleTrackerNudge(wanted: boolean): Promise<void> {
  const N = notifications();
  if (!N) return;
  try {
    await N.cancelScheduledNotificationAsync(CYCLE_NUDGE_ID);
    if (!wanted || !(await canNotify(N))) return;
    await N.scheduleNotificationAsync({
      identifier: CYCLE_NUDGE_ID,
      content: { title: CYCLE_NUDGE_TITLE, body: CYCLE_NUDGE_BODY },
      trigger: {
        type: N.SchedulableTriggerInputTypes.WEEKLY,
        weekday: CYCLE_NUDGE_WEEKDAY,
        hour: CYCLE_NUDGE_HOUR,
        minute: 0,
        channelId: REMINDERS_CHANNEL,
      },
    });
  } catch (e) {
    console.warn("Couldn't schedule the cycle tracker nudge", e);
  }
}

export type NotificationPermission = "granted" | "ask" | "blocked" | "unavailable";

/** Whether this phone lets the app send notifications ("unavailable" in Expo Go). */
export async function notificationPermission(): Promise<NotificationPermission> {
  const N = notifications();
  if (!N) return "unavailable";
  try {
    const current = await N.getPermissionsAsync();
    if (current.granted) return "granted";
    return current.canAskAgain ? "ask" : "blocked";
  } catch {
    return "unavailable";
  }
}

/** Asks for permission (the "Turn on" button), then registers for push. */
export async function turnOnNotifications(): Promise<boolean> {
  const N = notifications();
  if (!N) return false;
  try {
    const granted = (await N.requestPermissionsAsync()).granted;
    if (granted) await registerForCoachMessages();
    return granted;
  } catch (e) {
    console.warn("Couldn't turn on notifications", e);
    return false;
  }
}
