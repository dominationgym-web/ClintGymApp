// Trainer of the Half-Year (0194): the face photo, proof videos and the
// once-a-day "opened the app on this phone" record. Nothing here runs while
// the award is switched off (the database ignores app opens then too).

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { supabase } from "@/lib/supabase";
import { avatarContentType, imageExtension } from "@/lib/avatars";
import { AWARD_FACES_BUCKET, AWARD_PROOFS_BUCKET, videoExtension, type GoalDirection } from "@/lib/award";
import { videoProblem, MAX_VIDEO_SECONDS } from "@/lib/videoLimits";

const DEVICE_KEY = "award-device-id";

/** A random id for this install of the app, kept on the phone. Not the phone's serial number. */
async function deviceId(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(DEVICE_KEY);
    if (saved) return saved;
  } catch {
    // Carry on with a fresh id.
  }
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  AsyncStorage.setItem(DEVICE_KEY, id).catch(() => undefined);
  return id;
}

/** Once per app start for a signed-in person: which phone, which day. */
export async function recordAppOpen(): Promise<void> {
  try {
    await supabase.rpc("record_app_open", { p_device: await deviceId(), p_platform: Platform.OS });
  } catch {
    // Never in the way of opening the app.
  }
}

/** Takes a face photo with the front camera, or picks one. Square and small. */
export async function pickFacePhoto(useCamera: boolean): Promise<ImagePicker.ImagePickerAsset | null> {
  const permission = useCamera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.6,
    cameraType: ImagePicker.CameraType.front,
  };
  const result = useCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0];
}

/** Uploads the face photo and saves it with the goal and the consent. */
export async function saveAwardProfile(
  clientId: string,
  photo: ImagePicker.ImagePickerAsset | null,
  goal: GoalDirection | null
): Promise<void> {
  let path: string | null = null;
  if (photo) {
    path = `${clientId}/face-${Date.now()}.${imageExtension(photo.mimeType)}`;
    const body = await new File(photo.uri).arrayBuffer();
    const { error } = await supabase.storage
      .from(AWARD_FACES_BUCKET)
      .upload(path, body, { contentType: avatarContentType(photo.mimeType) });
    if (error) throw error;
  }
  const { error } = await supabase.rpc("set_award_profile", { p_face_path: path, p_goal: goal, p_consent: !!photo });
  if (error) throw error;
}

const VIDEO_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["videos"],
  quality: 0.7,
  videoMaxDuration: MAX_VIDEO_SECONDS,
  videoQuality: ImagePicker.UIImagePickerControllerQualityType.IFrame1280x720,
};

/** Films (or picks) the proof video and sends it. Returns an error to show, or null. */
export async function sendProofVideo(clientId: string, proofId: string, useCamera: boolean): Promise<string | null | "cancelled"> {
  const permission = useCamera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return useCamera ? "Allow camera access to film the video." : "Allow access to your videos to send one.";
  const result = useCamera ? await ImagePicker.launchCameraAsync(VIDEO_OPTIONS) : await ImagePicker.launchImageLibraryAsync(VIDEO_OPTIONS);
  if (result.canceled || !result.assets?.[0]) return "cancelled";
  const asset = result.assets[0];
  const problem = videoProblem(asset.duration, asset.fileSize);
  if (problem) return problem;
  const ext = videoExtension(asset.uri, asset.mimeType);
  const path = `${clientId}/${proofId}-${Date.now()}.${ext}`;
  const body = await new File(asset.uri).arrayBuffer();
  const { error: upErr } = await supabase.storage
    .from(AWARD_PROOFS_BUCKET)
    .upload(path, body, { contentType: asset.mimeType ?? `video/${ext}` });
  if (upErr) return upErr.message;
  const { error } = await supabase.rpc("submit_award_proof", { p_proof: proofId, p_path: path });
  return error ? error.message : null;
}

/** A link that opens a private award file for an hour (owner and trainer screens). */
export async function awardFileUrl(bucket: string, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
