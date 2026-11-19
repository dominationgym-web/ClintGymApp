import React from "react";
import { Modal, Pressable, Text } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { currencySymbol, suggestedRate } from "@/lib/clientPricing";
import { countryLabel } from "@/lib/countries";
import type { ClientRate } from "@/types/database";
import { themedStyles } from "@/lib/theme";

// Accepting an online client: Local or International prices (GRIZZ
// 2026-11-19, 0231). The one that fits the country they live in is marked.
export default function RatePicker({
  visible,
  name,
  residenceCountry,
  homeCountry,
  localCurrency,
  onPick,
  onCancel,
}: {
  visible: boolean;
  name: string;
  residenceCountry: string | null | undefined;
  homeCountry: string;
  localCurrency: string;
  onPick: (rate: ClientRate) => void;
  onCancel: () => void;
}) {
  const lives = countryLabel(residenceCountry);
  const fits = suggestedRate(residenceCountry, homeCountry);
  const options: { key: ClientRate; title: string; detail: string }[] = [
    { key: "local", title: `🏠 Local prices (${currencySymbol(localCurrency).trim()})`, detail: "Your own country's prices." },
    { key: "international", title: "🌍 International prices ($)", detail: "Dollar prices for clients who live abroad." },
  ];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.box} onPress={() => {}}>
          <Text style={styles.title}>Which prices for {name.split(" ")[0]}?</Text>
          <Text style={styles.lives}>{lives ? `Lives in ${lives}` : "They didn't give a country."}</Text>
          {options.map((o) => {
            const on = !!residenceCountry && o.key === fits;
            return (
              <Pressable key={o.key} style={[styles.option, on && styles.optionOn]} onPress={() => onPick(o.key)} accessibilityRole="button">
                <Text style={[styles.optionTitle, on && styles.optionTitleOn]}>
                  {o.title}
                  {on ? "  ✓ fits" : ""}
                </Text>
                <Text style={styles.optionDetail}>{o.detail}</Text>
              </Pressable>
            );
          })}
          <Text style={styles.message}>You can change this later under What they pay you on their profile.</Text>
          <Pressable onPress={onCancel} style={styles.cancel} hitSlop={8}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = themedStyles({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 20 },
  box: { backgroundColor: "#1E293B", borderRadius: 16, padding: 18, width: "100%", maxWidth: 380 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  lives: { color: "#E2E8F0", fontSize: 15, marginTop: 8 },
  message: { color: "#94A3B8", fontSize: 13, marginTop: 10 },
  option: { borderWidth: 1.5, borderColor: "#334155", borderRadius: 12, padding: 12, marginTop: 10 },
  optionOn: { borderColor: BRAND_GOLD },
  optionTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  optionTitleOn: { color: BRAND_GOLD },
  optionDetail: { color: "#94A3B8", fontSize: 12, marginTop: 3 },
  cancel: { alignSelf: "center", marginTop: 14 },
  cancelText: { color: "#94A3B8", fontWeight: "700", fontSize: 15 },
});
