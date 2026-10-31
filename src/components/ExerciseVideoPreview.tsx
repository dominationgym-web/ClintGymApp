import React, { useEffect } from "react";
import { Text } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import WatchOnlineLink from "@/components/WatchOnlineLink";
import YouTubeCard from "@/components/YouTubeCard";
import { playableClip } from "@/lib/watchOnline";
import { themedStyles } from "@/lib/theme";

// A small looping demo video, for the trainer to check an exercise before
// putting it in a program. Mounted only while it's open, so one plays at a time.
// With no clip, name gives a link to examples online instead. A YouTube
// exercise (0171) shows the video's picture, which opens YouTube.
export default function ExerciseVideoPreview({ url, name }: { url: string | null; name?: string }) {
  const clip = playableClip(url);
  const player = useVideoPlayer(clip, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    if (clip) player.play();
  }, [clip, player]);

  if (url && !clip) return <YouTubeCard url={url} />;
  if (!url && name) return <WatchOnlineLink name={name} />;
  if (!url) return <Text style={styles.none}>No demo video for this one yet.</Text>;
  return <VideoView style={styles.video} player={player} contentFit="contain" nativeControls />;
}

const styles = themedStyles({
  video: { width: "100%", height: 200, backgroundColor: "#000", borderRadius: 8, marginTop: 10 },
  none: { color: "#64748B", fontSize: 13, marginTop: 8 },
});
