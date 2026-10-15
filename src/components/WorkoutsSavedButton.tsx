import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";

export const WORKOUT_LOADED_MESSAGE = "Your workout is loaded and ready. Open the app to see it. 💪";

// The trainer's Save on a client's Training tab (GRIZZ, 2026-10-12). Program,
// calendar and exercise changes are kept as they're made; Save tells the
// client their workout is loaded. It goes as a coach message (0034), so it
// arrives as a phone notification and as a card at the top of their Check-in.
export default function WorkoutsSavedButton({
  clientId,
  clientName,
  trainerId,
}: {
  clientId: string;
  clientName: string;
  trainerId: string;
}) {
  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState<Date | null>(null);

  const save = async () => {
    setSending(true);
    const { error } = await supabase
      .from("coach_messages")
      .insert({ client_id: clientId, trainer_id: trainerId, body: WORKOUT_LOADED_MESSAGE });
    setSending(false);
    if (error) {
      Alert.alert("Couldn't send", error.message);
      return;
    }
    setSentAt(new Date());
  };

  const time = sentAt?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <View style={styles.card}>
      <Text style={styles.helper}>
        Your changes are kept as you make them. When {clientName}'s workouts are ready, tap Save and they get a notification that their workout is loaded.
      </Text>
      <Pressable style={[styles.button, sentAt && styles.sent]} onPress={save} disabled={sending}>
        {sending ? (
          <ActivityIndicator color="#0F172A" />
        ) : (
          <Text style={[styles.buttonText, sentAt && styles.sentText]}>
            {sentAt ? `Saved ✓ ${clientName} was told at ${time}` : `Save and tell ${clientName}`}
          </Text>
        )}
      </Pressable>
      {sentAt && <Text style={styles.again}>Made more changes? Tap again to send another notification.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginTop: 12, borderLeftWidth: 3, borderLeftColor: BRAND_GOLD },
  helper: { color: "#94A3B8", fontSize: 13, lineHeight: 18 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 12 },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
  sent: { backgroundColor: "#0F172A", borderWidth: 1, borderColor: "#22C55E" },
  sentText: { color: "#22C55E" },
  again: { color: "#64748B", fontSize: 12, marginTop: 8, textAlign: "center" },
});
