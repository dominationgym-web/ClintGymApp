import React from "react";
import { View, Text } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { quoteForDate } from "@/lib/dailyQuotes";
import { themedStyles } from "@/lib/theme";

// Today's line, as a card (on the client's Profile). The once-a-day pop-up
// is in DailyStartPopup.
export function DailyQuoteCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>TODAY'S FUEL</Text>
      <Text style={styles.quote}>{quoteForDate(new Date())}</Text>
    </View>
  );
}

const styles = themedStyles({
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: BRAND_GOLD,
  },
  kicker: { color: BRAND_GOLD, fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginBottom: 6 },
  quote: { color: "#fff", fontSize: 16, fontWeight: "600", lineHeight: 22 },
});
