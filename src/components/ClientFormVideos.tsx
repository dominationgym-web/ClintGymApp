import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import TextInput from "@/components/TextInput";
import ModalSafeArea from "./ModalSafeArea";
import { useVideoPlayer, VideoView } from "expo-video";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { cleanMessage, MAX_MESSAGE_LENGTH } from "@/lib/coachMessages";
import KeyboardSafe from "@/components/KeyboardSafe";
import type { Client, CoachMessage, Video } from "@/types/database";

// The client's form videos on their Training tab (0081): newest first, new
// ones marked, tap to watch. The feedback box sits under the playing video,
// so the trainer can watch it again while writing, and the message is linked
// to that video (0084). Videos are removed 7 days after upload, so only
// recent ones show.
export default function ClientFormVideos({ client, trainerId }: { client: Client; trainerId: string }) {
  const [videos, setVideos] = useState<Video[]>([]);
  // Feedback already sent, by video.
  const [feedback, setFeedback] = useState<Record<string, CoachMessage[]>>({});
  const [watching, setWatching] = useState<{ video: Video; url: string | null } | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("videos")
      .select("*")
      .eq("client_id", client.id)
      .is("deleted_at", null)
      .order("uploaded_at", { ascending: false });
    setVideos(data ?? []);
    const ids = (data ?? []).map((v) => v.id);
    if (ids.length === 0) return setFeedback({});
    const { data: sent } = await supabase
      .from("coach_messages")
      .select("*")
      .in("video_id", ids)
      .order("created_at", { ascending: true });
    const byVideo: Record<string, CoachMessage[]> = {};
    for (const m of sent ?? []) if (m.video_id) (byVideo[m.video_id] ??= []).push(m);
    setFeedback(byVideo);
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
          No videos in the last 7 days. {client.name.split(" ")[0]} can film one from their set log (🎥 Film this set), and you'll get a
          notification.
        </Text>
      ) : (
        videos.map((v) => (
          <Pressable key={v.id} style={styles.row} onPress={() => watch(v)} accessibilityRole="button">
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{v.exercise_name || "Form video"}</Text>
              <Text style={styles.helper}>
                {new Date(v.uploaded_at).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                {feedback[v.id]?.length ? " · Feedback sent ✓" : ""}
              </Text>
            </View>
            {!v.viewed_at && <Text style={styles.newBadge}>NEW</Text>}
            <Text style={styles.watch}>▶ Watch</Text>
          </Pressable>
        ))
      )}

      {watching && (
        <WatchAndCorrect
          key={watching.video.id}
          client={client}
          trainerId={trainerId}
          video={watching.video}
          url={watching.url}
          sent={feedback[watching.video.id] ?? []}
          onSent={(m) => setFeedback((prev) => ({ ...prev, [watching.video.id]: [...(prev[watching.video.id] ?? []), m] }))}
          onClose={() => setWatching(null)}
        />
      )}
    </View>
  );
}

