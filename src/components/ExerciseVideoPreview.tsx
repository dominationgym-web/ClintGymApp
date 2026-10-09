import React, { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";

// A small looping demo video, for the trainer to check an exercise before
// putting it in a program. Mounted only while it's open, so one plays at a time.
export default function ExerciseVideoPreview({ url }: { url: string | null }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    if (url) player.play();
  }, [url, player]);

  if (!url) return <Text style={styles.none}>No demo video for this one yet.</Text>;
  return <VideoView style={styles.video} player={player} contentFit="contain" nativeControls />;
}

const styles = StyleSheet.create({
  video: { width: "100%", height: 200, backgroundColor: "#000", borderRadius: 8, marginTop: 10 },
  none: { color: "#64748B", fontSize: 13, marginTop: 8 },
});
