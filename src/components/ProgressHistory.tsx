import React, { useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import AngleCompare from "@/components/AngleCompare";
import type { LoadedProgressPhoto } from "@/components/progressPhotoData";
import { parseIsoDate } from "@/lib/dates";
import { ANGLE_LABEL, PROGRESS_ANGLES, groupIntoSets, setLabel, weeksBetween } from "@/lib/progressPhotos";

type Props = {
  photos: LoadedProgressPhoto[];
  // Optional, for the client's own photos.
  onLongPress?: (id: string) => void;
};

// Sets shown before "Show all", so a long history doesn't bury the rest of
// the screen.
const SETS_SHOWN = 3;

// Everything a client has taken, kept for as long as their account exists:
// a one-angle comparison across every set, then every set in full, newest
// first. Used on the client's Profile and, when shared, by the trainer.
export default function ProgressHistory({ photos, onLongPress }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<LoadedProgressPhoto | null>(null);

  const sets = groupIntoSets(photos);
  if (sets.length === 0) return null;
  const first = sets[0];
  const latest = sets[sets.length - 1];
  const weeks = weeksBetween(first.takenOn, latest.takenOn);
  const newestFirst = sets.map((set, i) => ({ set, label: setLabel(sets, i) })).reverse();
  const shown = showAll ? newestFirst : newestFirst.slice(0, SETS_SHOWN);

  return (
    <View>
      <Text style={styles.summary}>
        {sets.length} set{sets.length === 1 ? "" : "s"}
        {weeks > 0 ? ` over ${weeks} week${weeks === 1 ? "" : "s"}` : ""} · started{" "}
        {formatDate(first.takenOn)}
      </Text>

      <Text style={styles.subheading}>Compare one angle</Text>
      <AngleCompare photos={photos} onLongPress={onLongPress} />

      <Text style={[styles.subheading, { marginTop: 16 }]}>Every set</Text>
      {shown.map(({ set, label }) => (
        <View key={set.takenOn} style={styles.setCard}>
          <Text style={styles.setTitle}>
            {label} <Text style={styles.setDate}>· {formatDate(set.takenOn)}</Text>
          </Text>
          <View style={styles.row}>
            {PROGRESS_ANGLES.map((angle) => {
              const photo = set.byAngle[angle];
              return (
                <View key={angle} style={styles.cell}>
                  {photo ? (
                    <Pressable
                      onPress={() => setOpen(photo)}
                      onLongPress={onLongPress ? () => onLongPress(photo.id) : undefined}
                    >
                      {photo.url ? <Image source={{ uri: photo.url }} style={styles.thumb} /> : <View style={styles.thumb} />}
                    </Pressable>
                  ) : (
                    <View style={[styles.thumb, styles.missing]}>
                      <Text style={styles.missingText}>Not taken</Text>
                    </View>
                  )}
                  <Text style={styles.caption}>{ANGLE_LABEL[angle]}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ))}
      {sets.length > SETS_SHOWN && (
        <Pressable onPress={() => setShowAll(!showAll)}>
          <Text style={styles.link}>{showAll ? "Show fewer" : `Show all ${sets.length} sets`}</Text>
        </Pressable>
      )}

      <Modal visible={open !== null} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(null)}>
          {open?.url && <Image source={{ uri: open.url }} style={styles.full} resizeMode="contain" />}
          {open && (
            <Text style={styles.fullCaption}>
              {ANGLE_LABEL[open.angle]} · {formatDate(open.takenOn)} · tap to close
            </Text>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

function formatDate(iso: string) {
  return parseIsoDate(iso).toLocaleDateString();
}

const styles = StyleSheet.create({
  summary: { color: "#94A3B8", fontSize: 13, marginBottom: 10 },
  subheading: { color: "#E2E8F0", fontWeight: "600", marginBottom: 8 },
  setCard: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginBottom: 10 },
  setTitle: { color: "#fff", fontWeight: "700" },
  setDate: { color: "#94A3B8", fontWeight: "400" },
  row: { flexDirection: "row", gap: 10, marginTop: 10 },
  cell: { flex: 1, alignItems: "center" },
  thumb: { width: "100%", aspectRatio: 3 / 4, borderRadius: 8, backgroundColor: "#0F172A" },
  missing: { borderWidth: 1, borderStyle: "dashed", borderColor: "#334155", alignItems: "center", justifyContent: "center" },
  missingText: { color: "#64748B", fontSize: 11 },
  caption: { color: "#94A3B8", fontSize: 11, marginTop: 4 },
  link: { color: "#22C55E", fontWeight: "600", marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", alignItems: "center", padding: 16 },
  full: { width: "100%", height: "85%" },
  fullCaption: { color: "#E2E8F0", marginTop: 12 },
});
