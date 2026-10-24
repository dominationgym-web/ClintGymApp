import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { WEIGH_IN_OPTIONS, type WeighInEvery } from "@/lib/progress";

type Row = { id: string; name: string; weigh_in_every?: WeighInEvery | null };

// Trainer ticks several clients and picks one weigh-in schedule for all of
// them (GRIZZ, 2026-10-24). Each client then gets the reminder on their Today
// screen until they weigh and measure. Sets only the schedule; no message is
// written for the trainer.
export default function BulkWeighInModal({
  clients,
  visible,
  onApply,
  onClose,
}: {
  clients: Row[];
  visible: boolean;
  onApply: (ids: string[], key: WeighInEvery) => Promise<void>;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const label = (k?: WeighInEvery | null) => WEIGH_IN_OPTIONS.find((o) => o.key === k)?.label ?? "No schedule yet";

  const apply = async (key: WeighInEvery) => {
    setSaving(true);
    await onApply(picked, key);
    setSaving(false);
    setPicked([]);
  };
  const close = () => {
    setPicked([]);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>⚖️ Weigh-in schedule</Text>
          <Text style={styles.text}>Tick the clients, then pick how often they weigh and measure. They get a reminder until it's done.</Text>
          <View style={styles.quick}>
            <Pressable onPress={() => setPicked(clients.map((c) => c.id))}>
              <Text style={styles.quickText}>All</Text>
            </Pressable>
            <Pressable onPress={() => setPicked(clients.filter((c) => !c.weigh_in_every).map((c) => c.id))}>
              <Text style={styles.quickText}>Without a schedule</Text>
            </Pressable>
            <Pressable onPress={() => setPicked([])}>
              <Text style={styles.quickText}>None</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.list}>
            {clients.map((c) => {
              const on = picked.includes(c.id);
              return (
                <Pressable key={c.id} style={styles.row} onPress={() => toggle(c.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                  <Text style={styles.box}>{on ? "☑" : "☐"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{c.name}</Text>
                    <Text style={styles.now}>{label(c.weigh_in_every)}</Text>
                  </View>
                </Pressable>
              );
            })}
            {clients.length === 0 && <Text style={styles.text}>No active clients yet.</Text>}
          </ScrollView>
          {picked.length > 0 && (
            <>
              <Text style={styles.label}>Set {picked.length} client{picked.length === 1 ? "" : "s"} to:</Text>
              {WEIGH_IN_OPTIONS.map((o) => (
                <Pressable key={o.key} style={[styles.option, saving && { opacity: 0.5 }]} disabled={saving} onPress={() => apply(o.key)} accessibilityRole="button">
                  <Text style={styles.optionText}>{o.label}</Text>
                </Pressable>
              ))}
            </>
          )}
          <Pressable style={styles.skip} onPress={close} accessibilityRole="button">
            <Text style={styles.skipText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 20 },
  card: { backgroundColor: "#111C33", borderRadius: 14, padding: 18, borderWidth: 1.5, borderColor: BRAND_GOLD, maxHeight: "90%" },
  title: { color: "#fff", fontWeight: "800", fontSize: 18 },
  text: { color: "#CBD5E1", fontSize: 13, marginTop: 6 },
  quick: { flexDirection: "row", gap: 16, marginTop: 10, marginBottom: 6 },
  quickText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13 },
  list: { maxHeight: 280 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  box: { color: BRAND_GOLD, fontSize: 22 },
  name: { color: "#fff", fontWeight: "600" },
  now: { color: "#64748B", fontSize: 12 },
  label: { color: "#fff", fontWeight: "700", marginTop: 10 },
  option: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 12, alignItems: "center", marginTop: 8 },
  optionText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
  skip: { padding: 12, alignItems: "center", marginTop: 4 },
  skipText: { color: "#94A3B8", fontWeight: "700" },
});
