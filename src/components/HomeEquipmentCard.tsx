import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { equipmentList, type EquipmentItem } from "@/lib/equipment";
import EquipmentEditor from "@/components/EquipmentEditor";
import type { Client } from "@/types/database";

// "Home equipment" under a tap-to-open heading (0092). It starts open while
// the list is empty, so a new home client sees it straight away.
export default function HomeEquipmentCard({
  client,
  trainer = false,
  onChanged,
}: {
  client: Pick<Client, "id" | "name" | "home_equipment">;
  trainer?: boolean;
  onChanged: (items: EquipmentItem[]) => void;
}) {
  const items = equipmentList(client.home_equipment);
  const [open, setOpen] = useState(items.length === 0);

  const save = async (next: EquipmentItem[]) => {
    const { error } = await supabase.from("clients").update({ home_equipment: next }).eq("id", client.id);
    if (error) {
      Alert.alert("Couldn't save", error.message);
      return false;
    }
    onChanged(next);
    return true;
  };

  return (
    <View style={[styles.card, open && styles.cardOpen]}>
      <Pressable style={styles.header} onPress={() => setOpen((o) => !o)}>
        <Text style={styles.icon}>🏠</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{trainer ? `${client.name}'s home equipment` : "My home equipment"}</Text>
          <Text style={styles.sub}>
            {items.length === 0 ? "Nothing listed yet" : `${items.length} item${items.length === 1 ? "" : "s"}`}
          </Text>
        </View>
        <Text style={styles.chevron}>{open ? "▴" : "▾"}</Text>
      </Pressable>
      {open ? (
        <View style={{ marginTop: 8 }}>
          <Text style={styles.helper}>
            {trainer
              ? "The app only picks home exercises this list covers. Load what a multi station can do from its Edit button. You can still change any exercise yourself."
              : "List what you train with at home so your workouts fit it. Add to it whenever you buy something new."}
          </Text>
          <EquipmentEditor clientId={client.id} items={items} onSave={save} trainer={trainer} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: "transparent" },
  cardOpen: { borderColor: BRAND_GOLD },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { fontSize: 22 },
  title: { color: "#fff", fontWeight: "800", fontSize: 16 },
  sub: { color: "#94A3B8", fontSize: 13 },
  chevron: { color: "#94A3B8", fontSize: 16 },
  helper: { color: "#94A3B8", fontSize: 13, lineHeight: 18, marginBottom: 10 },
});
