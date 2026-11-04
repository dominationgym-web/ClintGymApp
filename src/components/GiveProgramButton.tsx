import React, { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { TrainerStackParamList } from "@/navigation/types";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { ScrollView } from "@/components/ScrollView";
import SafeBottom from "@/components/SafeBottom";
import { themedStyles } from "@/lib/theme";
import { useStepBack } from "@/hooks/useStepBack";

type Row = { id: string; name: string };

// "Give a program to a client" on the Programs tab (critique, 2026-11-04): pick
// the client, and their Training tab opens, where programs are given.
export default function GiveProgramButton() {
  const navigation = useNavigation<NativeStackNavigationProp<TrainerStackParamList>>();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  useStepBack(open, () => setOpen(false));

  const show = async () => {
    setOpen(true);
    const { data } = await supabase
      .from("clients")
      .select("id, name, live_only, archived_at, access_status")
      .is("archived_at", null)
      .order("name");
    setRows((data ?? []).filter((c) => !c.live_only && c.access_status !== "expired"));
  };

  return (
    <>
      <Pressable style={styles.outline} onPress={show} accessibilityRole="button">
        <Text style={styles.outlineText}>Give a program to a client</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.title}>Which client?</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {rows === null ? <Text style={styles.meta}>Loading…</Text> : null}
              {rows?.length === 0 ? <Text style={styles.meta}>No clients yet.</Text> : null}
              {rows?.map((c) => (
                <Pressable
                  key={c.id}
                  style={styles.row}
                  onPress={() => {
                    setOpen(false);
                    navigation.navigate("ClientDetail", { clientId: c.id, tab: "training" });
                  }}
                >
                  <Text style={styles.rowText}>{c.name}</Text>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => setOpen(false)} style={styles.close}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
            <SafeBottom />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = themedStyles({
  outline: { borderWidth: 1.5, borderColor: BRAND_GOLD, borderRadius: 10, padding: 12, alignItems: "center", marginBottom: 8 },
  outlineText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 15 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0F172A", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  title: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 12 },
  meta: { color: "#94A3B8", fontSize: 14, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#1E293B", borderRadius: 10, padding: 14, marginBottom: 8 },
  rowText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  chevron: { color: BRAND_GOLD, fontWeight: "800", fontSize: 16 },
  close: { padding: 12, alignItems: "center" },
  closeText: { color: "#94A3B8", fontWeight: "700" },
});
