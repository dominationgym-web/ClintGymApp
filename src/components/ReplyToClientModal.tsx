import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { alertSummary, cleanMessage, MAX_MESSAGE_LENGTH } from "@/lib/coachMessages";
import type { Client } from "@/types/database";

// The trainer's reply to a client, opened from the Reply button on an alert.
// The client sees it in the app straight away, and as a phone notification in
// the installed app (0034). Sending can also mark the flag resolved, since
// answering it is usually what resolves it.
export default function ReplyToClientModal({
  client,
  trainerId,
  distressFlag = false,
  onClose,
  onSent,
}: {
  client: Client | null;
  trainerId: string;
  distressFlag?: boolean;
  onClose: () => void;
  onSent?: (resolved: boolean) => void;
}) {
  const [body, setBody] = useState("");
  const [resolve, setResolve] = useState(true);
  const [sending, setSending] = useState(false);

  // Fresh form for each client the modal opens on.
  useEffect(() => {
    setBody("");
    setResolve(true);
  }, [client?.id]);

  if (!client) return null;

  const flagged = client.status_flag !== "green";
  const summary = alertSummary(client.status_flag, distressFlag);
  const message = cleanMessage(body);

  const send = async () => {
    if (!message) return;
    setSending(true);
    const { error } = await supabase.from("coach_messages").insert({
      client_id: client.id,
      trainer_id: trainerId,
      body: message,
      reply_to_flag: flagged ? client.status_flag : null,
    });
    if (error) {
      setSending(false);
      Alert.alert("Couldn't send", error.message);
      return;
    }
    let resolved = false;
    if (flagged && resolve) {
      const { error: resolveError } = await supabase
        .from("clients")
        .update({ status_flag: "green", status_flag_note: null })
        .eq("id", client.id);
      if (resolveError) {
        Alert.alert("Message sent", "But the flag couldn't be marked resolved. Try again from their page.");
      } else {
        resolved = true;
      }
    }
    setSending(false);
    onSent?.(resolved);
    onClose();
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Reply to {client.name}</Text>
          {summary && <Text style={[styles.summary, client.status_flag === "orange" && styles.summaryOrange]}>{summary}</Text>}
          {client.status_flag_note ? <Text style={styles.note}>"{client.status_flag_note}"</Text> : null}

          <TextInput
            style={styles.input}
            multiline
            autoFocus
            placeholder="Your message"
            placeholderTextColor="#64748B"
            maxLength={MAX_MESSAGE_LENGTH}
            value={body}
            onChangeText={setBody}
          />

          {flagged && (
            <Pressable style={styles.toggleRow} onPress={() => setResolve((r) => !r)}>
              <View style={[styles.checkbox, resolve && styles.checkboxChecked]}>
                {resolve && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.toggleLabel}>Mark the flag as resolved</Text>
            </Pressable>
          )}

          <View style={styles.buttons}>
            <Pressable style={[styles.button, styles.cancel]} onPress={onClose} disabled={sending}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.send, !message && styles.disabled]} onPress={send} disabled={!message || sending}>
              {sending ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.sendText}>Send</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { backgroundColor: "#1E293B", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 32 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 6 },
  summary: { color: "#F87171", fontWeight: "600", marginBottom: 4 },
  summaryOrange: { color: "#FBBF24" },
  note: { color: "#CBD5E1", fontStyle: "italic", marginBottom: 8 },
  input: {
    backgroundColor: "#0F172A",
    color: "#fff",
    borderRadius: 8,
    padding: 12,
    minHeight: 110,
    textAlignVertical: "top",
    marginTop: 8,
  },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: "#64748B", alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  checkmark: { color: "#0F172A", fontWeight: "800", fontSize: 13 },
  toggleLabel: { color: "#E2E8F0" },
  buttons: { flexDirection: "row", gap: 10, marginTop: 18 },
  button: { flex: 1, padding: 14, borderRadius: 8, alignItems: "center" },
  cancel: { backgroundColor: "#334155" },
  cancelText: { color: "#fff", fontWeight: "600" },
  send: { backgroundColor: BRAND_GOLD },
  sendText: { color: "#0F172A", fontWeight: "700" },
  disabled: { opacity: 0.5 },
});
