import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { INJURY_CHECK_ANSWERS, injuryCheckDue } from "@/lib/injuryCheck";
import { friendlyAlert } from "@/lib/network";
import type { ClientInjury, InjuryCheckAnswer } from "@/types/database";
import { themeText, themedStyles } from "@/lib/theme";

// "🩹 How's your knee this week?" on the client's Today tab (0209, GRIZZ
// 2026-11-10). Once a week per open injury: All better / Improving / The same
// / Worse, taps only. All better offers to remove it, so the coach knows to
// change the program. Answered ones drop off until next week.
export default function InjuryCheckInCard() {
  const { client } = useAuth();
  const [due, setDue] = useState<ClientInjury[]>([]);
  const [done, setDone] = useState<Record<string, { msg: string; offerRemove?: boolean }>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!client) return;
    const { data } = await supabase.from("client_injuries").select("*").eq("client_id", client.id).is("healed_on", null).order("created_at");
    const today = todayIso();
    setDue((data ?? []).filter((i) => injuryCheckDue(i, today)));
  }, [client?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const remove = async (injury: ClientInjury) => {
    const { error } = await supabase.from("client_injuries").update({ healed_on: todayIso() }).eq("id", injury.id);
    if (error) return Alert.alert(...friendlyAlert("Couldn't remove it", error));
    setDone((d) => ({ ...d, [injury.id]: { msg: `Removed. Your coach has been told your ${injury.area.toLowerCase()} is better.` } }));
  };

  const answer = async (injury: ClientInjury, key: InjuryCheckAnswer) => {
    setBusy(injury.id);
    const { error } = await supabase.rpc("answer_injury_check", { p_injury: injury.id, p_answer: key });
    setBusy(null);
    if (error) return Alert.alert(...friendlyAlert("Couldn't save", error));
    const area = injury.area.toLowerCase();
    if (key === "better") {
      setDone((d) => ({ ...d, [injury.id]: { msg: `Great news. Remove it from your injuries so your coach knows.`, offerRemove: true } }));
      Alert.alert(`Remove your ${area} injury?`, "Your coach will be told it's better so they can change your program.", [
        { text: "Not yet", style: "cancel" },
        { text: "Yes, remove it", onPress: () => remove(injury) },
      ]);
      return;
    }
    const msg =
      key === "improving"
        ? `Good to hear. Once it's all better, remove it so your coach can change your program.`
        : key === "same"
        ? `Thanks. Your coach can see it's the same. We'll ask again next week.`
        : `Sorry to hear that. Your coach has been told and will look at your program.`;
    setDone((d) => ({ ...d, [injury.id]: { msg } }));
  };

  if (!due.length) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>🩹 Weekly injury check</Text>
      <Text style={styles.sub}>How is it this week? Your coach uses this to adjust your program.</Text>
      {due.map((injury) => (
        <View key={injury.id} style={styles.row}>
          <Text style={styles.area}>{injury.area}</Text>
          {injury.notes ? <Text style={styles.notes} numberOfLines={2}>{injury.notes}</Text> : null}
          {done[injury.id] ? (
            <View>
              <Text style={styles.thanks}>{done[injury.id].msg}</Text>
              {done[injury.id].offerRemove && (
                <Pressable style={styles.removeBtn} onPress={() => remove(injury)} accessibilityRole="button">
                  <Text style={styles.removeText}>Remove it now</Text>
                </Pressable>
              )}
            </View>
          ) : busy === injury.id ? (
            <ActivityIndicator color={themeText("#F59E0B")} style={{ marginVertical: 10 }} />
          ) : (
            <View style={styles.buttons}>
              {INJURY_CHECK_ANSWERS.map((a) => (
                <Pressable key={a.key} style={[styles.btn, { borderColor: a.color }]} onPress={() => answer(injury, a.key)} accessibilityRole="button">
                  <Text style={[styles.btnText, { color: themeText(a.color) }]}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = themedStyles({
  card: { backgroundColor: "#1E293B", borderLeftWidth: 4, borderLeftColor: "#F59E0B", borderRadius: 8, padding: 12, marginBottom: 14 },
  title: { color: "#fff", fontWeight: "800", fontSize: 15 },
  sub: { color: "#94A3B8", fontSize: 13, marginTop: 2 },
  row: { backgroundColor: "#0F172A", borderRadius: 10, padding: 10, marginTop: 10 },
  area: { color: "#FCA5A5", fontWeight: "800", fontSize: 15 },
  notes: { color: "#CBD5E1", fontSize: 13, marginTop: 2 },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  btn: { flexGrow: 1, flexBasis: "45%", borderWidth: 1, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  btnText: { fontWeight: "800", fontSize: 14 },
  thanks: { color: "#E2E8F0", fontSize: 13, marginTop: 8, lineHeight: 18 },
  removeBtn: { borderWidth: 1, borderColor: "#22C55E", borderRadius: 8, paddingVertical: 10, alignItems: "center", marginTop: 8 },
  removeText: { color: "#22C55E", fontWeight: "800" },
});
