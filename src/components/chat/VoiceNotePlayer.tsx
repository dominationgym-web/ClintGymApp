import React, { useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { BRAND_GOLD } from "@/lib/brand";
import { formatDuration } from "@/lib/chat";
import type { VoiceNotePlayerProps } from "@/lib/voiceNotes";

// Only ever loaded through loadVoiceNotePlayer() (src/lib/voiceNotes.ts).
// Play and pause, with how far it has played. Plays through the speaker even
// with the phone on silent, since the person tapped play on purpose.
export default function VoiceNotePlayer({ url, durationMs, mine }: VoiceNotePlayerProps) {
  const player = useAudioPlayer(url ? { uri: url } : null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);

  // Back to the start once it has played through, ready to play again.
  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      player.seekTo(0).catch(() => undefined);
    }
  }, [status.didJustFinish, player]);

  const toggle = async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
    player.play();
  };

  const total = durationMs ?? (status.duration ? status.duration * 1000 : 0);
  const played = status.currentTime * 1000;
  const progress = total > 0 ? Math.min(1, played / total) : 0;
  const colour = mine ? "#0F172A" : BRAND_GOLD;

  return (
    <View style={styles.row}>
      <Pressable onPress={toggle} disabled={!url} style={styles.play} accessibilityLabel={status.playing ? "Pause" : "Play voice note"}>
        {!url || (status.isBuffering && status.playing) ? (
          <ActivityIndicator color={colour} />
        ) : (
          <Ionicons name={status.playing ? "pause" : "play"} size={24} color={colour} />
        )}
      </Pressable>
      <View style={styles.middle}>
        <View style={[styles.track, mine && styles.trackMine]}>
          <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: colour }]} />
        </View>
        <Text style={[styles.time, mine && styles.timeMine]}>
          {status.playing || played > 0 ? formatDuration(played) : formatDuration(total)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 190 },
  play: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  middle: { flex: 1, gap: 4 },
  track: { height: 4, borderRadius: 2, backgroundColor: "#334155", overflow: "hidden" },
  trackMine: { backgroundColor: "rgba(15,23,42,0.25)" },
  fill: { height: 4 },
  time: { color: "#94A3B8", fontSize: 11 },
  timeMine: { color: "#1E293B" },
});
