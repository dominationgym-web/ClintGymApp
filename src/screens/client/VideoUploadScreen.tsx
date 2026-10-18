import React, { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator, TextInput } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { CoachMessage, Video } from "@/types/database";
import { useFormVideoUpload } from "@/components/useFormVideoUpload";

// Form videos (was the Video log tab, app-flow review C2, 2026-10-18): the
// client's videos and their coach's feedback, opened from Profile. Most videos
// are filmed straight from the set log ("🎥 Film this set"), which fills in the
// exercise; this page can still send one.
export default function VideoUploadScreen() {
  const { client } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  // Which exercise the video shows, so the coach knows what to look at (0081).
  const [exerciseName, setExerciseName] = useState("");
  // The coach's feedback on each video (0084).
  const [feedback, setFeedback] = useState<Record<string, CoachMessage[]>>({});

  const loadVideos = async () => {
    if (!client) return;
    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .eq("client_id", client.id)
      .is("deleted_at", null)
      .order("uploaded_at", { ascending: false });
    if (!error && data) {
      setVideos(data);
      const ids = data.map((v) => v.id);
      const { data: sent } = ids.length
        ? await supabase.from("coach_messages").select("*").in("video_id", ids).order("created_at", { ascending: true })
        : { data: [] as CoachMessage[] };
      const byVideo: Record<string, CoachMessage[]> = {};
      for (const m of sent ?? []) if (m.video_id) (byVideo[m.video_id] ??= []).push(m);
      setFeedback(byVideo);
    }
    setLoading(false);
  };

  const { uploading, record, pickFromLibrary } = useFormVideoUpload(client?.id, () => {
    setExerciseName("");
    loadVideos();
  });

  // Reload on each visit, so the coach's latest feedback shows.
  useFocusEffect(
    useCallback(() => {
      loadVideos();
    }, [client]),
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.helper}>
        Film a set straight from your workout: tap 🎥 Film this set in the set log. Or send one here. Keep videos to 60 seconds. They're automatically removed 7 days after upload, or when your plan ends - your trainer's notes on them stay.
      </Text>
      <Text style={styles.fieldLabel}>Which exercise is it?</Text>
      <TextInput
        style={styles.input}
        value={exerciseName}
        onChangeText={setExerciseName}
        placeholder="e.g. Barbell squat"
        placeholderTextColor="#64748B"
        maxLength={80}
      />
      <View style={styles.row}>
        <Pressable style={[styles.button, styles.flex1]} onPress={() => record(exerciseName)} disabled={uploading}>
          <Text style={styles.buttonText}>Record video</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.flex1]} onPress={() => pickFromLibrary(exerciseName)} disabled={uploading}>
          <Text style={styles.buttonText}>Choose from library</Text>
        </Pressable>
      </View>
      {uploading && <ActivityIndicator style={{ marginTop: 12 }} color="#22C55E" />}
      <FlatList
        style={{ marginTop: 20 }}
        data={videos}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <View style={styles.videoCard}>
            <View style={styles.videoRow}>
              <View style={styles.flex1}>
                <Text style={styles.label}>{item.exercise_name || "Form video"}</Text>
                <Text style={styles.expiry}>
                  {new Date(item.uploaded_at).toLocaleDateString()}
                  {item.viewed_at ? " · Coach watched ✓" : " · Sent to your coach"}
                </Text>
              </View>
              <Text style={styles.expiry}>expires {new Date(item.expires_at).toLocaleDateString()}</Text>
            </View>
            {(feedback[item.id] ?? []).map((m) => (
              <View key={m.id} style={styles.feedback}>
                <Text style={styles.feedbackTitle}>💬 Your coach's feedback</Text>
                <Text style={styles.feedbackText}>{m.body}</Text>
              </View>
            ))}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.helper}>No videos uploaded yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A", padding: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A" },
  title: { fontSize: 24, fontWeight: "700", color: "#fff", marginBottom: 8 },
  helper: { color: "#94A3B8", fontSize: 13, marginBottom: 16 },
  row: { flexDirection: "row", gap: 10 },
  flex1: { flex: 1 },
  button: { backgroundColor: "#22C55E", borderRadius: 10, padding: 14, alignItems: "center" },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 16 },
  videoCard: { backgroundColor: "#1E293B", padding: 12, borderRadius: 10, marginBottom: 8 },
  videoRow: { flexDirection: "row", justifyContent: "space-between" },
  feedback: { backgroundColor: "#0F172A", borderRadius: 8, padding: 10, marginTop: 8 },
  feedbackTitle: { color: "#22C55E", fontWeight: "700", fontSize: 13, marginBottom: 2 },
  feedbackText: { color: "#E2E8F0", fontSize: 14, lineHeight: 20 },
  label: { color: "#fff", fontWeight: "600" },
  fieldLabel: { color: "#CBD5E1", fontSize: 13, fontWeight: "600", marginBottom: 6 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 12 },
  expiry: { color: "#64748B", fontSize: 12 },
});
