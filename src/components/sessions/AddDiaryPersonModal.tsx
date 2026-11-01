import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import KeyboardSafe from "@/components/KeyboardSafe";
import TextInput from "@/components/TextInput";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { LONG_DAYS, WEEK_ORDER, cleanTime, regularLabel, sessionMoney } from "@/lib/liveSessions";
import { firstStarts } from "@/lib/calendarRegular";
import type { BillingCurrency, RegularTime, SessionSettings } from "@/types/database";
import { themeText, themedStyles } from "@/lib/theme";

const LENGTHS = [30, 40, 45, 60, 90];

// Add a 1 on 1 client who hasn't signed up to the app (GRIZZ, 2026-11-01:
// "Even if they haven't signed a trainer should be allowed to add a client to
// help him track"). They go on the calendar by name every week at their days
// and times, with their own price. When they join the app, one of their
// sessions › Link to their app account moves everything across.
export default function AddDiaryPersonModal({
  visible,
  settings,
  onClose,
  onSaved,
}: {
  visible: boolean;
  settings: SessionSettings | null;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const currency: BillingCurrency = settings?.currency ?? "ZAR";
  const [name, setName] = useState("");
  const [fee, setFee] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const [typed, setTyped] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName("");
    setFee(settings?.fee != null ? String(settings.fee) : "");
    setMinutes(settings?.minutes ?? 60);
    setTicked(new Set());
    setTyped({});
  }, [visible]);

  const regular: RegularTime[] = WEEK_ORDER.filter((d) => ticked.has(d) && cleanTime(typed[d])).map((d) => ({ weekday: d, time: cleanTime(typed[d]) as string }));
  const price = Number(fee.replace(",", "."));
  const priceOk = fee.trim() !== "" && Number.isFinite(price) && price >= 0;
  const ready = name.trim().length > 0 && priceOk && regular.length > 0;

  const tick = (d: number) => {
    const next = new Set(ticked);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    setTicked(next);
  };

  const save = async () => {
    if (!ready) return;
    const who = name.trim().slice(0, 60);
    setSaving(true);
    const rows = firstStarts(regular).map((starts_at) => ({
      client_id: null,
      name: who,
      starts_at,
      minutes,
      repeat: true,
    }));
    const { error } = await supabase.rpc("import_live_sessions", {
      p_rows: rows,
    });
    // Their own price, on these sessions and every week after.
    const priced = error ? null : await supabase.rpc("set_diary_fee", { p_name: who, p_fee: price });
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't add them", /session fee first/i.test(error.message) ? "Set your normal session price first: ☰ Menu › Session setup." : error.message);
      return;
    }
    if (priced?.error) Alert.alert("Added, but the price didn't save", `Tap ${who} under "On your calendar" to set it. ${priced.error.message}`);
    onSaved(who);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardSafe>
        <View style={styles.backdrop}>
          <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>＋ Add a client who isn't in the app</Text>
            <Text style={styles.helper}>For tracking their sessions and what they pay. They don't need the app. When they join, you can link them.</Text>

            <Text style={styles.label}>Their name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Jade" placeholderTextColor="#64748B" maxLength={60} />

            <Text style={styles.label}>Price per session</Text>
            <TextInput style={styles.input} value={fee} onChangeText={setFee} keyboardType="decimal-pad" placeholder="350" placeholderTextColor="#64748B" />

            <Text style={styles.label}>Session length</Text>
            <View style={styles.chips}>
              {[...new Set([...LENGTHS, minutes])]
                .sort((a, b) => a - b)
                .map((m) => (
                  <Pressable key={m} style={[styles.chip, minutes === m && styles.chipOn]} onPress={() => setMinutes(m)}>
                    <Text style={[styles.chipText, minutes === m && styles.chipTextOn]}>{m} min</Text>
                  </Pressable>
                ))}
            </View>

            <Text style={styles.label}>Their days and times</Text>
            <Text style={styles.meta}>Tick their days and type the time for each. They go on your calendar every week.</Text>
            {WEEK_ORDER.map((d) => {
              const on = ticked.has(d);
              return (
                <View key={d} style={styles.dayRow}>
                  <Pressable style={styles.tickRow} onPress={() => tick(d)} hitSlop={6}>
                    <View style={[styles.tick, on && styles.tickOn]}>{on ? <Text style={styles.tickMark}>✓</Text> : null}</View>
                    <Text style={[styles.dayName, on && styles.dayNameOn]}>{LONG_DAYS[d]}</Text>
                  </Pressable>
                  {on ? (
                    <TextInput
                      style={[styles.timeInput, !cleanTime(typed[d]) && styles.timeInputBad]}
                      value={typed[d] ?? ""}
                      onChangeText={(v) => setTyped({ ...typed, [d]: v })}
                      placeholder="05:50"
                      placeholderTextColor="#64748B"
                      maxLength={5}
                      keyboardType="numbers-and-punctuation"
                    />
                  ) : null}
                </View>
              );
            })}
            {regular.length ? (
              <Text style={[styles.meta, { color: themeText(BRAND_GOLD) }]}>
                {regularLabel(regular, true)} · {minutes} min
                {priceOk ? ` · ${sessionMoney(price, currency)} a session` : ""}
              </Text>
            ) : (
              <Text style={styles.meta}>No set days? Book them one session at a time on the Calendar tab: tap a day › Book a session › type their name.</Text>
            )}

            <Pressable style={[styles.button, !ready && { opacity: 0.5 }]} onPress={save} disabled={!ready || saving}>
              {saving ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.buttonText}>Add them</Text>}
            </Pressable>
            <Pressable style={styles.closeRow} onPress={onClose}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardSafe>
    </Modal>
  );
}

const styles = themedStyles({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0F172A",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: "92%",
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "800" },
  helper: {
    color: "#94A3B8",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 6,
  },
  label: {
    color: BRAND_GOLD,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 6,
  },
  meta: { color: "#94A3B8", fontSize: 12, marginTop: 6, lineHeight: 17 },
  input: {
    backgroundColor: "#F8FAFC",
    color: "#0F172A",
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#1E293B",
  },
  chipOn: { backgroundColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "700", fontSize: 13 },
  chipTextOn: { color: "#0F172A" },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  tickRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  tick: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#475569",
    alignItems: "center",
    justifyContent: "center",
  },
  tickOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  tickMark: { color: "#0F172A", fontWeight: "900", fontSize: 14 },
  dayName: { color: "#CBD5E1", fontSize: 15 },
  dayNameOn: { color: "#fff", fontWeight: "700" },
  timeInput: {
    width: 90,
    backgroundColor: "#F8FAFC",
    color: "#0F172A",
    borderRadius: 10,
    padding: 8,
    fontSize: 15,
    textAlign: "center",
  },
  timeInputBad: { borderWidth: 2, borderColor: "#F59E0B" },
  button: {
    backgroundColor: BRAND_GOLD,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 18,
  },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
  closeRow: { alignItems: "center", paddingVertical: 14 },
  closeText: { color: "#94A3B8", fontWeight: "700" },
});
