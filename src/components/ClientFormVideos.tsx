import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import ReplyToClientModal from "@/components/ReplyToClientModal";
import type { Client, Video } from "@/types/database";

// The client's form videos on their Training tab (0081): newest first, new
// ones marked, tap to watch, then reply with feedback. Videos are removed 7
// days after upload, so only recent ones show.
export default function ClientFormVideos({ client, trainerId }: { client: Client; trainerId: string }) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [watching, setWatching] = useState<{ video: Video; url: string | null } | null>(null);
  const [replying, setReplying] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("videos")
      .select("*")
      .eq("client_id", client.id)
      .is("deleted_at", null)
      .order("uploaded_at", { ascending: false });
    setVideos(data ?? []);
  }, [client.id]);

  useEffect(() => {
    load();
  }, [load]);

  const watch = async (video: Video) => {
    setWatching({ video, url: null });
    const { data } = await supabase.storage.from("training-videos").createSignedUrl(video.storage_path, 60 * 60);
    setWatching({ video, url: data?.signedUrl ?? "" });
    if (!video.viewed_at) {
      await supabase.rpc("mark_video_viewed", { p_video: video.id });
      setVideos((prev) => prev.map((v) => (v.id === video.id ? { ...v, viewed_at: new Date().toISOString() } : v)));
    }
  };

  const fresh = videos.filter((v) => !v.viewed_at).length;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        🎥 Form videos{fresh > 0 ? ` · ${fresh} new` : ""}
      </Text>
      {videos.length === 0 ? (
        <Text style={styles.helper}>
          No videos in the last 7 days. {client.name.split(" ")[0]} can send one from their Video log tab, and you'll get a
          notification.
        </Text>
      ) : (
        videos.map((v) => (
          <Pressable key={v.id} style={styles.row} onPress={() => watch(v)} accessibilityRole="button">
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{v.exercise_name || "Form video"}</Text>
              <Text style={styles.helper}>
                {new Date(v.uploaded_at).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
            {!v.viewed_at && <Text style={styles.newBadge}>NEW</Text>}
            <Text style={styles.watch}>▶ Watch</Text>
          </Pressable>
        ))
      )}

      <Modal visible={!!watching} animationType="slide" onRequestClose={() => setWatching(null)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{watching?.video.exercise_name || "Form video"}</Text>
              <Text style={styles.helper}>{client.name}</Text>
            </View>
            <Pressable onPress={() => setWatching(null)} hitSlop={10}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
          {watching?.url === null ? (
            <ActivityIndicator color={BRAND_GOLD} style={{ marginTop: 40 }} />
          ) : watching?.url ? (
            <Player url={watching.url} />
          ) : (
            <Text style={[styles.helper, { padding: 20 }]}>This video couldn't be loaded. It may have expired.</Text>
          )}
          <Pressable style={styles.replyButton} onPress={() => setReplying(true)}>
            <Text style={styles.replyText}>💬 Send {client.name.split(" ")[0]} feedback</Text>
          </Pressable>
        </SafeAreaView>
        {replying && (
          <ReplyToClientModal client={client} trainerId={trainerId} onClose={() => setReplying(false)} />
        )}
      </Modal>
    </View>
  );
}

function Player({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.play();
  });
  return <VideoView style={styles.video} player={player} contentFit="contain" nativeControls />;
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginTop: 12 },
  title: { color: "#fff", fontSize: 16, fontWeight: "800", marginBottom: 6 },
  helper: { color: "#94A3B8", fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#0F172A", borderRadius: 10, padding: 12, marginTop: 8 },
  name: { color: "#fff", fontWeight: "700" },
  newBadge: { color: "#0F172A", backgroundColor: BRAND_GOLD, fontWeight: "800", fontSize: 11, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: "hidden" },
  watch: { color: BRAND_GOLD, fontWeight: "800" },
  modal: { flex: 1, backgroundColor: "#0F172A" },
  header: { flexDirection: "row", alignItems: "flex-start", padding: 20 },
  modalTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  close: { color: BRAND_GOLD, fontSize: 16, fontWeight: "600" },
  video: { flex: 1, backgroundColor: "#000" },
  replyButton: { backgroundColor: BRAND_GOLD, margin: 20, borderRadius: 10, padding: 14, alignItems: "center" },
  replyText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
});
