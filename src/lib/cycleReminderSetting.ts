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

// "My periods are irregular or have stopped" (perimenopause, menopause or
// cycles that vary a lot; nutrition review, 2026-10-18). When on, the tracker
// hides the phase guide and the phone stops the phase reminders and the
// Saturday "log your period" nudge. Off unless she turns it on.
const IRREGULAR_KEY = "cycleIrregular";

export async function getCycleIrregular(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(IRREGULAR_KEY)) === "true";
  } catch {
    return false;
  }
}

export async function setCycleIrregular(irregular: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(IRREGULAR_KEY, irregular ? "true" : "false");
  } catch (e) {
    console.warn("Couldn't save the irregular periods setting", e);
  }
}
