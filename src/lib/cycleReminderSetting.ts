// Whether this phone shows the 8am Women's Health Reset reminder. On unless the client
// turns it off in Women's Health Reset. Kept on the phone, like the reminders
// themselves.
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "cycleReminderEnabled";

export async function getCycleReminderEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) !== "false";
  } catch {
    return true;
  }
}

export async function setCycleReminderEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, enabled ? "true" : "false");
  } catch (e) {
    console.warn("Couldn't save the cycle reminder setting", e);
  }
}
