import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import ClientListPanel from "@/components/ClientListPanel";
import { useWideScreen } from "@/hooks/useWideScreen";
import type { TrainerTabScreenProps } from "@/navigation/types";

type Props = TrainerTabScreenProps<"Clients">;

export default function ClientsScreen({ navigation }: Props) {
  const wide = useWideScreen();
  // Reload on coming back, e.g. after archiving a client from their page.
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => navigation.addListener("focus", () => setReloadKey((k) => k + 1)), [navigation]);

  // On a laptop the list is already down the side (TrainerNavigator), so this
  // space is where a client's page opens.
  if (wide) {
    return (
      <View style={styles.pick}>
        <Text style={styles.pickIcon}>👈</Text>
        <Text style={styles.pickTitle}>Pick a client</Text>
        <Text style={styles.pickText}>Their page opens here, with the list staying beside it.</Text>
      </View>
    );
  }
  return (
    <ClientListPanel reloadKey={reloadKey} onOpen={(clientId) => navigation.navigate("ClientDetail", { clientId })} />
  );
}

const styles = StyleSheet.create({
  pick: { flex: 1, backgroundColor: "#0F172A", alignItems: "center", justifyContent: "center", padding: 24 },
  pickIcon: { fontSize: 40, marginBottom: 12 },
  pickTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  pickText: { color: "#94A3B8", marginTop: 6, textAlign: "center" },
});
