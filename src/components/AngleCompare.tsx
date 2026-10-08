import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import PhotoStrip from "@/components/PhotoStrip";
import type { LoadedProgressPhoto } from "@/components/progressPhotoData";
import { ANGLE_LABEL, PROGRESS_ANGLES, type ProgressPhotoAngle } from "@/lib/progressPhotos";

type Props = {
  photos: LoadedProgressPhoto[];
  onLongPress?: (id: string) => void;
};

// Pick an angle, see that angle from every set side by side, oldest first:
// front against front, side against side, back against back.
export default function AngleCompare({ photos, onLongPress }: Props) {
  const [angle, setAngle] = useState<ProgressPhotoAngle>("front");
  const shown = photos.filter((p) => p.angle === angle);

  return (
    <View>
      <View style={styles.tabs}>
        {PROGRESS_ANGLES.map((a) => (
          <Pressable key={a} style={[styles.tab, a === angle && styles.tabActive]} onPress={() => setAngle(a)}>
            <Text style={[styles.tabText, a === angle && styles.tabTextActive]}>{ANGLE_LABEL[a]}</Text>
          </Pressable>
        ))}
      </View>
      {shown.length > 0 ? (
        <PhotoStrip photos={shown} onLongPress={onLongPress} />
      ) : (
        <Text style={styles.empty}>No {ANGLE_LABEL[angle].toLowerCase()} photos yet.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", backgroundColor: "#1E293B", borderRadius: 8, padding: 3, marginBottom: 10 },
  tab: { flex: 1, paddingVertical: 7, alignItems: "center", borderRadius: 6 },
  tabActive: { backgroundColor: "#334155" },
  tabText: { color: "#94A3B8", fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  empty: { color: "#64748B", fontSize: 13 },
});
