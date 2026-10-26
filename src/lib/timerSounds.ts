import AsyncStorage from "@react-native-async-storage/async-storage";

// Timer sounds (GRIZZ, 2026-10-26): a loud beep so you hear the timer across
// the gym, not just feel the buzz. Used by the Timers page, the interval timer
// and the rest timer after a set. Needs the expo-audio build
// (runtimeVersion 2026-10-26-sound); anything that goes wrong with sound just
// stays silent, so the timer itself never breaks. Sound on or off is kept on
// the phone.

export type TimerSound = "tick" | "go" | "rest" | "finish" | "bell" | "bellEnd" | "clapper" | "knock" | "ticker";

const SOURCES: Record<TimerSound, number> = {
  tick: require("../../assets/sounds/tick.wav"),
  go: require("../../assets/sounds/go.wav"),
  rest: require("../../assets/sounds/rest.wav"),
  finish: require("../../assets/sounds/finish.wav"),
  bell: require("../../assets/sounds/bell.wav"),
  bellEnd: require("../../assets/sounds/bell-end.wav"),
  clapper: require("../../assets/sounds/clapper.wav"),
  knock: require("../../assets/sounds/knock.wav"),
  ticker: require("../../assets/sounds/ticker.wav"),
};

type Player = { play: () => void; seekTo: (s: number) => Promise<void> | void; volume: number };

const players = new Map<TimerSound, Player>();
let audio: typeof import("expo-audio") | null | undefined;
let soundOn = true;
let loaded = false;
const KEY = "timerSoundOn";

function audioModule() {
  if (audio !== undefined) return audio;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    audio = require("expo-audio") as typeof import("expo-audio");
    // Plays with the phone on silent, and over the gym music without stopping it.
    audio.setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "mixWithOthers", shouldPlayInBackground: false }).catch(() => {});
  } catch {
    audio = null;
  }
  return audio;
}

/** Loads the sound setting and the sounds, so the first beep isn't late. */
export async function prepareTimerSounds(): Promise<boolean> {
  if (!loaded) {
    loaded = true;
    try {
      soundOn = (await AsyncStorage.getItem(KEY)) !== "off";
    } catch {
      // Keep the default (on).
    }
  }
  const a = audioModule();
  if (a) {
    for (const key of Object.keys(SOURCES) as TimerSound[]) {
      if (players.has(key)) continue;
      try {
        const p = a.createAudioPlayer(SOURCES[key]) as unknown as Player;
        p.volume = 1;
        players.set(key, p);
      } catch {
        // No sound for this one.
      }
    }
  }
  return soundOn;
}

export function playTimerSound(sound: TimerSound) {
  if (!soundOn) return;
  const p = players.get(sound);
  if (!p) return;
  try {
    const r = p.seekTo(0);
    if (r && typeof (r as Promise<void>).catch === "function") (r as Promise<void>).catch(() => {});
    p.play();
  } catch {
    // Stay silent rather than stop the timer.
  }
}

export function timerSoundOn(): boolean {
  return soundOn;
}

export async function setTimerSoundOn(on: boolean) {
  soundOn = on;
  try {
    await AsyncStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Only lasts until the app closes.
  }
}

/**
 * The sound for moving into a phase: a bell for boxing rounds (one ding to
 * start, three to end), otherwise a high beep for work and a double beep for rest.
 */
export function switchSound(kind: "work" | "easy", bell: boolean): TimerSound {
  if (bell) return kind === "work" ? "bell" : "bellEnd";
  return kind === "work" ? "go" : "rest";
}
