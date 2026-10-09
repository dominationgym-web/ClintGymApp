import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Switch } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ClientStackParamList } from "@/navigation/types";
import { findSection } from "@/lib/sections";
import { BRAND_GOLD } from "@/lib/brand";
import { getSleepReminderEnabled, setSleepReminderEnabled } from "@/lib/sleepReminderSetting";
import { scheduleSleepReminders } from "@/lib/notifications";

type Props = NativeStackScreenProps<ClientStackParamList, "Section">;

// One of the menu sections. A section with content shows it as headed lists;
// one without shows what it will cover so clients know what's on the way.
export default function SectionScreen({ route }: Props) {
  const section = findSection(route.params.sectionKey);
  if (!section) return <View style={styles.container} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={styles.summary}>{section.summary}</Text>
      {section.key === "sleepRecovery" && <SleepReminderToggle />}
      {section.content ? (
        section.content.map((group) => (
          <View key={group.heading} style={styles.card}>
            <Text style={styles.heading}>{group.heading}</Text>
            {group.points.map((point) => (
              <Text key={point} style={styles.topic}>
                {"•"} {point}
              </Text>
            ))}
          </View>
        ))
      ) : (
        <View style={styles.card}>
          <Text style={styles.badge}>Coming soon</Text>
          <Text style={styles.cardText}>Your coach is putting this section together. It will cover:</Text>
          {section.topics.map((topic) => (
            <Text key={topic} style={styles.topic}>
              {"•"} {topic}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function SleepReminderToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    getSleepReminderEnabled().then(setEnabled);
  }, []);

  const onChange = (next: boolean) => {
    setEnabled(next);
    setSleepReminderEnabled(next);
    scheduleSleepReminders(next);
  };

  return (
    <View style={[styles.card, styles.toggleRow]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleTitle}>Nightly wind-down tip</Text>
        <Text style={styles.cardText}>A short sleep tip every evening at 6pm.</Text>
      </View>
      <Switch
        value={enabled ?? true}
        disabled={enabled === null}
        onValueChange={onChange}
        trackColor={{ true: BRAND_GOLD, false: "#334155" }}
        accessibilityLabel="Nightly wind-down tip"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  summary: { color: "#E2E8F0", fontSize: 16, lineHeight: 23, marginBottom: 20 },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginBottom: 12 },
  heading: { color: BRAND_GOLD, fontSize: 15, fontWeight: "700", marginBottom: 8 },
  badge: { color: BRAND_GOLD, fontSize: 12, fontWeight: "700", marginBottom: 8 },
  cardText: { color: "#94A3B8", fontSize: 14, lineHeight: 20, marginBottom: 10 },
  topic: { color: "#CBD5E1", fontSize: 14, lineHeight: 21, marginBottom: 6 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleTitle: { color: "#fff", fontSize: 15, fontWeight: "600", marginBottom: 2 },
});
