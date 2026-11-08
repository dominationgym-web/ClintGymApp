import React, { useCallback, useState } from "react";
import { Pressable, Text } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { TrainerStackParamList } from "@/navigation/types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { AWARD_NAME, trainerAwardHeadline, type AwardTrainerStatus } from "@/lib/award";
import { themedStyles } from "@/lib/theme";

// One line on the trainer's Today (both sides) while Trainer of the
// Half-Year is switched on (0194): the monthly top-25% yes/no, or the
// cooldown badge, or "the winner is live". Tapping opens the award page.
// Never a score or a rank. Shows nothing while the award is off.
export default function AwardTrainerCard() {
  const { trainer } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<TrainerStackParamList>>();
  const [status, setStatus] = useState<AwardTrainerStatus | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (trainer?.is_owner) return;
      supabase.rpc("my_award_status").then(({ data }) => setStatus((data as AwardTrainerStatus | null) ?? null));
    }, [trainer?.is_owner])
  );
  if (!status?.enabled || trainer?.is_owner) return null;
  const live = status.reveal && !status.reveal.is_me ? `The winner has been revealed: ${status.reveal.winner}` : null;
  const won = status.reveal?.is_me ? "You won! 🏆 Tap to see." : null;
  return (
    <Pressable style={styles.card} onPress={() => navigation.navigate("Award")} accessibilityRole="button">
      <Text style={styles.title}>🏆 {AWARD_NAME}</Text>
      <Text style={styles.text}>{won ?? live ?? trainerAwardHeadline(status)}</Text>
      <Text style={styles.link}>Open ›</Text>
    </Pressable>
  );
}

const styles = themedStyles({
  card: { backgroundColor: "#1E293B", borderLeftWidth: 4, borderLeftColor: BRAND_GOLD, borderRadius: 8, padding: 12, marginBottom: 14 },
  title: { color: "#fff", fontWeight: "700", marginBottom: 4 },
  text: { color: "#E2E8F0", lineHeight: 20 },
  link: { color: BRAND_GOLD, fontWeight: "700", marginTop: 6 },
});
