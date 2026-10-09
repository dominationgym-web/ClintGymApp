import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import ProgressHistory from "@/components/ProgressHistory";
import { loadProgressPhotos, type LoadedProgressPhoto } from "@/components/progressPhotoData";

type Props = { clientId: string; clientName: string; shared: boolean };

// The trainer's view of a client's progress photos: only when the client has
// chosen to share them. The database enforces this too (0027).
export default function TrainerProgressPhotos({ clientId, clientName, shared }: Props) {
  const [photos, setPhotos] = useState<LoadedProgressPhoto[] | null>(null);

  useEffect(() => {
    if (!shared) return;
    let cancelled = false;
    loadProgressPhotos(clientId).then((p) => {
      if (!cancelled) setPhotos(p);
    });
    return () => {
      cancelled = true;
    };
  }, [clientId, shared]);

  if (!shared) {
    return <Text style={styles.helper}>🔒 Private. {clientName} hasn't shared their progress photos with you.</Text>;
  }
  if (photos === null) return <ActivityIndicator color="#22C55E" />;
  if (photos.length === 0) return <Text style={styles.helper}>Shared, but no photos yet.</Text>;
  return (
    <View>
      <ProgressHistory photos={photos} />
    </View>
  );
}

const styles = StyleSheet.create({
  helper: { color: "#64748B", fontSize: 13 },
});
