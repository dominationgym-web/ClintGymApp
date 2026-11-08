import React from "react";
import { Alert, Image, Pressable, Text, View } from "react-native";
import type * as ImagePicker from "expo-image-picker";
import { BRAND_GOLD } from "@/lib/brand";
import { FACE_PHOTO_CONSENT, FACE_PHOTO_WHY, GOAL_DIRECTIONS, type GoalDirection } from "@/lib/award";
import { pickFacePhoto } from "@/lib/awardUploads";
import { themedStyles } from "@/lib/theme";

// The face photo (with its consent box) and the goal tick box, asked at
// client sign-up and on the Today tab for clients who joined before. Only
// shown while Trainer of the Half-Year is switched on.
export default function AwardProfileFields({
  photo,
  onPhoto,
  consented,
  onConsent,
  goal,
  onGoal,
  askPhoto = true,
  askGoal = true,
}: {
  photo: ImagePicker.ImagePickerAsset | null;
  onPhoto: (p: ImagePicker.ImagePickerAsset) => void;
  consented: boolean;
  onConsent: (v: boolean) => void;
  goal: GoalDirection | null;
  onGoal: (g: GoalDirection) => void;
  askPhoto?: boolean;
  askGoal?: boolean;
}) {
  const choose = () =>
    Alert.alert("Your face photo", "Face the camera in good light, no sunglasses or cap.", [
      { text: "Take a photo", onPress: () => pickFacePhoto(true).then((p) => p && onPhoto(p)) },
      { text: "Choose a photo", onPress: () => pickFacePhoto(false).then((p) => p && onPhoto(p)) },
      { text: "Cancel", style: "cancel" },
    ]);
  return (
    <View>
      {askGoal && (
        <>
          <Text style={styles.heading}>Your main goal</Text>
          {GOAL_DIRECTIONS.map((g) => (
            <Pressable key={g.key} style={styles.row} onPress={() => onGoal(g.key)} accessibilityRole="radio" accessibilityState={{ checked: goal === g.key }}>
              <View style={[styles.radio, goal === g.key && styles.radioOn]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.body}>{g.label}</Text>
                <Text style={styles.hint}>{g.hint}</Text>
              </View>
            </Pressable>
          ))}
        </>
      )}
      {askPhoto && (
        <>
          <Text style={styles.heading}>Face photo</Text>
          <Text style={styles.hint}>{FACE_PHOTO_WHY}</Text>
          <Pressable style={styles.photoRow} onPress={choose} accessibilityRole="button">
            {photo ? (
              <Image source={{ uri: photo.uri }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.photoEmpty]}>
                <Text style={styles.photoPlus}>+</Text>
              </View>
            )}
            <Text style={styles.link}>{photo ? "Change photo" : "Add your face photo"}</Text>
          </Pressable>
          <Pressable style={styles.row} onPress={() => onConsent(!consented)} accessibilityRole="checkbox" accessibilityState={{ checked: consented }}>
            <View style={[styles.box, consented && styles.radioOn]} />
            <Text style={[styles.body, { flex: 1, fontSize: 13 }]}>{FACE_PHOTO_CONSENT}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = themedStyles({
  heading: { color: "#94A3B8", fontWeight: "600", marginTop: 16, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  body: { color: "#E2E8F0", fontSize: 14, lineHeight: 20 },
  hint: { color: "#94A3B8", fontSize: 12, marginTop: 2, lineHeight: 17 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#64748B", marginTop: 1 },
  box: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: "#64748B", marginTop: 1 },
  radioOn: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 14, marginVertical: 12 },
  photo: { width: 72, height: 72, borderRadius: 36 },
  photoEmpty: { backgroundColor: "#1E293B", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#334155" },
  photoPlus: { color: BRAND_GOLD, fontSize: 28, fontWeight: "700" },
  link: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14 },
});
