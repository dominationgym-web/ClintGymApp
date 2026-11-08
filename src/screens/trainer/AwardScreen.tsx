import React, { useCallback, useState } from "react";
import { ActivityIndicator, Linking, Pressable, RefreshControl, Text, View } from "react-native";
import { useFocusEffect, useRoute, type RouteProp } from "@react-navigation/native";
import type { TrainerStackParamList } from "@/navigation/types";
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
// With preview (owner only, from Trainer award > Scores) it shows the page a
// trainer will see once the award is on, even while it is off, as a South
// African or an overseas trainer, with or without a sample winner reveal.
export default function AwardScreen() {
  const route = useRoute<RouteProp<TrainerStackParamList, "Award">>();
  const preview = !!route.params?.preview;
  const [status, setStatus] = useState<AwardTrainerStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [asSa, setAsSa] = useState(true);
  const [showReveal, setShowReveal] = useState(false);

  const load = useCallback(async () => {
    if (preview) {
      const { data } = await supabase.rpc("award_preview_status", { p_sa: asSa });
      setStatus((data as AwardTrainerStatus | null) ?? { enabled: false });
      return;
    }
    const { data } = await supabase.rpc("my_award_status");
    setStatus((data as AwardTrainerStatus | null) ?? { enabled: false });
  }, [preview, asSa]);
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

  const reveal = preview ? (showReveal ? sampleReveal(status) : null) : status.reveal;
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
        {preview && (
          <View style={styles.previewBox}>
            <Text style={styles.previewTitle}>Preview: what trainers see once the award is on</Text>
            <View style={styles.chips}>
              <Chip label="South African trainer" on={asSa} onPress={() => setAsSa(true)} />
              <Chip label="Overseas trainer" on={!asSa} onPress={() => setAsSa(false)} />
            </View>
            <View style={styles.chips}>
              <Chip label="Normal month" on={!showReveal} onPress={() => setShowReveal(false)} />
              <Chip label="Winner reveal" on={showReveal} onPress={() => setShowReveal(true)} />
            </View>
            {status.rules_published === false ? <Text style={styles.hint}>The rules aren't published yet, so trainers won't see them.</Text> : null}
          </View>
        )}

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
      <Confetti fire={reveal?.is_me && !preview ? 1 : false} />
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, on && styles.chipOn]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

// A made-up reveal so the owner can see the winner layout before a real one.
function sampleReveal(status: AwardTrainerStatus): NonNullable<AwardTrainerStatus["reveal"]> {
  const places = status.sample_places?.length ? status.sample_places : [{ place: 1, prize: "" }];
  const names = ["Sample Trainer A", "Sample Trainer B", "Sample Trainer C", "Sample Trainer D", "Sample Trainer E"];
  return {
    period_ends: status.period_ends ?? `${new Date().getFullYear()}-12-31`,
    revealed_at: new Date().toISOString(),
    winner: names[0],
    logo_path: null,
    is_me: false,
    my_place: null,
    places: places.map((p) => ({ place: p.place, name: names[p.place - 1] ?? `Sample Trainer ${p.place}`, logo_path: null, prize: null })),
    prize_text: places.map((p) => `${placeWord(p.place)} ${p.prize}`).join(", "),
    stream_url: status.stream_url ?? null,
  };
}

const styles = themedStyles({
  previewBox: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 10, padding: 12, marginBottom: 14, gap: 8 },
  previewTitle: { color: BRAND_GOLD, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#475569", borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  chipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipText: { color: "#E2E8F0", fontSize: 13 },
  chipTextOn: { color: "#0F172A", fontWeight: "700" },
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
