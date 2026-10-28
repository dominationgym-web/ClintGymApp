import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import TextInput from "@/components/TextInput";
import KeyboardSafe from "@/components/KeyboardSafe";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { BRAND_GOLD } from "@/lib/brand";
import { addDays } from "@/lib/programSchedule";
import { dayLabel } from "@/lib/recoveryActivities";
import {
  ACTIVITY_EFFORTS,
  ACTIVITY_KINDS,
  activityDetails,
  activityPace,
  activityTitle,
  findActivityKind,
  parseActivityForm,
  type ActivityEffort,
  type ActivityKind,
} from "@/lib/otherActivities";
import WatchLink from "@/components/WatchLink";
import type { ClientActivity } from "@/types/database";
import { themeText, themedStyles } from "@/lib/theme";

// Exercise outside the programs (0114, GRIZZ, 2026-10-18): walks, runs, rides,
// hikes, anything, with the time, distance and average heart rate. The client
// logs it on their Exercises tab; their trainer sees the same list (read only)
// on the client's Training tab, and it counts in the recovery suggestions and
// the trainer's daily summary.
export default function OtherActivityCard({ clientId, role }: { clientId: string; role: "client" | "trainer" }) {
  const today = todayIso();
  const [rows, setRows] = useState<ClientActivity[] | null>(null);
  const [logging, setLogging] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("client_activities")
      .select("*")
      .eq("client_id", clientId)
      .gte("activity_date", addDays(today, -6))
      .order("activity_date", { ascending: false })
      .order("created_at", { ascending: false });
    setRows((data as ClientActivity[] | null) ?? []);
  }, [clientId, today]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = (row: ClientActivity) =>
    Alert.alert("Remove this?", `${activityTitle(row)} on ${dayLabel(row.activity_date, today)}`, [
      { text: "Keep", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("client_activities").delete().eq("id", row.id);
          if (error) Alert.alert("Couldn't remove it", error.message);
          load();
        },
      },
    ]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>🏃 Other exercise</Text>
      <Text style={styles.helper}>
        {role === "client"
          ? "Walks, runs, rides, hikes, sport: anything outside your program. It helps your coach plan your training and recovery."
          : "What they did outside their program in the last 7 days."}
      </Text>
      {!rows ? (
        <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginVertical: 8 }} />
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>Nothing logged in the last 7 days.</Text>
      ) : (
        rows.map((r) => {
          const pace = activityPace(r);
          return (
            <Pressable key={r.id} style={styles.row} onLongPress={role === "client" ? () => remove(r) : undefined}>
              <Text style={styles.rowIcon}>{findActivityKind(r.kind).icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>
                  {activityTitle(r)} · {dayLabel(r.activity_date, today)}
                </Text>
                <Text style={styles.rowDetails}>
                  {activityDetails(r)}
                  {pace ? ` · ${pace}` : ""}
                  {r.source ? " · ⌚ watch" : ""}
                </Text>
                {r.notes ? <Text style={styles.rowNotes}>{r.notes}</Text> : null}
              </View>
              {role === "client" && (
                <Pressable onPress={() => remove(r)} hitSlop={8}>
                  <Text style={styles.removeText}>✕</Text>
                </Pressable>
              )}
            </Pressable>
          );
        })
      )}
      {role === "client" && (
        <Pressable style={styles.button} onPress={() => setLogging(true)}>
          <Text style={styles.buttonText}>+ Log exercise</Text>
        </Pressable>
      )}
      {role === "client" && <WatchLink clientId={clientId} onSynced={load} />}
      {role === "client" && (
        <LogActivityModal
          visible={logging}
          clientId={clientId}
          onClose={() => setLogging(false)}
          onSaved={() => {
            setLogging(false);
            load();
          }}
        />
      )}
    </View>
  );
}

