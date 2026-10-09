import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Video } from "@/types/database";
import { MAX_VIDEO_SECONDS, videoProblem } from "@/lib/videoLimits";

// 720p is plenty to check form and about half the size of full HD (iOS only;
// Android records at the camera app's own quality).
const VIDEO_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["videos"],
  quality: 0.7,
  videoMaxDuration: MAX_VIDEO_SECONDS,
  videoQuality: ImagePicker.UIImagePickerControllerQualityType.IFrame1280x720,
};

export default function VideoUploadScreen() {
  const { client } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const loadVideos = async () => {
    if (!client) return;
    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .eq("client_id", client.id)
      .is("deleted_at", null)
      .order("uploaded_at", { ascending: false });
    if (!error && data) setVideos(data);
    setLoading(false);
  };

  useEffect(() => {
    loadVideos();
  }, [client]);

  const uploadAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!client) return;
    const problem = videoProblem(asset.duration, asset.fileSize);
    if (problem) {
      Alert.alert("Can't upload this video", problem);
      return;
    }
    setUploading(true);
    try {
      const body = await new File(asset.uri).arrayBuffer();
      const fileExt = asset.uri.split(".").pop() ?? "mp4";
      const storagePath = `${client.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("training-videos")
        .upload(storagePath, body, { contentType: asset.mimeType ?? `video/${fileExt}` });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("videos").insert({
        client_id: client.id,
        storage_provider: "supabase",
        storage_path: storagePath,
      });
      if (insertError) throw insertError;

      await loadVideos();
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setUploading(false);
    }
  };

  const handleRecord = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow camera access to record training proof.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync(VIDEO_OPTIONS);
    if (result.canceled || !result.assets?.[0]) return;
    await uploadAsset(result.assets[0]);
  };

  const handlePickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow access to your video library to upload training proof.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync(VIDEO_OPTIONS);
    if (result.canceled || !result.assets?.[0]) return;
    await uploadAsset(result.assets[0]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Training proof</Text>
      <Text style={styles.helper}>
        Keep videos to 60 seconds. They're automatically removed 7 days after upload, or when your plan ends - your trainer's notes on them stay.
      </Text>
      <View style={styles.row}>
        <Pressable style={[styles.button, styles.flex1]} onPress={handleRecord} disabled={uploading}>
          <Text style={styles.buttonText}>Record video</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.flex1]} onPress={handlePickFromLibrary} disabled={uploading}>
          <Text style={styles.buttonText}>Choose from library</Text>
        </Pressable>
      </View>
      {uploading && <ActivityIndicator style={{ marginTop: 12 }} color="#22C55E" />}
      <FlatList
        style={{ marginTop: 20 }}
        data={videos}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <View style={styles.videoRow}>
            <Text style={styles.label}>{new Date(item.uploaded_at).toLocaleDateString()}</Text>
            <Text style={styles.expiry}>expires {new Date(item.expires_at).toLocaleDateString()}</Text>
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
  videoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#1E293B",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  label: { color: "#fff" },
  expiry: { color: "#64748B", fontSize: 12 },
});
