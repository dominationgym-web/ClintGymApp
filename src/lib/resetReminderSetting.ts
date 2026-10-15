// The Women's Health Reset daily reminder: off until the client switches it
// on, at a time she picks. Kept on the phone, like the reminders themselves.
import AsyncStorage from "@react-native-async-storage/async-storage";

const ENABLED_KEY = "resetReminderEnabled";
const TIME_KEY = "resetReminderTime";
export const DEFAULT_RESET_REMINDER_TIME = "07:00";

export type ResetReminderSetting = { enabled: boolean; time: string };

export async function getResetReminder(): Promise<ResetReminderSetting> {
  try {
    const [enabled, time] = await Promise.all([AsyncStorage.getItem(ENABLED_KEY), AsyncStorage.getItem(TIME_KEY)]);
    return { enabled: enabled === "true", time: time ?? DEFAULT_RESET_REMINDER_TIME };
  } catch {
    return { enabled: false, time: DEFAULT_RESET_REMINDER_TIME };
  }
}

export async function setResetReminder(setting: ResetReminderSetting): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [ENABLED_KEY, setting.enabled ? "true" : "false"],
      [TIME_KEY, setting.time],
    ]);
  } catch (e) {
    console.warn("Couldn't save the Reset reminder setting", e);
  }
}
