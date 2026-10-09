// Whether this phone shows the nightly 6pm sleep tip. On unless the client
// turns it off in Sleep & Recovery. Kept on the phone, like the reminders
// themselves.
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "sleepReminderEnabled";

export async function getSleepReminderEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) !== "false";
  } catch {
    return true;
  }
}

export async function setSleepReminderEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, enabled ? "true" : "false");
  } catch (e) {
    console.warn("Couldn't save the sleep reminder setting", e);
  }
}
