import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { PROGRAM_FAMILIES, programFamily, type ProgramFamily } from "@/lib/programs";
import GymHomeTabs, { PROGRAM_PLACE_LABELS } from "@/components/GymHomeTabs";
import type { ExercisePlace } from "@/lib/exerciseFilter";
import type { Program } from "@/types/database";

// A popup with every program a trainer can switch a client onto, grouped
// under tap-to-open headings (Full body, Chest & Bi, ...) so there's no long
// list to scroll. It opens on gym or home programs to match the client.
export default function ProgramChooserModal({
  visible,
  programs,
  currentId,
  clientName,
  trainingPlace,
  busy,
  onChoose,
  onBuild,
  onClose,
}: {
  visible: boolean;
  programs: Program[];
  currentId: string | null;
  clientName: string;
  trainingPlace: ExercisePlace;
  busy: boolean;
  onChoose: (program: Program) => void;
  onBuild: () => void;
  onClose: () => void;
}) {
  const [place, setPlace] = useState<ExercisePlace>(trainingPlace);
  const [open, setOpen] = useState<ProgramFamily | null>(null);

  // Each time it opens: the client's own place, every heading closed.
  useEffect(() => {
    if (visible) {
      setPlace(trainingPlace);
      setOpen(null);
    }
  }, [visible, trainingPlace]);

  const here = programs.filter((p) => p.place === place);
  const families = PROGRAM_FAMILIES.map((f) => ({ ...f, programs: here.filter((p) => programFamily(p) === f.key) })).filter(
    (f) => f.programs.length > 0,
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Choose a program for {clientName}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <GymHomeTabs
            current={place}
            onChange={(next) => {
              setPlace(next);
              setOpen(null);
            }}
            accent={BRAND_GOLD}
            labels={PROGRAM_PLACE_LABELS}
          />
          {place !== trainingPlace && (
            <Text style={styles.warning}>
              {clientName} trains at {trainingPlace === "home" ? "home" : "the gym"}. A {trainingPlace} program fits better.
            </Text>
          )}
          <ScrollView style={{ marginTop: 8 }} contentContainerStyle={{ paddingBottom: 4 }}>
            <Pressable style={styles.build} onPress={onBuild}>
              <Text style={styles.buildText}>+ Build your own program</Text>
            </Pressable>
            {families.map((f) => {
              const isOpen = open === f.key;
              return (
                <View key={f.key} style={[styles.family, isOpen && styles.familyOpen]}>
                  <Pressable style={styles.familyHeader} onPress={() => setOpen(isOpen ? null : f.key)}>
                    <Text style={styles.familyIcon}>{f.icon}</Text>
                    <Text style={styles.familyTitle}>{f.title}</Text>
                    <Text style={styles.count}>{f.programs.length}</Text>
                    <Text style={styles.chevron}>{isOpen ? "▴" : "▾"}</Text>
                  </Pressable>
                  {isOpen &&
                    f.programs.map((p) => {
                      const current = p.id === currentId;
                      return (
                        <Pressable
                          key={p.id}
                          style={[styles.choice, current && { borderColor: BRAND_GOLD }]}
                          onPress={() => !current && onChoose(p)}
                          disabled={busy || current}
                        >
                          <Text style={styles.name}>
                            {p.name}
                            {current ? "  (current)" : ""}
                          </Text>
                          {p.description ? <Text style={styles.helper} numberOfLines={2}>{p.description}</Text> : null}
                          {!current && <Text style={styles.activate}>Tap to switch on</Text>}
                        </Pressable>
                      );
                    })}
                </View>
              );
            })}
            {families.length === 0 && <Text style={styles.helper}>No {place} programs yet.</Text>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(2,6,23,0.8)", justifyContent: "center", padding: 16 },
  sheet: { backgroundColor: "#0F172A", borderRadius: 16, padding: 16, maxHeight: "90%", borderWidth: 1, borderColor: "#1E293B" },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 },
  title: { color: "#fff", fontWeight: "800", fontSize: 17, flex: 1 },
  close: { color: "#94A3B8", fontSize: 20, fontWeight: "700" },
  warning: { color: "#FBBF24", fontSize: 13, marginTop: 4 },
  build: { borderRadius: 12, borderWidth: 1.5, borderColor: BRAND_GOLD, borderStyle: "dashed", padding: 12, alignItems: "center" },
  buildText: { color: BRAND_GOLD, fontWeight: "800", fontSize: 15 },
  family: { backgroundColor: "#1E293B", borderRadius: 12, marginTop: 8, padding: 4 },
  familyOpen: { borderWidth: 1, borderColor: BRAND_GOLD },
  familyHeader: { flexDirection: "row", alignItems: "center", padding: 10, gap: 10 },
  familyIcon: { fontSize: 20 },
  familyTitle: { color: "#fff", fontWeight: "700", fontSize: 15, flex: 1 },
  count: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13 },
  chevron: { color: "#94A3B8", fontSize: 16 },
  choice: { backgroundColor: "#0F172A", borderRadius: 10, padding: 10, margin: 6, marginTop: 0, borderWidth: 1.5, borderColor: "transparent" },
  name: { color: "#fff", fontWeight: "700", fontSize: 14 },
  helper: { color: "#64748B", fontSize: 13, marginTop: 2 },
  activate: { color: BRAND_GOLD, fontSize: 12, fontWeight: "700", marginTop: 4 },
});