function LogActivityModal({ visible, clientId, onClose, onSaved }: { visible: boolean; clientId: string; onClose: () => void; onSaved: () => void }) {
  const today = todayIso();
  const [kind, setKind] = useState<ActivityKind>("walk");
  const [name, setName] = useState("");
  const [day, setDay] = useState(today);
  const [minutes, setMinutes] = useState("");
  const [distance, setDistance] = useState("");
  const [hr, setHr] = useState("");
  const [effort, setEffort] = useState<ActivityEffort | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setKind("walk");
    setName("");
    setDay(today);
    setMinutes("");
    setDistance("");
    setHr("");
    setEffort(null);
    setNotes("");
  }, [visible, today]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
  const showDistance = findActivityKind(kind).distance;

  const save = async () => {
    const parsed = parseActivityForm({ minutes, distance: showDistance ? distance : "", hr });
    if (!parsed.ok) {
      Alert.alert("Check this", parsed.error);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("client_activities").insert({
      client_id: clientId,
      activity_date: day,
      kind,
      name: name.trim() || null,
      minutes: parsed.minutes,
      distance_km: parsed.distance_km,
      avg_hr: parsed.avg_hr,
      effort,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't save it", error.message);
      return;
    }
    onSaved();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardSafe>
        <View style={styles.backdrop}>
          <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetTitle}>Log exercise</Text>
            <Text style={styles.label}>What did you do?</Text>
            <View style={styles.chips}>
              {ACTIVITY_KINDS.map((k) => (
                <Pressable key={k.key} style={[styles.chip, kind === k.key && styles.chipOn]} onPress={() => setKind(k.key)}>
                  <Text style={[styles.chipText, kind === k.key && styles.chipTextOn]}>
                    {k.icon} {k.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {(kind === "sport" || kind === "other") && (
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={kind === "sport" ? "Which sport? (e.g. Padel)" : "What was it?"}
                placeholderTextColor="#64748B"
                maxLength={60}
              />
            )}
            <Text style={styles.label}>When?</Text>
            <View style={styles.chips}>
              {days.map((d) => (
                <Pressable key={d} style={[styles.chip, day === d && styles.chipOn]} onPress={() => setDay(d)}>
                  <Text style={[styles.chipText, day === d && styles.chipTextOn]}>{dayLabel(d, today)}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>How long? (minutes)</Text>
            <TextInput style={styles.input} value={minutes} onChangeText={setMinutes} keyboardType="number-pad" placeholder="e.g. 45" placeholderTextColor="#64748B" />
            {showDistance && (
              <>
                <Text style={styles.label}>Distance in km (optional)</Text>
                <TextInput style={styles.input} value={distance} onChangeText={setDistance} keyboardType="decimal-pad" placeholder="e.g. 5.2" placeholderTextColor="#64748B" />
              </>
            )}
            <Text style={styles.label}>Average heart rate (optional)</Text>
            <TextInput style={styles.input} value={hr} onChangeText={setHr} keyboardType="number-pad" placeholder="Beats per minute, e.g. 140" placeholderTextColor="#64748B" />
            <Text style={styles.label}>How hard did it feel?</Text>
            <View style={styles.chips}>
              {ACTIVITY_EFFORTS.map((e) => (
                <Pressable key={e.key} style={[styles.chip, effort === e.key && styles.chipOn]} onPress={() => setEffort(effort === e.key ? null : e.key)}>
                  <Text style={[styles.chipText, effort === e.key && styles.chipTextOn]}>{e.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, { minHeight: 60 }]}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="How did it go? Any soreness?"
              placeholderTextColor="#64748B"
              maxLength={500}
            />
            <Pressable style={[styles.button, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              <Text style={styles.buttonText}>{saving ? "Saving…" : "Save"}</Text>
            </Pressable>
            <Pressable style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardSafe>
    </Modal>
  );
}

const styles = themedStyles({
  card: { backgroundColor: "#111C33", borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 1, borderColor: "#1E293B" },
  title: { color: BRAND_GOLD, fontWeight: "700", fontSize: 16 },
  helper: { color: "#94A3B8", fontSize: 12, marginTop: 4 },
  empty: { color: "#94A3B8", fontSize: 13, marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1E293B" },
  rowIcon: { fontSize: 20 },
  rowTitle: { color: "#fff", fontWeight: "600", fontSize: 14 },
  rowDetails: { color: "#CBD5E1", fontSize: 12, marginTop: 2 },
  rowNotes: { color: "#94A3B8", fontSize: 12, marginTop: 2, fontStyle: "italic" },
  removeText: { color: "#64748B", fontSize: 16 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 12 },
  buttonText: { color: "#0B1426", fontWeight: "700", fontSize: 15 },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { flexGrow: 0, maxHeight: "92%", backgroundColor: "#1E293B", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  sheetTitle: { color: "#fff", fontWeight: "700", fontSize: 18 },
  label: { color: "#CBD5E1", fontSize: 13, fontWeight: "600", marginTop: 14, marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#334155", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipText: { color: "#E2E8F0", fontSize: 13 },
  chipTextOn: { color: "#0B1426", fontWeight: "700" },
  input: { backgroundColor: "#0F172A", color: "#fff", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginTop: 4 },
  cancel: { alignItems: "center", paddingVertical: 12 },
  cancelText: { color: "#94A3B8", fontSize: 15 },
});
