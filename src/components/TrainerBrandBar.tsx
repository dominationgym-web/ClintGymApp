import React from "react";
import { Image, Text, View } from "react-native";
import { useTrainerBrand } from "@/hooks/useTrainerBrand";
import { themedStyles } from "@/lib/theme";

// The trainer's logo and name at the top of the client's Today tab, so the app
// feels like the trainer's own (GRIZZ, 2026-11-04). No logo: the DE logo.
export default function TrainerBrandBar() {
  const brand = useTrainerBrand();
  if (!brand) return null;
  return (
    <View style={styles.bar}>
      <Image
        source={brand.logoUrl ? { uri: brand.logoUrl } : require("../../assets/splash-icon.png")}
        style={[styles.logo, brand.logoUrl ? styles.round : null]}
        resizeMode={brand.logoUrl ? "cover" : "contain"}
        accessibilityLabel={brand.name}
      />
      <Text style={styles.name} numberOfLines={1}>
        {brand.name}
      </Text>
    </View>
  );
}

const styles = themedStyles({
  bar: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  logo: { width: 40, height: 40 },
  round: { borderRadius: 20 },
  name: { color: "#fff", fontSize: 17, fontWeight: "800", flex: 1 },
});
