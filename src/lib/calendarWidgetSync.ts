import { NativeModules, Platform, TurboModuleRegistry } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { WIDGET_APP_GROUP, WIDGET_KEY_STORAGE } from "@/lib/widgetKeyStorage";

// The app's side of the home-screen calendar widget (0214, GRIZZ 2026-11-16).
// On a trainer's sign-in the phone gets a widget key; on sign-out it's dropped
// so the widget goes blank. After any change to the calendar the app asks the
// widget to draw again.
//
// Builds from before the widget don't have its native code, but they do get
// this JS as an instant update, so every native call checks first and does
// nothing there.

type ExtensionStorageLike = {
  set(key: string, value?: string): void;
  remove(key: string): void;
};

function androidWidgetReady(): boolean {
  if (Platform.OS !== "android") return false;
  try {
    return !!(TurboModuleRegistry.get("AndroidWidget") ?? NativeModules.AndroidWidget);
  } catch {
    return false;
  }
}

function iosStorage(): { storage: ExtensionStorageLike; reload: () => void } | null {
  if (Platform.OS !== "ios") return null;
  // expo.modules is the Expo modules registry on the global object.
  if (!(globalThis as { expo?: { modules?: Record<string, unknown> } }).expo?.modules?.ExtensionStorage) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ExtensionStorage } = require("@bacons/apple-targets") as typeof import("@bacons/apple-targets");
    return { storage: new ExtensionStorage(WIDGET_APP_GROUP), reload: () => ExtensionStorage.reloadWidget() };
  } catch {
    return null;
  }
}

/** Does this phone have the widget's native code (a build from 2026-11-16 on)? */
export function calendarWidgetSupported(): boolean {
  return androidWidgetReady() || !!iosStorage();
}

/** Ask the home-screen widget to draw again (after a session changes). */
export function refreshCalendarWidget(): void {
  try {
    if (androidWidgetReady()) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require("@/widgets/refreshAndroidWidget") as typeof import("@/widgets/refreshAndroidWidget")).refreshAndroidWidget();
      return;
    }
    iosStorage()?.reload();
  } catch {
    // A widget that can't redraw just waits for its own next refresh.
  }
}

async function saveKey(key: string | null) {
  try {
    if (key) await AsyncStorage.setItem(WIDGET_KEY_STORAGE, key);
    else {
      await AsyncStorage.removeItem(WIDGET_KEY_STORAGE);
      await AsyncStorage.removeItem(`${WIDGET_KEY_STORAGE}.last`);
    }
  } catch {
    // Storage full or blocked: the widget asks to log in.
  }
  const ios = iosStorage();
  if (ios) {
    try {
      if (key) {
        ios.storage.set("key", key);
        ios.storage.set("url", process.env.EXPO_PUBLIC_SUPABASE_URL ?? "");
        ios.storage.set("anon", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "");
      } else ios.storage.remove("key");
    } catch {
      // ignore
    }
  }
  refreshCalendarWidget();
}

let settingUp = false;

/** A trainer is signed in: make sure the phone has a widget key. */
export async function setUpCalendarWidget(): Promise<void> {
  if (settingUp || !calendarWidgetSupported()) return;
  settingUp = true;
  try {
    const have = await AsyncStorage.getItem(WIDGET_KEY_STORAGE).catch(() => null);
    const ios = iosStorage();
    // An iPhone that has the key in the app but not yet in the widget's group.
    if (have && ios) {
      await saveKey(have);
      return;
    }
    if (have) {
      refreshCalendarWidget();
      return;
    }
    const { data, error } = await supabase.rpc("create_widget_key", { p_old: null });
    if (!error && typeof data === "string") await saveKey(data);
  } finally {
    settingUp = false;
  }
}

/** Signing out: the widget's key stops working and the widget goes blank. */
export async function forgetCalendarWidget(): Promise<void> {
  const key = await AsyncStorage.getItem(WIDGET_KEY_STORAGE).catch(() => null);
  if (!key) return;
  await saveKey(null);
  await supabase.rpc("revoke_widget_key", { p_key: key }).then(
    () => undefined,
    () => undefined
  );
}
