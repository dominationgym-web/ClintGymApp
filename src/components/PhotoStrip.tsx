import React, { useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { parseIsoDate } from "@/lib/dates";

export type StripPhoto = { id: string; url: string | undefined; takenOn: string };

type Props = {
  photos: StripPhoto[];
  // Optional, for the client's own photos.
  onLongPress?: (id: string) => void;
};

// A sideways row of progress photos, oldest first so "before" is on the left.
// Tapping one opens it full screen.
export default function PhotoStrip({ photos, onLongPress }: Props) {
  const [open, setOpen] = useState<StripPhoto | null>(null);

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {photos.map((p, i) => (
          <Pressable key={p.id} onPress={() => setOpen(p)} onLongPress={onLongPress ? () => onLongPress(p.id) : undefined}>
            {p.url ? <Image source={{ uri: p.url }} style={styles.thumb} /> : <View style={styles.thumb} />}
            <Text style={styles.caption}>{i === 0 ? "Before · " : ""}{formatDate(p.takenOn)}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Modal visible={open !== null} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(null)}>
          {open?.url && <Image source={{ uri: open.url }} style={styles.full} resizeMode="contain" />}
          {open && <Text style={styles.fullCaption}>{formatDate(open.takenOn)} · tap to close</Text>}
        </Pressable>
      </Modal>
    </>
  );
}

function formatDate(iso: string) {
  return parseIsoDate(iso).toLocaleDateString();
}

const styles = StyleSheet.create({
  thumb: { width: 96, height: 128, borderRadius: 8, backgroundColor: "#1E293B" },
  caption: { color: "#94A3B8", fontSize: 11, marginTop: 4, textAlign: "center" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", alignItems: "center", padding: 16 },
  full: { width: "100%", height: "85%" },
  fullCaption: { color: "#E2E8F0", marginTop: 12 },
});
