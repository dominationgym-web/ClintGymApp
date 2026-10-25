import React, { useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { View, Text, Pressable, Modal, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SearchButton from "@/components/SearchButton";
import ChatButton from "@/components/chat/ChatButton";
import { markOpenedFromMenu, takeMenuReturn } from "@/lib/menuReturn";

export type MenuItem = { key: string; title: string; summary: string; icon?: string; onPress: () => void };

// The search button and the "three lines" menu button in the top right of
// every tab. The menu drops down a list of extra pages that don't warrant
// their own tab at the bottom. Condensed to one short line per topic so every
// topic shows at once with no scrolling; the page only opens when its topic is
// tapped (GRIZZ, 2026-10-19). The summary is kept for screen readers.
export default function MenuButton({ items }: { items: MenuItem[] }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const { height, width } = useWindowDimensions();
  const navigation = useNavigation();

  // Coming back from a page opened here shows the menu again, so back is one
  // step at a time (GRIZZ, 2026-10-12). Pressing back again closes the menu.
  useEffect(
    () =>
      navigation.addListener("focus", () => {
        if (takeMenuReturn()) setOpen(true);
      }),
    [navigation],
  );

  return (
    <View style={styles.row}>
      <ChatButton />
      <SearchButton />
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={10}
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel="Open menu"
      >
        <View style={styles.bar} />
        <View style={styles.bar} />
        <View style={styles.bar} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close menu">
          {/* A Pressable with no onPress, so taps on the menu itself don't close it. */}
          {/* Scrolls when it doesn't fit, for example with large phone fonts (GRIZZ, 2026-10-12). */}
          <Pressable
            style={[
              styles.menu,
              { marginTop: insets.top + 52, maxHeight: height - insets.top - insets.bottom - 72, width: Math.min(340, width - 24) },
            ]}
          >
            <Text style={styles.menuHeading}>More</Text>
            <ScrollView bounces={false}>
              {items.map((item) => (
                <Pressable
                  key={item.key}
                  style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                  onPress={() => {
                    setOpen(false);
                    markOpenedFromMenu();
                    item.onPress();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                  accessibilityHint={item.summary}
                >
                  {item.icon ? (
                    <View style={styles.itemIcon}>
                      <Text style={styles.itemIconText}>{item.icon}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  button: { marginRight: 16, paddingVertical: 4, gap: 4 },
  bar: { width: 22, height: 2.5, borderRadius: 2, backgroundColor: "#fff" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "flex-end" },
  menu: {
    marginRight: 12,
    backgroundColor: "#1E293B",
    borderRadius: 12,
    paddingVertical: 8,
  },
  menuHeading: { color: "#64748B", fontSize: 12, fontWeight: "700", paddingHorizontal: 16, paddingVertical: 8 },
  item: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 7 },
  itemIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  itemIconText: { fontSize: 17 },
  itemPressed: { backgroundColor: "#334155" },
  itemTitle: { flex: 1, color: "#fff", fontSize: 15, fontWeight: "600" },
  chevron: { color: "#64748B", fontSize: 20, marginLeft: 8 },
});
