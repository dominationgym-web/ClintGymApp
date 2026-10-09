import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { parseIsoDate, todayIso } from "@/lib/dates";
import { avatarContentType } from "@/lib/avatars";
import {
  ANGLE_LABEL,
  PROGRESS_ANGLES,
  PROGRESS_BUCKET,
  groupIntoSets,
  isCompleteSet,
  openSetDate,
  progressPhotoPath,
  progressPhotoStatus,
  type ProgressPhotoAngle,
} from "@/lib/progressPhotos";
import ProgressHistory from "@/components/ProgressHistory";
import { loadProgressPhotos, type LoadedProgressPhoto } from "@/components/progressPhotoData";

// Shown on screen and again before each photo, so every set is taken the same
// way and the comparison is honest.
const PHOTO_GUIDELINES = [
  "Full body, from your feet to the top of your head",
  "Three photos each time: front, side and back",
  "Same place every time",
  "Same lighting",
  "Same time of day",
  "Same outfit",
];

// The client's own progress photos, on their Profile tab. Optional, and
// private to the client unless they switch on sharing with their trainer.
export default function ProgressPhotosSection() {
  const { client, refreshProfile } = useAuth();
  const [photos, setPhotos] = useState<LoadedProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingAngle, setUploadingAngle] = useState<ProgressPhotoAngle | null>(null);
  const [savingShare, setSavingShare] = useState(false);
  // Lets a client start a new set before the 6 weeks are up.
  const [startEarly, setStartEarly] = useState(false);

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

  const today = todayIso();
  const sets = groupIntoSets(photos);
  const latestSet = sets[sets.length - 1];
  const status = progressPhotoStatus(latestSet?.takenOn ?? null, today);
  const setDate = openSetDate(sets, today);
  const openSet = sets.find((s) => s.takenOn === setDate) ?? { takenOn: setDate, byAngle: {} };
  const doneCount = PROGRESS_ANGLES.filter((a) => openSet.byAngle[a]).length;
  // Show the three slots when a set is due, half done, or being retaken today.
  const showSlots =
    startEarly || status.kind !== "not_due" || !isCompleteSet(openSet) || openSet.takenOn === today;
  const isBeforeSet = sets.length === 0 || (sets.length === 1 && openSet.takenOn === sets[0].takenOn);

  const upload = async (angle: ProgressPhotoAngle, asset: ImagePicker.ImagePickerAsset) => {
    setUploadingAngle(angle);
    try {
      const body = await new File(asset.uri).arrayBuffer();
      const path = progressPhotoPath(client.id, angle, asset.mimeType);
      const { error: uploadError } = await supabase.storage
        .from(PROGRESS_BUCKET)
        .upload(path, body, { contentType: avatarContentType(asset.mimeType) });
      if (uploadError) throw uploadError;

      // Retaking an angle replaces the old photo in this set.
      const previous = openSet.byAngle[angle];
      if (previous) {
        const { error: deleteError } = await supabase.from("progress_photos").delete().eq("id", previous.id);
        if (deleteError) {
          await supabase.storage.from(PROGRESS_BUCKET).remove([path]);
          throw deleteError;
        }
      }
      const { error: insertError } = await supabase
        .from("progress_photos")
        .insert({ client_id: client.id, storage_path: path, taken_on: openSet.takenOn, angle });
      if (insertError) {
        await supabase.storage.from(PROGRESS_BUCKET).remove([path]);
        throw insertError;
      }
      if (previous) await supabase.storage.from(PROGRESS_BUCKET).remove([previous.path]);
      setStartEarly(false);
      await load();
    } catch (err) {
      Alert.alert("Couldn't save photo", err instanceof Error ? err.message : "Please try again.");
      await load();
    } finally {
      setUploadingAngle(null);
    }
  };

  const pick = async (angle: ProgressPhotoAngle, source: "camera" | "library") => {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", source === "camera" ? "Allow camera access to take a photo." : "Allow photo access to choose a photo.");
      return;
    }
    // No cropping: the whole body has to stay in the picture.
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.6 };
    const result =
      source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets?.[0]) return;
    await upload(angle, result.assets[0]);
  };

  const addPhoto = (angle: ProgressPhotoAngle) => {
    const label = ANGLE_LABEL[angle].toLowerCase();
    Alert.alert(
      openSet.byAngle[angle] ? `Retake your ${label} photo` : `Your ${label} photo`,
      `Full body, from your feet to the top of your head, facing ${angle === "front" ? "the camera" : angle === "side" ? "sideways" : "away from the camera"}. ` +
        "Use the same place, lighting, time of day and outfit every time. A timer or a friend helps.\n\n" +
        "Only you can see this photo unless you share with your trainer.",
      [
        { text: "Take photo", onPress: () => pick(angle, "camera") },
        { text: "Choose from gallery", onPress: () => pick(angle, "library") },
        { text: "Cancel", style: "cancel" },
      ]
    );
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

  // Turning sharing on must be a deliberate choice, so it asks first.
  // Turning it off is one tap, no questions.
  const onToggleSharing = (shared: boolean) => {
    if (!shared) {
      setSharing(false);
      return;
    }
    Alert.alert(
      "Share your progress photos?",
      "Your trainer will be able to see all your progress photos, including ones you add later. You can turn this off at any time.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Yes, share them", onPress: () => setSharing(true) },
      ]
    );
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
        Optional. Take a before set, then a new set every 6 weeks to see how far you've come.
      </Text>
      <Text style={[styles.body, styles.privateNote]}>
        🔒 These photos are private and for your own use. Your trainer can't see them unless you choose to share them
        below.
      </Text>

      <View style={styles.guideBox}>
        <Text style={styles.guideTitle}>For a true picture of your progress, every set should be:</Text>
        {PHOTO_GUIDELINES.map((g) => (
          <Text key={g} style={styles.guideItem}>
            • {g}
          </Text>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#22C55E" style={{ marginVertical: 12 }} />
      ) : (
        <>
          {status.kind === "due" && (
            <View style={styles.dueBanner}>
              <Text style={styles.dueText}>📸 It's time for your 6-week progress set.</Text>
            </View>
          )}

          {showSlots ? (
            <View style={styles.setCard}>
              <Text style={styles.setTitle}>
                {isBeforeSet ? "Your before set" : `Progress set · ${parseIsoDate(openSet.takenOn).toLocaleDateString()}`}
              </Text>
              <Text style={styles.helper}>
                {doneCount === 3 ? "All 3 done. Tap one to retake it." : `${doneCount} of 3 done. Tap a box to add that photo.`}
              </Text>
              <View style={styles.slots}>
                {PROGRESS_ANGLES.map((angle) => {
                  const photo = openSet.byAngle[angle];
                  return (
                    <Pressable
                      key={angle}
                      style={styles.slot}
                      onPress={() => addPhoto(angle)}
                      disabled={uploadingAngle !== null}
                    >
                      {uploadingAngle === angle ? (
                        <View style={[styles.slotBox, styles.slotEmpty]}>
                          <ActivityIndicator color="#22C55E" />
                        </View>
                      ) : photo?.url ? (
                        <Image source={{ uri: photo.url }} style={styles.slotBox} />
                      ) : (
                        <View style={[styles.slotBox, styles.slotEmpty]}>
                          <Text style={styles.slotPlus}>+</Text>
                        </View>
                      )}
                      <Text style={styles.slotLabel}>
                        {photo ? "✓ " : ""}
                        {ANGLE_LABEL[angle]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            status.kind === "not_due" && (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.helper}>
                  Next progress set in {status.daysLeft} day{status.daysLeft === 1 ? "" : "s"}.
                </Text>
                <Pressable onPress={() => setStartEarly(true)}>
                  <Text style={styles.link}>Take a new set now</Text>
                </Pressable>
              </View>
            )
          )}

          {photos.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.subheading}>Your progress history</Text>
              <ProgressHistory photos={photos} onLongPress={confirmDelete} />
              <Text style={styles.helper}>
                Tap a photo to see it big. Press and hold to delete it. Every photo stays here for as long as you have
                an account; deleting your account removes them all.
              </Text>
            </View>
          )}
        </>
      )}

      <View style={styles.shareRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.shareLabel}>Share with my trainer</Text>
          <Text style={styles.helper}>
            {client.progress_photos_shared
              ? "On: your trainer can see your progress photos. Turn this off at any time and all of them, including ones they've already seen, become private to you again."
              : "Off: only you can see your progress photos. Your trainer only gets access if you turn this on."}
          </Text>
        </View>
        <Switch
          value={client.progress_photos_shared}
          onValueChange={onToggleSharing}
          disabled={savingShare}
          trackColor={{ true: "#22C55E", false: "#334155" }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { color: "#94A3B8", fontWeight: "600", marginTop: 16, marginBottom: 6 },
  subheading: { color: "#E2E8F0", fontWeight: "600", marginBottom: 8 },
  body: { color: "#E2E8F0", fontSize: 14, lineHeight: 20 },
  privateNote: { marginTop: 8 },
  helper: { color: "#64748B", fontSize: 12, marginTop: 6 },
  link: { color: "#22C55E", fontWeight: "600", marginTop: 8 },
  guideBox: { backgroundColor: "#1E293B", borderRadius: 8, padding: 12, marginTop: 10 },
  guideTitle: { color: "#E2E8F0", fontWeight: "600", marginBottom: 4 },
  guideItem: { color: "#CBD5E1", fontSize: 14, lineHeight: 22 },
  dueBanner: { backgroundColor: "#1E293B", borderLeftWidth: 4, borderLeftColor: "#22C55E", borderRadius: 8, padding: 12, marginTop: 10 },
  dueText: { color: "#E2E8F0", fontWeight: "600" },
  setCard: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginTop: 12 },
  setTitle: { color: "#fff", fontWeight: "700" },
  slots: { flexDirection: "row", gap: 10, marginTop: 10 },
  slot: { flex: 1, alignItems: "center" },
  slotBox: { width: "100%", aspectRatio: 3 / 4, borderRadius: 8, backgroundColor: "#0F172A" },
  slotEmpty: { borderWidth: 2, borderStyle: "dashed", borderColor: "#334155", alignItems: "center", justifyContent: "center" },
  slotPlus: { color: "#64748B", fontSize: 28 },
  slotLabel: { color: "#E2E8F0", fontWeight: "600", marginTop: 6 },
  shareRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 },
  shareLabel: { color: "#E2E8F0", fontWeight: "600" },
});
