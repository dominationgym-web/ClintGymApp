import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Modal, ActivityIndicator, Alert, AppState, ScrollView } from "react-native";
import TextInput from "@/components/TextInput";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { quoteForDate } from "@/lib/dailyQuotes";
import { todayIso } from "@/lib/dates";
import { STATUS_FLAGS, answeredStatusToday } from "@/lib/statusFlags";
import KeyboardSafe from "@/components/KeyboardSafe";
import type { ClientStatusFlag } from "@/types/database";
import { themeBg, themeBorder, themeText, themedStyles } from "@/lib/theme";

const QUOTE_SEEN_KEY = "dailyQuoteSeenOn";
const STATUS_ANSWERED_KEY = "dailyStatusAnsweredOn";

type Step = "status" | "quote" | null;

// The first time the client opens the app each day (GRIZZ, 2026-10-14):
// first "How are you doing?", so anything urgent reaches the trainer straight
// away, then today's quote. Each step is skipped if it's already done today.
// Also checks again when the app comes back from the background, since a
// phone can keep the app open overnight.
export default function DailyStartPopup() {
  const { client, refreshProfile } = useAuth();
  const clientRef = useRef(client);
  clientRef.current = client;
  const clientId = client?.id;

  const [step, setStep] = useState<Step>(null);
  const stepRef = useRef<Step>(null);
  stepRef.current = step;
  const [needQuote, setNeedQuote] = useState(false);
  const [flag, setFlag] = useState<ClientStatusFlag | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  // A day the client skipped after a failed save, so it doesn't pop straight back.
  const skippedOn = useRef<string | null>(null);

  const check = useCallback(async () => {
    const current = clientRef.current;
    if (!current || stepRef.current) return;
    try {
      const today = todayIso();
      const [answeredOn, quoteSeenOn] = await Promise.all([
        AsyncStorage.getItem(STATUS_ANSWERED_KEY),
        AsyncStorage.getItem(QUOTE_SEEN_KEY),
      ]);
      const needStatus = skippedOn.current !== today && !answeredStatusToday(current.status_flag_updated_at, answeredOn);
      const quote = quoteSeenOn !== today;
      setNeedQuote(quote);
      if (needStatus) {
        setFlag(null);
        setNote("");
        setFailed(false);
        setStep("status");
      } else if (quote) {
        setStep("quote");
      }
    } catch {
      // Storage failed: nothing pops up. Both still live on the Profile tab.
    }
  }, []);

  useEffect(() => {
    if (!clientId) return;
    check();
    const subscription = AppState.addEventListener("change", (state) => state === "active" && check());
    return () => subscription.remove();
  }, [clientId, check]);

  if (!client) return null;

  const pick = (key: ClientStatusFlag) => {
    setFlag(key);
    // Picking the flag they already have brings back the note they wrote.
    setNote(key === client.status_flag ? client.status_flag_note ?? "" : "");
  };

  const afterStatus = () => {
    if (needQuote) setStep("quote");
    else setStep(null);
  };

  const send = async () => {
    if (!flag) return;
    if (flag !== "green" && !note.trim()) {
      Alert.alert("Add a quick note", "Let your trainer know what's going on so they have context.");
      return;
    }
    setSaving(true);
    // The server stamps the time and alerts the trainer (0023, 0075).
    const { error } = await supabase
      .from("clients")
      .update({ status_flag: flag, status_flag_note: flag === "green" ? null : note.trim() })
      .eq("id", client.id);
    setSaving(false);
    if (error) {
      setFailed(true);
      Alert.alert("Couldn't send", "Check your connection and try again.");
      return;
    }
    AsyncStorage.setItem(STATUS_ANSWERED_KEY, todayIso()).catch(() => {});
    refreshProfile();
    afterStatus();
  };

  const skip = () => {
    skippedOn.current = todayIso();
    afterStatus();
  };

  const closeQuote = () => {
    setStep(null);
    AsyncStorage.setItem(QUOTE_SEEN_KEY, todayIso()).catch(() => {});
  };

  return (
    <Modal
      visible={step !== null}
      transparent
      animationType="fade"
      // Android back: the question needs an answer, the quote can close.
      onRequestClose={step === "quote" ? closeQuote : () => {}}
    >
      <KeyboardSafe>
        <ScrollView contentContainerStyle={styles.backdrop} keyboardShouldPersistTaps="handled">
          {step === "status" ? (
            <View style={styles.popup}>
              <Text style={styles.kicker}>DAILY CHECK</Text>
              <Text style={styles.title}>How are you doing?</Text>
              <Text style={styles.body}>Let your trainer know if you need anything - they check this before anything else.</Text>
              {STATUS_FLAGS.map((f) => (
                <Pressable key={f.key} style={styles.flagRow} onPress={() => pick(f.key)}>
                  {f.key === "red" ? <Text style={styles.flagIcon}>🚩</Text> : <View style={[styles.flagDot, { backgroundColor: themeBg(f.color) }]} />}
                  <View style={[styles.radio, flag === f.key && { borderColor: themeBorder(f.color), backgroundColor: themeBg(f.color) }]} />
                  <Text style={styles.flagLabel}>{f.label}</Text>
                </Pressable>
              ))}
              {flag && flag !== "green" ? (
                <TextInput
                  style={styles.noteInput}
                  multiline
                  placeholder="Quick note for your trainer (what's going on?)"
                  placeholderTextColor="#64748B"
                  value={note}
                  onChangeText={setNote}
                />
              ) : null}
              <Pressable style={[styles.button, !flag && styles.buttonDisabled]} onPress={send} disabled={!flag || saving}>
                {saving ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.buttonText}>Send</Text>}
              </Pressable>
              {failed ? (
                <Pressable style={styles.skip} onPress={skip}>
                  <Text style={styles.skipText}>Skip for today</Text>
                </Pressable>
              ) : null}
            </View>
          ) : step === "quote" ? (
            <View style={styles.popup}>
              <Text style={styles.kicker}>TODAY'S FUEL</Text>
              <Text style={styles.quote}>{quoteForDate(new Date())}</Text>
              <Pressable style={styles.button} onPress={closeQuote}>
                <Text style={styles.buttonText}>Let's go</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardSafe>
    </Modal>
  );
}

const styles = themedStyles({
  backdrop: { flexGrow: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", padding: 24 },
  popup: { backgroundColor: "#0F172A", borderRadius: 16, padding: 24, borderWidth: 1.5, borderColor: BRAND_GOLD },
  kicker: { color: BRAND_GOLD, fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginBottom: 6 },
  title: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 6 },
  body: { color: "#CBD5E1", fontSize: 15, lineHeight: 21, marginBottom: 10 },
  quote: { color: "#fff", fontSize: 22, fontWeight: "700", lineHeight: 30, marginBottom: 20 },
  flagRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  flagIcon: { width: 14, marginRight: 8, fontSize: 12 },
  flagDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#475569", marginRight: 12 },
  flagLabel: { color: "#fff", fontSize: 16, flex: 1 },
  noteInput: {
    backgroundColor: "#1E293B",
    color: "#fff",
    borderRadius: 10,
    padding: 12,
    minHeight: 70,
    textAlignVertical: "top",
    marginTop: 6,
  },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 16 },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
  skip: { alignItems: "center", paddingTop: 12 },
  skipText: { color: "#94A3B8", fontSize: 14, textDecorationLine: "underline" },
});