// The video on top with Watch again, and the correction box under it.
// Closing without sending asks first, so feedback isn't lost or forgotten.
function WatchAndCorrect({
  client,
  trainerId,
  video,
  url,
  sent,
  onSent,
  onClose,
}: {
  client: Client;
  trainerId: string;
  video: Video;
  url: string | null;
  sent: CoachMessage[];
  onSent: (m: CoachMessage) => void;
  onClose: () => void;
}) {
  const firstName = client.name.split(" ")[0];
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const message = cleanMessage(body);
  const exercise = video.exercise_name || "form video";

  const send = async (closeAfter = false) => {
    if (!message) return;
    setSending(true);
    const { data, error } = await supabase
      .from("coach_messages")
      .insert({ client_id: client.id, trainer_id: trainerId, body: message, video_id: video.id })
      .select()
      .single();
    setSending(false);
    if (error || !data) {
      Alert.alert("Couldn't send", error?.message ?? "Please try again.");
      return;
    }
    onSent(data);
    setBody("");
    if (closeAfter) onClose();
  };

  const tryClose = () => {
    if (message) {
      Alert.alert("Send your feedback?", `You've written feedback for ${firstName} that hasn't been sent.`, [
        { text: "Keep editing", style: "cancel" },
        { text: "Close without sending", style: "destructive", onPress: onClose },
        { text: "Send", onPress: () => send(true) },
      ]);
      return;
    }
    if (sent.length === 0) {
      Alert.alert(`Correct ${firstName}'s form?`, `You haven't sent ${firstName} any feedback on this video yet.`, [
        { text: "Write feedback", style: "cancel" },
        { text: "Close", onPress: onClose },
      ]);
      return;
    }
    onClose();
  };

  return (
    <Modal visible animationType="slide" onRequestClose={tryClose}>
      <KeyboardSafe>
        <ModalSafeArea style={styles.modal}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{video.exercise_name || "Form video"}</Text>
              <Text style={styles.helper}>{client.name}</Text>
            </View>
            <Pressable onPress={tryClose} hitSlop={10}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
          {url === null ? (
            <View style={styles.video}>
              <ActivityIndicator color={BRAND_GOLD} style={{ marginTop: 40 }} />
            </View>
          ) : url ? (
            <Player url={url} />
          ) : (
            <Text style={[styles.helper, styles.video, { padding: 20 }]}>This video couldn't be loaded. It may have expired.</Text>
          )}
          <View style={styles.form}>
            {sent.length > 0 && (
              <ScrollView style={styles.sentList}>
                {sent.map((m) => (
                  <Text key={m.id} style={styles.sentText}>
                    ✓ Sent: {m.body}
                  </Text>
                ))}
              </ScrollView>
            )}
            <Text style={styles.formLabel}>Correct {firstName}'s {exercise.toLowerCase()}</Text>
            <TextInput
              style={styles.input}
              multiline
              placeholder="e.g. Keep your chest up and push your knees out on the way down."
              placeholderTextColor="#64748B"
              maxLength={MAX_MESSAGE_LENGTH}
              value={body}
              onChangeText={setBody}
            />
            <Pressable
              style={[styles.replyButton, !message && { opacity: 0.5 }]}
              onPress={() => send()}
              disabled={!message || sending}
            >
              {sending ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.replyText}>💬 Send to {firstName}</Text>}
            </Pressable>
          </View>
        </ModalSafeArea>
      </KeyboardSafe>
    </Modal>
  );
}

function Player({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.play();
  });
  const again = () => {
    player.currentTime = 0;
    player.play();
  };
  return (
    <View style={{ flex: 1 }}>
      <VideoView style={styles.video} player={player} contentFit="contain" nativeControls />
      <Pressable onPress={again} hitSlop={8} style={styles.againButton} accessibilityRole="button">
        <Text style={styles.againText}>↺ Watch again</Text>
      </Pressable>
    </View>
  );
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
  header: { flexDirection: "row", alignItems: "flex-start", padding: 20, paddingBottom: 12 },
  modalTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  close: { color: BRAND_GOLD, fontSize: 16, fontWeight: "600" },
  video: { flex: 1, backgroundColor: "#000" },
  againButton: { alignSelf: "center", paddingVertical: 8 },
  againText: { color: BRAND_GOLD, fontWeight: "800", fontSize: 15 },
  form: { paddingHorizontal: 20, paddingBottom: 16 },
  sentList: { maxHeight: 80, marginBottom: 8 },
  sentText: { color: "#22C55E", fontSize: 13, marginBottom: 4 },
  formLabel: { color: "#CBD5E1", fontSize: 13, fontWeight: "700", marginBottom: 6 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 8, padding: 12, fontSize: 15, minHeight: 70, maxHeight: 120, textAlignVertical: "top" },
  replyButton: { backgroundColor: BRAND_GOLD, marginTop: 10, borderRadius: 10, padding: 14, alignItems: "center" },
  replyText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
});
