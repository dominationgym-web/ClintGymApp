import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from "expo-audio";
import { BRAND_GOLD } from "@/lib/brand";
import { formatDuration, MAX_VOICE_MS, MIN_VOICE_MS } from "@/lib/chat";
import type { VoiceRecorderProps } from "@/lib/voiceNotes";

// Only ever loaded through loadVoiceRecorder() (src/lib/voiceNotes.ts), so a
// phone without expo-audio never imports this file.

// Speech only needs mono at a low bit rate: about 0.5 MB a minute.
const VOICE_OPTIONS: RecordingOptions = {
  extension: ".m4a",
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 64000,
  android: { outputFormat: "mpeg4", audioEncoder: "aac" },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MEDIUM,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: "audio/webm", bitsPerSecond: 64000 },
};

// Starts recording as soon as it opens (after the microphone question the
// first time). Tap the tick to send it, or the bin to throw it away.
export default function VoiceRecorder({ onDone, onCancel }: VoiceRecorderProps) {
  const recorder = useAudioRecorder(VOICE_OPTIONS);
  const state = useAudioRecorderState(recorder, 250);
  const [starting, setStarting] = useState(true);
  const finished = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            "Microphone is off",
            "To send voice notes, allow the microphone for Daily Evolution in your phone's settings."
          );
          onCancel();
          return;
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        if (cancelled) return;
        recorder.record();
      } catch (e) {
        Alert.alert("Couldn't record", e instanceof Error ? e.message : "Please try again.");
        onCancel();
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();
    return () => {
      cancelled = true;
      // Leaving the chat mid-recording throws it away.
      if (!finished.current) recorder.stop().catch(() => undefined);
      setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = async (send: boolean) => {
    if (finished.current) return;
    finished.current = true;
    const durationMs = state.durationMillis;
    try {
      await recorder.stop();
    } catch {
      // Already stopped.
    }
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    const uri = recorder.uri;
    if (!send) {
      onCancel();
      return;
    }
    if (!uri || durationMs < MIN_VOICE_MS) {
      Alert.alert("Too short", "Tap the microphone and talk for at least a second.");
      onCancel();
      return;
    }
    onDone({ uri, durationMs });
  };

  // Stops on its own at the limit and sends what was said.
  useEffect(() => {
    if (state.isRecording && state.durationMillis >= MAX_VOICE_MS) finish(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.durationMillis, state.isRecording]);

  return (
    <View style={styles.bar}>
      <Pressable style={styles.iconButton} onPress={() => finish(false)} accessibilityLabel="Throw away voice note">
        <Ionicons name="trash-outline" size={22} color="#F87171" />
      </Pressable>
      <View style={styles.middle}>
        {starting ? (
          <ActivityIndicator color={BRAND_GOLD} />
        ) : (
          <>
            <View style={styles.dot} />
            <Text style={styles.time}>{formatDuration(state.durationMillis)}</Text>
            <Text style={styles.hint}>Recording… max {formatDuration(MAX_VOICE_MS)}</Text>
          </>
        )}
      </View>
      <Pressable
        style={[styles.send, starting && styles.disabled]}
        onPress={() => finish(true)}
        disabled={starting}
        accessibilityLabel="Send voice note"
      >
        <Ionicons name="send" size={20} color="#0F172A" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  iconButton: { padding: 10 },
  middle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#1E293B", borderRadius: 22, paddingHorizontal: 14, height: 44 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444" },
  time: { color: "#fff", fontWeight: "700", fontVariant: ["tabular-nums"] },
  hint: { color: "#94A3B8", fontSize: 12, flexShrink: 1 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: BRAND_GOLD, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.5 },
});
