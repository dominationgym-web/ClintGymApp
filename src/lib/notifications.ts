// Phone notifications. These only work in the installed app (a preview or
// store build), not in Expo Go: Expo Go dropped expo-notifications support in
// SDK 53 and importing it there crashed the app for every client. So the
// module is loaded lazily and never in Expo Go, where everything here quietly
// does nothing and the in-app banners do the reminding instead.
//
// Reminders are scheduled on the phone itself (local notifications), so no
// server, push token or Apple/Google push setup is involved.
import { Platform } from "react-native";
import { isRunningInExpoGo } from "expo";
import { progressPhotoReminderAt } from "@/lib/progressPhotos";

type NotificationsModule = typeof import("expo-notifications");

const PROGRESS_PHOTO_ID = "progress-photo-reminder";
const REMINDERS_CHANNEL = "reminders";

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
