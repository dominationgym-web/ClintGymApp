import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ClientStackParamList } from "@/navigation/types";
import { findSection } from "@/lib/sections";

type Props = NativeStackScreenProps<ClientStackParamList, "Section">;

// One of the menu sections. Until the coach adds the content, it shows what
// the section will cover so clients know what's on the way.
export default function SectionScreen({ route }: Props) {
  const section = findSection(route.params.sectionKey);
  if (!section) return <View style={styles.container} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.summary}>{section.summary}</Text>
      <View style={styles.card}>
        <Text style={styles.badge}>Coming soon</Text>
        <Text style={styles.cardText}>Your coach is putting this section together. It will cover:</Text>
        {section.topics.map((topic) => (
          <Text key={topic} style={styles.topic}>
            {"•"} {topic}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  summary: { color: "#E2E8F0", fontSize: 16, lineHeight: 23, marginBottom: 20 },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16 },
  badge: { color: "#22C55E", fontSize: 12, fontWeight: "700", marginBottom: 8 },
  cardText: { color: "#94A3B8", fontSize: 14, lineHeight: 20, marginBottom: 10 },
  topic: { color: "#CBD5E1", fontSize: 14, lineHeight: 24 },
});
