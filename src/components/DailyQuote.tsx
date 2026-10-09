import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BRAND_GOLD } from "@/lib/brand";
import { quoteForDate } from "@/lib/dailyQuotes";
import { todayIso } from "@/lib/dates";

const SEEN_KEY = "dailyQuoteSeenOn";

// Today's line, as a card (on the client's Profile).
export function DailyQuoteCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>TODAY'S FUEL</Text>
      <Text style={styles.quote}>{quoteForDate(new Date())}</Text>
    </View>
  );
}

// Pops today's line up once a day, the first time the client opens the app.
// Remembered on the phone; if storage fails it simply doesn't pop up.
export function DailyQuotePopup() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if ((await AsyncStorage.getItem(SEEN_KEY)) === todayIso()) return;
        if (!cancelled) setVisible(true);
      } catch {
        // Nothing to do: the quote is still on the Profile tab.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const close = () => {
    setVisible(false);
    AsyncStorage.setItem(SEEN_KEY, todayIso()).catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.popup}>
          <Text style={styles.kicker}>TODAY'S FUEL</Text>
          <Text style={styles.popupQuote}>{quoteForDate(new Date())}</Text>
          <Pressable style={styles.button} onPress={close}>
            <Text style={styles.buttonText}>Let's go</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", padding: 24 },
  popup: { backgroundColor: "#0F172A", borderRadius: 16, padding: 24, borderWidth: 1.5, borderColor: BRAND_GOLD },
  popupQuote: { color: "#fff", fontSize: 22, fontWeight: "700", lineHeight: 30, marginBottom: 20 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center" },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
});
