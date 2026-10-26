// Which notification groups a client wants (GRIZZ, 2026-10-26: "some people
// just get annoyed by too many notifications"). Saved in
// client_notification_prefs (0159), where push_to_user() reads it for the
// server's pushes, and copied to the phone so the reminders the phone
// schedules itself (src/lib/notifications.ts) can check it without a network
// call. Everything is on until the client switches a group off.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

export type NotificationGroup = "checkin_reminders" | "training" | "habits" | "progress" | "womens_health";

export type NotificationPrefs = Record<NotificationGroup, boolean>;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  checkin_reminders: true,
  training: true,
  habits: true,
  progress: true,
  womens_health: true,
};

export type NotificationGroupInfo = {
  key: NotificationGroup;
  icon: string;
  title: string;
  includes: string;
  womenOnly?: boolean;
};

export const NOTIFICATION_GROUPS: NotificationGroupInfo[] = [
  {
    key: "checkin_reminders",
    icon: "📹",
    title: "Video check-in reminders",
    includes: "The day before, that morning, an hour before and 15 minutes before your call, and a nudge to pick next week's time.",
  },
  {
    key: "training",
    icon: "💪",
    title: "Training",
    includes: "Weekend catch-up for a missed workout, a new timer workout from your coach and each month's new challenge.",
  },
  {
    key: "habits",
    icon: "✅",
    title: "Daily habits, sleep and steps",
    includes: "Your habit reminders, the 6pm wind-down tip for sleep and your step goal reminders.",
  },
  {
    key: "progress",
    icon: "📈",
    title: "Progress tracking",
    includes: "Weigh-in day and your progress photos every 6 weeks.",
  },
  {
    key: "womens_health",
    icon: "🌸",
    title: "Women's health",
    includes: "Your Reset reminder, the daily cycle phase tip, the supplement check before your period and the cycle tracker nudge.",
    womenOnly: true,
  },
];

/** What always comes through, shown so clients know why. */
export const ALWAYS_ON_NOTIFICATIONS =
  "Messages from your coach, your account and plan (activated, ending soon, ended) and video check-in bookings (confirmed, declined or cancelled).";

export const NOTIFICATIONS_MENU_ITEM = {
  key: "notifications",
  title: "Notifications",
  icon: "🔔",
  summary: "Choose which reminders you get on your phone.",
};

const KEY = "notificationPrefs";

/** Reads a saved row (or the phone's copy) into a full set, every missing group on. */
export function toNotificationPrefs(raw: unknown): NotificationPrefs {
  const prefs = { ...DEFAULT_NOTIFICATION_PREFS };
  if (raw && typeof raw === "object") {
    for (const key of Object.keys(prefs) as NotificationGroup[]) {
      const value = (raw as Record<string, unknown>)[key];
      if (typeof value === "boolean") prefs[key] = value;
    }
  }
  return prefs;
}

/** The groups switched off. */
export function groupsOff(prefs: NotificationPrefs): NotificationGroup[] {
  return (Object.keys(prefs) as NotificationGroup[]).filter((g) => !prefs[g]);
}

/** The phone's copy. All on if it has none yet. */
export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    const saved = await AsyncStorage.getItem(KEY);
    return toNotificationPrefs(saved ? JSON.parse(saved) : null);
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
}

export async function notificationGroupOn(group: NotificationGroup): Promise<boolean> {
  return (await getNotificationPrefs())[group];
}

async function keepOnPhone(prefs: NotificationPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn("Couldn't keep the notification settings on this phone", e);
  }
}

/**
 * Loads the client's saved settings and copies them to the phone. Falls back
 * to the phone's copy when offline. Call on app open, so a new phone picks
 * them up before it schedules any reminders.
 */
export async function loadNotificationPrefs(clientId: string): Promise<NotificationPrefs> {
  const { data, error } = await supabase
    .from("client_notification_prefs")
    .select("checkin_reminders, training, habits, progress, womens_health")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) return getNotificationPrefs();
  const prefs = toNotificationPrefs(data);
  await keepOnPhone(prefs);
  return prefs;
}

/** Saves for the server's pushes and the phone's reminders. Throws if it couldn't save. */
export async function saveNotificationPrefs(clientId: string, prefs: NotificationPrefs): Promise<void> {
  const { error } = await supabase
    .from("client_notification_prefs")
    .upsert({ client_id: clientId, ...prefs, updated_at: new Date().toISOString() });
  if (error) throw error;
  await keepOnPhone(prefs);
}

/** Forgets the phone's copy at sign-out, so the next person starts with theirs. */
export async function clearNotificationPrefs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Nothing to do: the next sign-in loads its own.
  }
}
