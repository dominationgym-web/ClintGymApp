import React, { useCallback, useState } from "react";
import { Alert, Linking, Pressable, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { firstName, markClientContact, QUIET_AFTER_DAYS, quietLine } from "@/lib/checkinNudges";
import { whatsappLink } from "@/lib/videoCheckins";
import type { TrainerStackParamList } from "@/navigation/types";
import type { QuietClientRow } from "@/types/database";
import { themedStyles } from "@/lib/theme";
import { useStepBack } from "@/hooks/useStepBack";

// "Check in on Nancy" (0156, GRIZZ 2026-10-25): active clients the trainer
// hasn't been in touch with for a few days. A reminder to the trainer only:
// WhatsApp opens the chat with an empty box, so the words are their own.
// Tapping it, or "Spoke in person", takes the client off the list. The same
// list sends a 09:00 phone reminder.
const SHOWN_AT_FIRST = 3;

export default function CheckInNudgeCard() {
  const navigation = useNavigation<NativeStackNavigationProp<TrainerStackParamList>>();
  const [rows, setRows] = useState<QuietClientRow[]>([]);
  const [open, setOpen] = useState(false);
  // A few at a time, so the dashboard doesn't turn into a long scroll.
  const [showAll, setShowAll] = useState(false);
  // Phone Back closes what is open first, one step at a time.
  useStepBack(open, () => setOpen(false));
  useStepBack(showAll, () => setShowAll(false));

  const load = useCallback(() => {
    supabase.rpc("quiet_clients").then(({ data }) => setRows(data ?? []));
  }, []);

  useFocusEffect(load);

  const contacted = async (row: QuietClientRow) => {
    setRows((prev) => prev.filter((r) => r.client_id !== row.client_id));
    const error = await markClientContact(row.client_id);
    if (error) {
      Alert.alert("Couldn't save", error);
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
            You haven't been in touch with {rows.length === 1 ? "this client" : "these clients"} for {QUIET_AFTER_DAYS}+ days. A quick
            personal message, in your own words, makes them feel special.
          </Text>
          {(showAll ? rows : rows.slice(0, SHOWN_AT_FIRST)).map((r) => {
            const link = whatsappLink(r.phone);
            return (
              // Name on its own line and the buttons under it: side by side,
              // the buttons squeezed the name to one letter a line on Android.
              <View key={r.client_id} style={styles.row}>
                <Pressable onPress={() => navigation.navigate("ClientDetail", { clientId: r.client_id })}>
                  <Text style={styles.name}>{r.name}</Text>
                  <Text style={styles.days}>{quietLine(r.days_quiet, r.last_spoke_at)}</Text>
                </Pressable>
                <View style={styles.actions}>
                  <Pressable onPress={() => contacted(r)} style={styles.secondary} accessibilityLabel={`Spoke to ${r.name} in person`}>
                    <Text style={styles.secondaryText}>Spoke in person</Text>
                  </Pressable>
                  {link ? (
                    <Pressable
                      onPress={() => {
                        contacted(r);
                        Linking.openURL(link);
                      }}
                      style={styles.primary}
                    >
                      <Text style={styles.primaryText}>💬 WhatsApp</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}
          {rows.length > SHOWN_AT_FIRST && (
            <Pressable onPress={() => setShowAll((v) => !v)} style={styles.more} accessibilityRole="button">
              <Text style={styles.toggle}>{showAll ? "Show fewer ▴" : `See all ${rows.length} ▾`}</Text>
            </Pressable>
          )}
        </>
      ) : null}
    </View>
  );
}

const styles = themedStyles({
  card: { backgroundColor: "#1E293B", borderLeftWidth: 4, borderLeftColor: BRAND_GOLD, borderRadius: 8, padding: 12, marginBottom: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { color: "#fff", fontWeight: "700", flex: 1 },
  toggle: { color: BRAND_GOLD, fontWeight: "600" },
  help: { color: "#94A3B8", fontSize: 13, marginTop: 6, marginBottom: 4, lineHeight: 18 },
  row: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#334155" },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 6 },
  more: { paddingTop: 8, borderTopWidth: 1, borderTopColor: "#334155", alignItems: "center" },
  name: { color: "#fff", fontWeight: "600" },
  days: { color: "#94A3B8", fontSize: 12 },
  secondary: { paddingVertical: 6, paddingHorizontal: 6 },
  secondaryText: { color: "#94A3B8", fontSize: 12 },
  primary: { backgroundColor: BRAND_GOLD, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10 },
  primaryText: { color: "#0F172A", fontWeight: "700", fontSize: 13 },
});
