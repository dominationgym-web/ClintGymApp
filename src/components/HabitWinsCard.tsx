import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import TextInput from "@/components/TextInput";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { todayIso } from "@/lib/dates";
import { isPersonalMessage, winsShownFrom, winWeekLabel, type HabitWin } from "@/lib/habitWins";

type Row = HabitWin & { clientName: string };

// Habit wins on the trainer dashboard (0080): clients who kept habits on 5 of
// 7 days, with each habit listed, and a box for the trainer's own message.
// There's no ready-made text on purpose: it has to come from the trainer.
export default function HabitWinsCard({ trainerId }: { trainerId: string }) {
  const navigation = useNavigation();
  const [rows, setRows] = useState<Row[]>([]);
  const [writing, setWriting] = useState<Row | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  // Opens on tap, so the dashboard's client list stays in view.
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    const { data: wins } = await supabase
      .from("habit_wins")
      .select("*")
      .is("acknowledged_at", null)
      .gte("week_start", winsShownFrom(todayIso()))
      .order("updated_at", { ascending: false });
    const list = ((wins ?? []) as HabitWin[]).filter((w) => w.habits.length > 0);
    if (list.length === 0) {
      setRows([]);
      return;
    }
    const { data: clients } = await supabase
      .from("clients")
      .select("id, name")
      .eq("trainer_id", trainerId)
      .neq("id", trainerId)
      .is("archived_at", null)
      .in("id", [...new Set(list.map((w) => w.client_id))]);
    const names = new Map((clients ?? []).map((c) => [c.id, c.name]));
    setRows(list.filter((w) => names.has(w.client_id)).map((w) => ({ ...w, clientName: names.get(w.client_id) ?? "" })));
  }, [trainerId]);

  useEffect(() => {
    load();
    return navigation.addListener("focus", load);
  }, [navigation, load]);

  const open = (row: Row) => {
    setBody("");
    setWriting(row);
  };

  const send = async () => {
    if (!writing || !isPersonalMessage(body)) return;
    setSending(true);
    const { error } = await supabase.rpc("acknowledge_habit_win", { p_win: writing.id, p_message: body.trim() });
    setSending(false);
    if (error) {
      Alert.alert("Couldn't send", error.message);
      return;
    }
    setWriting(null);
    setRows((prev) => prev.filter((r) => r.id !== writing.id));
  };

  if (rows.length === 0) return null;
  const today = todayIso();

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={() => setExpanded(!expanded)} accessibilityRole="button" accessibilityState={{ expanded }}>
        <Text style={styles.title}>
          🏆 {rows.length} habit win{rows.length === 1 ? "" : "s"} to celebrate
        </Text>
        <Text style={styles.week}>{expanded ? "▲" : "▼"}</Text>
      </Pressable>
      {expanded && <Text style={styles.sub}>These clients kept habits on 5 or more days. A personal message keeps them going.</Text>}
      {expanded && rows.map((row) => (
        <View key={row.id} style={styles.row}>
          <View style={styles.rowTop}>
            <Text style={styles.name}>{row.clientName}</Text>
            <Text style={styles.week}>{winWeekLabel(row.week_start, today)}</Text>
          </View>
          {row.habits.map((h) => (
            <Text key={h.habit_id} style={styles.habit}>
              ✅ {h.name} · {h.days}/7 days
            </Text>
          ))}
          <Pressable style={styles.button} onPress={() => open(row)} accessibilityRole="button">
            <Text style={styles.buttonText}>✍️ Write to {row.clientName.split(" ")[0]}</Text>
          </Pressable>
        </View>
      ))}

      <Modal visible={!!writing} animationType="slide" transparent onRequestClose={() => setWriting(null)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior="padding">
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Message {writing?.clientName}</Text>
            <Text style={styles.sub}>What they achieved:</Text>
            {writing?.habits.map((h) => (
              <Text key={h.habit_id} style={styles.habit}>
                ✅ {h.name} · {h.days}/7 days
              </Text>
            ))}
            <TextInput
              style={styles.input}
              multiline
              autoFocus
              placeholder="Write your own message in your words"
              placeholderTextColor="#64748B"
              maxLength={1000}
              value={body}
              onChangeText={setBody}
            />
            <View style={styles.buttons}>
              <Pressable style={[styles.sheetButton, styles.cancel]} onPress={() => setWriting(null)} disabled={sending}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.sheetButton, styles.send, !isPersonalMessage(body) && styles.disabled]}
                onPress={send}
                disabled={!isPersonalMessage(body) || sending}
              >
                {sending ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.sendText}>Send</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginBottom: 12, borderTopWidth: 3, borderTopColor: BRAND_GOLD },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: "#fff", fontSize: 16, fontWeight: "800", flex: 1 },
  sub: { color: "#94A3B8", fontSize: 13, marginTop: 2, marginBottom: 6 },
  row: { backgroundColor: "#0F172A", borderRadius: 10, padding: 12, marginTop: 8 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  name: { color: "#fff", fontSize: 15, fontWeight: "700", flex: 1 },
  week: { color: BRAND_GOLD, fontSize: 12, fontWeight: "700" },
  habit: { color: "#E2E8F0", fontSize: 14, marginTop: 2 },
  button: { borderWidth: 1.5, borderColor: BRAND_GOLD, borderRadius: 8, paddingVertical: 8, alignItems: "center", marginTop: 10 },
  buttonText: { color: BRAND_GOLD, fontWeight: "800" },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { backgroundColor: "#1E293B", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 32 },
  sheetTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 4 },
  input: { backgroundColor: "#0F172A", color: "#fff", borderRadius: 8, padding: 12, minHeight: 110, textAlignVertical: "top", marginTop: 12 },
  buttons: { flexDirection: "row", gap: 10, marginTop: 18 },
  sheetButton: { flex: 1, padding: 14, borderRadius: 8, alignItems: "center" },
  cancel: { backgroundColor: "#334155" },
  cancelText: { color: "#fff", fontWeight: "600" },
  send: { backgroundColor: BRAND_GOLD },
  sendText: { color: "#0F172A", fontWeight: "700" },
  disabled: { opacity: 0.5 },
});
