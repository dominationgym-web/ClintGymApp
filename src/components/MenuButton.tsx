import React, { useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SearchButton from "@/components/SearchButton";

export type MenuItem = { key: string; title: string; summary: string; icon?: string; onPress: () => void };

// The search button and the "three lines" menu button in the top right of
// every tab. The menu drops down a list of extra pages that don't warrant
// their own tab at the bottom.
export default function MenuButton({ items }: { items: MenuItem[] }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.row}>
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
          <Pressable style={[styles.menu, { marginTop: insets.top + 52 }]}>
            <Text style={styles.menuHeading}>More</Text>
            {items.map((item) => (
              <Pressable
                key={item.key}
                style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                onPress={() => {
                  setOpen(false);
                  item.onPress();
                }}
                accessibilityRole="button"
              >
                {item.icon ? (
                  <View style={styles.itemIcon}>
                    <Text style={styles.itemIconText}>{item.icon}</Text>
                  </View>
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemSummary}>{item.summary}</Text>
                </View>
              </Pressable>
            ))}
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
    width: 300,
    backgroundColor: "#1E293B",
    borderRadius: 12,
    paddingVertical: 8,
  },
  menuHeading: { color: "#64748B", fontSize: 12, fontWeight: "700", paddingHorizontal: 16, paddingVertical: 8 },
  item: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  itemIconText: { fontSize: 20 },
  itemPressed: { backgroundColor: "#334155" },
  itemTitle: { color: "#fff", fontSize: 16, fontWeight: "600" },
  itemSummary: { color: "#94A3B8", fontSize: 13, marginTop: 2 },
});
