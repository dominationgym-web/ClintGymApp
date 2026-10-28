import AsyncStorage from "@react-native-async-storage/async-storage";

// The client page opens on the tab the trainer used last (GRIZZ, 2026-10-27),
// usually Training, so the calendar is one tap closer. Kept on the phone so it
// survives closing the app; read once when the app starts.
const KEY = "trainer.lastClientTab";
let last: string | null = null;

AsyncStorage.getItem(KEY)
  .then((value) => {
    if (last == null) last = value;
  })
  .catch(() => undefined);

export function lastClientTab<T extends string>(allowed: readonly T[]): T | null {
  return allowed.includes(last as T) ? (last as T) : null;
}

export function rememberClientTab(tab: string) {
  last = tab;
  AsyncStorage.setItem(KEY, tab).catch(() => undefined);
}
