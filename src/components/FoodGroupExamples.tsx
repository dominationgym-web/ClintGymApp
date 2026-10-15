import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { FOOD_GROUP_EXAMPLES } from "@/lib/nutrition";

// A quick visual of each food group on the Nutrition page: what it looks like,
// how much (in hand portions) and some examples.
export default function FoodGroupExamples() {
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Build your plate</Text>
      {FOOD_GROUP_EXAMPLES.map((g) => (
        <View key={g.title} style={styles.row}>
          <Text style={styles.emojis}>{g.emojis}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              {g.title} <Text style={styles.portion}>· {g.portion}</Text>
            </Text>
            <Text style={styles.examples}>{g.examples}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginBottom: 12 },
  heading: { color: BRAND_GOLD, fontSize: 15, fontWeight: "700", marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  emojis: { fontSize: 22, width: 118 },
  title: { color: "#fff", fontSize: 15, fontWeight: "700" },
  portion: { color: BRAND_GOLD, fontWeight: "600", fontSize: 13 },
  examples: { color: "#94A3B8", fontSize: 13, lineHeight: 18, marginTop: 2 },
});
