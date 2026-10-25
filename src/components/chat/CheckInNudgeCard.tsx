import React, { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { firstName, QUIET_AFTER_DAYS, quietLine } from "@/lib/chat";
import type { TrainerStackParamList } from "@/navigation/types";
import type { QuietClientRow } from "@/types/database";

// "Check in on Nancy" (GRIZZ, 2026-10-25): active clients the trainer hasn't
// messaged in a few days (0152's quiet_clients). A reminder to the trainer
// only. Nothing is sent to the client for them: Message opens the chat with an
// empty box, so the words are the trainer's own. "Spoke in person" counts as
// speaking to them. The same list sends a 09:00 phone reminder.
export default function CheckInNudgeCard({ startOpen = false }: { startOpen?: boolean }) {
  const navigation = useNavigation<NativeStackNavigationProp<TrainerStackParamList>>();
  const [rows, setRows] = useState<QuietClientRow[]>([]);
  const [open, setOpen] = useState(startOpen);

  const load = useCallback(() => {
    supabase.rpc("quiet_clients").then(({ data }) => setRows(data ?? []));
  }, []);

  useFocusEffect(load);

  const spokeInPerson = async (row: QuietClientRow) => {
    setRows((prev) => prev.filter((r) => r.client_id !== row.client_id));
    const { error } = await supabase.rpc("mark_spoke_to_client", { p_client: row.client_id });
    if (error) {
      Alert.alert("Couldn't save", error.message);
      load();
    }
  };

  if (rows.length === 0) return null;
  const first = firstName(rows[0].name);
  const title = rows.length === 1 ? `💬 Check in on ${first}` : `💬 Check in on ${first} and ${rows.length - 1} more`;

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={() => setOpen((o) => !o)} accessibilityRole="button">
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.toggle}>{open ? "Hide ▴" : "Show ▾"}</Text>
      </Pressable>
      {open ? (
        <>
          <Text style={styles.help}>
            You haven't messaged {rows.length === 1 ? "this client" : "these clients"} in {QUIET_AFTER_DAYS}+ days. A quick personal
            message, in your own words, makes them feel looked after.
          </Text>
          {rows.map((r) => (
            <View key={r.client_id} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.name}>{r.name}</Text>
                <Text style={styles.days}>{quietLine(r.days_quiet, r.last_spoke_at)}</Text>
              </View>
              <Pressable onPress={() => spokeInPerson(r)} style={styles.secondary} accessibilityLabel={`Spoke to ${r.name} in person`}>
                <Text style={styles.secondaryText}>Spoke in person</Text>
              </Pressable>
              <Pressable onPress={() => navigation.navigate("Chat", { clientId: r.client_id, name: r.name })} style={styles.primary}>
                <Text style={styles.primaryText}>Message</Text>
              </Pressable>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderLeftWidth: 4, borderLeftColor: BRAND_GOLD, borderRadius: 8, padding: 12, marginBottom: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { color: "#fff", fontWeight: "700", flex: 1 },
  toggle: { color: BRAND_GOLD, fontWeight: "600" },
  help: { color: "#94A3B8", fontSize: 13, marginTop: 6, marginBottom: 4, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#334155" },
  rowText: { flex: 1 },
  name: { color: "#fff", fontWeight: "600" },
  days: { color: "#94A3B8", fontSize: 12 },
  secondary: { paddingVertical: 6, paddingHorizontal: 8 },
  secondaryText: { color: "#94A3B8", fontSize: 12 },
  primary: { backgroundColor: BRAND_GOLD, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12 },
  primaryText: { color: "#0F172A", fontWeight: "700", fontSize: 13 },
});
