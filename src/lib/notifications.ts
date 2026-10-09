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
