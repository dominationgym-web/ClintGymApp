import React, { useCallback, useState } from "react";
import { ActivityIndicator, Linking, Pressable, RefreshControl, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ScrollView } from "@/components/ScrollView";
import FoldSection from "@/components/FoldSection";
import TrainerLogo from "@/components/TrainerLogo";
import Confetti from "@/components/Confetti";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { AWARD_NAME, longDate, placeWord, trainerAwardHeadline, type AwardTrainerStatus } from "@/lib/award";
import { themeText, themedStyles } from "@/lib/theme";

// The trainer's Trainer of the Half-Year page (0194). Only the top-25%
// yes/no and one tip, never a score or rank; the cooldown badge for a recent
// winner; the published rules; and the live reveal at the end of a period.
export default function AwardScreen() {
  const [status, setStatus] = useState<AwardTrainerStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("my_award_status");
    setStatus((data as AwardTrainerStatus | null) ?? { enabled: false });
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!status) return <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginTop: 40 }} />;
  if (!status.enabled)
    return (
      <View style={styles.container}>
        <Text style={[styles.text, { padding: 20 }]}>{AWARD_NAME} isn't running at the moment.</Text>
      </View>
    );

  const reveal = status.reveal;
  const message = status.message;
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={themeText(BRAND_GOLD)}
          />
        }
      >
        {reveal && (
          <View style={styles.reveal}>
            <Text style={styles.revealLabel}>
              {AWARD_NAME}, to {longDate(reveal.period_ends)}
            </Text>
            <TrainerLogo name={reveal.winner} path={reveal.logo_path} size={84} />
            <Text style={styles.winner}>
              {reveal.my_place === 1 ? "You won! 🏆" : reveal.my_place ? `You came ${placeWord(reveal.my_place)}! 🏆` : reveal.winner}
            </Text>
            {(reveal.places ?? []).map((w) => (
              <Text key={w.place} style={[styles.text, w.place === 1 && { fontWeight: "700" }]}>
                {placeWord(w.place)}: {w.name}
              </Text>
            ))}
            {reveal.prize_text ? <Text style={styles.hint}>{reveal.prize_text}</Text> : null}
            {reveal.stream_url ? (
              <Pressable style={styles.button} onPress={() => Linking.openURL(reveal.stream_url!)} accessibilityRole="link">
                <Text style={styles.buttonText}>Watch the live reveal</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.title}>{trainerAwardHeadline(status)}</Text>
          {message?.tip && !status.cooldown_until ? <Text style={styles.text}>{message.tip}</Text> : null}
          <Text style={styles.hint}>
            {message ? `Update from ${longDate(message.sent_on)}. ` : ""}
            You hear on the 1st of each month whether you're in the top 25%, with one tip. There's no update in the last month of a period, so
            the winner stays a surprise.
          </Text>
          {status.period_ends ? <Text style={styles.hint}>This period ends on {longDate(status.period_ends)}.</Text> : null}
        </View>

        {status.prize_text ? (
          <View style={styles.card}>
            <Text style={styles.title}>The prize</Text>
            <Text style={styles.text}>{status.prize_text}</Text>
          </View>
        ) : null}

        {status.prize_tiers?.length ? (
          <View style={styles.card}>
            <Text style={styles.title}>The prize grows as more trainers join</Text>
            {status.prize_tiers.map((t) => (
              <Text key={t.trainers} style={styles.text}>
                {t.trainers.toLocaleString("en-ZA")} trainers: {t.prize}
              </Text>
            ))}
          </View>
        ) : null}

        {status.rules_text ? (
          <FoldSection icon="📜" title="The rules" hint="How the winner is chosen" open={rulesOpen} onToggle={() => setRulesOpen(!rulesOpen)}>
            <Text style={styles.text}>{status.rules_text}</Text>
          </FoldSection>
        ) : null}
      </ScrollView>
      <Confetti fire={reveal?.is_me ? 1 : false} />
    </View>
  );
}

const styles = themedStyles({
  container: { flex: 1, backgroundColor: "#0F172A" },
  card: { backgroundColor: "#1E293B", borderRadius: 10, padding: 14, marginBottom: 14, gap: 6 },
  title: { color: "#fff", fontWeight: "700", fontSize: 16 },
  text: { color: "#E2E8F0", lineHeight: 21 },
  hint: { color: "#94A3B8", fontSize: 13, lineHeight: 18 },
  reveal: { backgroundColor: "#1E293B", borderRadius: 12, borderWidth: 2, borderColor: BRAND_GOLD, padding: 18, marginBottom: 14, alignItems: "center", gap: 10 },
  revealLabel: { color: BRAND_GOLD, fontWeight: "700", textAlign: "center" },
  winner: { color: "#fff", fontWeight: "800", fontSize: 24, textAlign: "center" },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 18, alignItems: "center", marginTop: 4 },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 15 },
});
