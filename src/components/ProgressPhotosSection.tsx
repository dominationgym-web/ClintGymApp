import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { todayIso } from "@/lib/dates";
import { avatarContentType } from "@/lib/avatars";
import { PROGRESS_BUCKET, progressPhotoPath, progressPhotoStatus } from "@/lib/progressPhotos";
import PhotoStrip, { type StripPhoto } from "@/components/PhotoStrip";
import { loadProgressPhotos } from "@/components/progressPhotoData";

// The client's own progress photos, on their Profile tab. Private unless they
// switch on sharing with their trainer.
export default function ProgressPhotosSection() {
  const { client, refreshProfile } = useAuth();
  const [photos, setPhotos] = useState<(StripPhoto & { path: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingShare, setSavingShare] = useState(false);

  const load = useCallback(async () => {
    if (!client) return;
    setPhotos(await loadProgressPhotos(client.id));
    setLoading(false);
  }, [client?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!client) return null;

  const latest = photos.length > 0 ? photos[photos.length - 1].takenOn : null;
  const status = progressPhotoStatus(latest, todayIso());

  const upload = async (asset: ImagePicker.ImagePickerAsset) => {
    setUploading(true);
    try {
      const body = await new File(asset.uri).arrayBuffer();
      const path = progressPhotoPath(client.id, asset.mimeType);
      const { error: uploadError } = await supabase.storage
        .from(PROGRESS_BUCKET)
        .upload(path, body, { contentType: avatarContentType(asset.mimeType) });
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase
        .from("progress_photos")
        .insert({ client_id: client.id, storage_path: path, taken_on: todayIso() });
      if (insertError) {
        await supabase.storage.from(PROGRESS_BUCKET).remove([path]);
        throw insertError;
      }
      await load();
    } catch (err) {
      Alert.alert("Couldn't save photo", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const pick = async (source: "camera" | "library") => {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", source === "camera" ? "Allow camera access to take a photo." : "Allow photo access to choose a photo.");
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [3, 4], quality: 0.6 };
    const result =
      source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets?.[0]) return;
    await upload(result.assets[0]);
  };

  const addPhoto = () => {
    Alert.alert(status.kind === "before" ? "Add your before photo" : "Add a progress photo", "Only you can see it unless you share with your trainer.", [
      { text: "Take photo", onPress: () => pick("camera") },
      { text: "Choose from gallery", onPress: () => pick("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const confirmDelete = (id: string) => {
    const photo = photos.find((p) => p.id === id);
    if (!photo) return;
    Alert.alert("Delete this photo?", "It will be removed for good.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("progress_photos").delete().eq("id", id);
          if (error) {
            Alert.alert("Couldn't delete", error.message);
            return;
          }
          await supabase.storage.from(PROGRESS_BUCKET).remove([photo.path]);
          await load();
        },
      },
    ]);
  };

  const setSharing = async (shared: boolean) => {
    setSavingShare(true);
    const { error } = await supabase.from("clients").update({ progress_photos_shared: shared }).eq("id", client.id);
    if (error) Alert.alert("Couldn't update", error.message);
    await refreshProfile();
    setSavingShare(false);
  };

  return (
    <View>
      <Text style={styles.heading}>Progress photos</Text>
      <Text style={styles.body}>
        Take a before photo, then a new one every 6 weeks to see how far you've come. These are private to you.
      </Text>

      {!loading && status.kind !== "not_due" && (
        <View style={styles.dueBanner}>
          <Text style={styles.dueText}>
            {status.kind === "before" ? "📸 Start with your before photo." : "📸 It's time for your 6-week progress photo."}
          </Text>
        </View>
      )}
      {!loading && status.kind === "not_due" && (
        <Text style={styles.helper}>Next progress photo in {status.daysLeft} day{status.daysLeft === 1 ? "" : "s"}.</Text>
      )}

      {loading ? (
        <ActivityIndicator color="#22C55E" style={{ marginVertical: 12 }} />
      ) : (
        photos.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <PhotoStrip photos={photos} onLongPress={confirmDelete} />
            <Text style={styles.helper}>Tap a photo to see it big. Press and hold to delete it.</Text>
          </View>
        )
      )}

      <Pressable style={styles.button} onPress={addPhoto} disabled={uploading}>
        {uploading ? (
          <ActivityIndicator color="#0F172A" />
        ) : (
          <Text style={styles.buttonText}>{status.kind === "before" ? "Add before photo" : "Add progress photo"}</Text>
        )}
      </Pressable>

      <View style={styles.shareRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.shareLabel}>Share with my trainer</Text>
          <Text style={styles.helper}>
            {client.progress_photos_shared
              ? "Your trainer can see these photos. Turn this off at any time to make them private again."
              : "Off: only you can see these photos."}
          </Text>
        </View>
        <Switch
          value={client.progress_photos_shared}
          onValueChange={setSharing}
          disabled={savingShare}
          trackColor={{ true: "#22C55E", false: "#334155" }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { color: "#94A3B8", fontWeight: "600", marginTop: 16, marginBottom: 6 },
  body: { color: "#E2E8F0", fontSize: 14, lineHeight: 20 },
  helper: { color: "#64748B", fontSize: 12, marginTop: 6 },
  dueBanner: { backgroundColor: "#1E293B", borderLeftWidth: 4, borderLeftColor: "#22C55E", borderRadius: 8, padding: 12, marginTop: 10 },
  dueText: { color: "#E2E8F0", fontWeight: "600" },
  button: { backgroundColor: "#22C55E", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 14 },
  buttonText: { color: "#0F172A", fontWeight: "700" },
  shareRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 },
  shareLabel: { color: "#E2E8F0", fontWeight: "600" },
});
