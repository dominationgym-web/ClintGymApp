import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text } from "react-native";
import { supabase } from "@/lib/supabase";
import type { ClientAway } from "@/types/database";
import { holdOf, type AwayWho } from "@/components/sessions/AwayModal";
import { themeText, themedStyles } from "@/lib/theme";

// Block a client who hasn't paid (GRIZZ, 2026-11-09: "Hold their sessions
// (like Away)"). Their upcoming sessions keep their name, show "On hold: not
// paid" and are free to book, until Unblock once they've paid (0203).
export default function HoldButton({ who, aways, onChanged }: { who: AwayWho; aways: ClientAway[]; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const hold = holdOf(aways, who);
  const first = who.name.trim().split(/\s+/)[0] || "them";

  const block = () =>
    Alert.alert(
      `Put ${first} on hold?`,
      `For when they haven't paid. Every upcoming session of theirs stays on your calendar with their name, marked "On hold: not paid", and the slot is free to book. They aren't charged for them. Tap again (or flip Paid on their invoice) once they've paid.\n\nYou don't have to: anyone whose invoice isn't marked Paid by the 14th goes on hold by themselves.`,
      [
        { text: "Back", style: "cancel" },
        {
          text: "Put on hold",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            const { error } = await supabase.rpc("block_client", { p_client: who.clientId, p_guest: who.clientId ? null : who.name });
            setBusy(false);
            if (error) return Alert.alert("Couldn't put them on hold", error.message);
            onChanged();
          },
        },
      ]
    );

  const unblock = () =>
    Alert.alert(`Has ${first} paid?`, "Their sessions from now on are booked again, except slots you've given to someone else.", [
      { text: "Not yet", style: "cancel" },
      {
        text: "Yes, they've paid",
        onPress: async () => {
          if (!hold) return;
          setBusy(true);
          const { data, error } = await supabase.rpc("end_client_away", { p_id: hold.id });
          setBusy(false);
          if (error) return Alert.alert("Couldn't take them off hold", error.message);
          onChanged();
          const taken = data?.taken?.length ?? 0;
          Alert.alert(
            `${first} is booked again ✅`,
            taken ? `${taken} session${taken === 1 ? " was" : "s were"} already given to someone else, so ${taken === 1 ? "it stays" : "they stay"} off.` : "All their sessions are back."
          );
        },
      },
    ]);

  return (
    <Pressable style={[styles.outline, hold && styles.on]} onPress={hold ? unblock : block} disabled={busy} accessibilityRole="button">
      {busy ? (
        <ActivityIndicator color={themeText("#EF4444")} />
      ) : (
        <Text style={styles.text}>{hold ? "🚫 On hold: not paid · tap when they've paid" : "🚫 Block: hasn't paid"}</Text>
      )}
    </Pressable>
  );
}

const styles = themedStyles({
  outline: { borderWidth: 1, borderColor: "#EF4444", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center", marginBottom: 12 },
  on: { backgroundColor: "rgba(239,68,68,0.15)" },
  text: { color: "#EF4444", fontWeight: "700", fontSize: 14 },
});
