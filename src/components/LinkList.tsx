import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export type LinkItem = { key: string; title: string; icon: string; summary: string; onPress: () => void };

// A short page of one-tap links, each opening its own page. Used where several
// rarely-used menu lines share one line on the ☰ menu (GRIZZ, 2026-10-27).
export default function LinkList({ items }: { items: LinkItem[] }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={item.onPress}
          accessibilityRole="button"
          accessibilityLabel={item.title}
        >
          <View style={styles.icon}>
            <Text style={styles.iconText}>{item.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.summary} numberOfLines={2}>
              {item.summary}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: "#1E293B", borderRadius: 12, padding: 12, marginBottom: 8 },
  rowPressed: { backgroundColor: "#334155" },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#0F172A", alignItems: "center", justifyContent: "center", marginRight: 12 },
  iconText: { fontSize: 18 },
  title: { color: "#fff", fontSize: 15, fontWeight: "700" },
  summary: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  chevron: { color: "#64748B", fontSize: 22, marginLeft: 8 },
});
