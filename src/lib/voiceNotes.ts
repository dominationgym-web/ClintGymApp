// Voice notes need expo-audio, a native package (added 2026-10-25). Phones on
// an app build from before then don't have it, and they still get instant
// updates, so loading expo-audio there would crash the app on open. Instead
// the recorder and player are only loaded where the native part is present
// (new builds, Expo Go and the laptop app); elsewhere the chat shows text and
// photos and asks the person to update the app for voice notes.
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import type React from "react";

let available: boolean | undefined;

export function voiceNotesAvailable(): boolean {
  if (available === undefined) {
    available = Platform.OS === "web" || requireOptionalNativeModule("ExpoAudio") != null;
  }
  return available;
}

export type VoiceRecorderProps = {
  /** Called with the finished recording, or not at all if it was cancelled. */
  onDone: (recording: { uri: string; durationMs: number }) => void;
  onCancel: () => void;
};

export type VoiceNotePlayerProps = {
  /** A signed link to the voice note. */
  url: string | null;
  durationMs: number | null;
  mine: boolean;
};

/** The recording bar, or null on a build without expo-audio. */
export function loadVoiceRecorder(): React.ComponentType<VoiceRecorderProps> | null {
  if (!voiceNotesAvailable()) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/components/chat/VoiceRecorder").default;
}

/** The play button, or null on a build without expo-audio. */
export function loadVoiceNotePlayer(): React.ComponentType<VoiceNotePlayerProps> | null {
  if (!voiceNotesAvailable()) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/components/chat/VoiceNotePlayer").default;
}
