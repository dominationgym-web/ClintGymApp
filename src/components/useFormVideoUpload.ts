import { useState } from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { supabase } from "@/lib/supabase";
import { videoProblem, MAX_VIDEO_SECONDS } from "@/lib/videoLimits";

// 720p is plenty to check form and about half the size of full HD (iOS only;
// Android records at the camera app's own quality).
const VIDEO_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["videos"],
  quality: 0.7,
  videoMaxDuration: MAX_VIDEO_SECONDS,
  videoQuality: ImagePicker.UIImagePickerControllerQualityType.IFrame1280x720,
};

/**
 * Filming a form video for the coach: record or pick one, then it uploads and
 * the coach is told. Used by the Form videos
 * page and by "🎥 Film this set" in the set log (app-flow review C2,
 * 2026-10-18), which fills in the exercise name.
 */
export function useFormVideoUpload(clientId: string | undefined, onUploaded?: () => void) {
  const [uploading, setUploading] = useState(false);

  const upload = async (asset: ImagePicker.ImagePickerAsset, exerciseName: string | null) => {
    if (!clientId) return;
    const problem = videoProblem(asset.duration, asset.fileSize);
    if (problem) {
      Alert.alert("Can't upload this video", problem);
      return;
    }
    setUploading(true);
    try {
      const body = await new File(asset.uri).arrayBuffer();
      const fileExt = asset.uri.split(".").pop() ?? "mp4";
      const storagePath = `${clientId}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("training-videos")
        .upload(storagePath, body, { contentType: asset.mimeType ?? `video/${fileExt}` });
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from("videos").insert({
        client_id: clientId,
        storage_provider: "supabase",
        storage_path: storagePath,
        exercise_name: exerciseName?.trim() || null,
      });
      if (insertError) throw insertError;
      Alert.alert("Sent to your coach ✅", "Your coach has been told and will watch it. Their feedback shows under Profile → Form videos.");
      onUploaded?.();
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setUploading(false);
    }
  };

  const record = async (exerciseName: string | null) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow camera access to film your set.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync(VIDEO_OPTIONS);
    if (result.canceled || !result.assets?.[0]) return;
    await upload(result.assets[0], exerciseName);
  };

  const pickFromLibrary = async (exerciseName: string | null) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow access to your videos to send one to your coach.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync(VIDEO_OPTIONS);
    if (result.canceled || !result.assets?.[0]) return;
    await upload(result.assets[0], exerciseName);
  };

  /** Asks Film it now / Choose a video, for the set log's button. */
  const filmOrPick = (exerciseName: string) =>
    Alert.alert(`Film ${exerciseName} for your coach`, "Up to 60 seconds. Your coach is told straight away.", [
      { text: "Film it now", onPress: () => record(exerciseName) },
      { text: "Choose a video", onPress: () => pickFromLibrary(exerciseName) },
      { text: "Cancel", style: "cancel" },
    ]);

  return { uploading, record, pickFromLibrary, filmOrPick };
}
