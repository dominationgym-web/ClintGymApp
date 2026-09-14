import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useAuth } from "@/context/AuthContext";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  expiring_soon: "Expiring soon",
  expired: "Expired",
};

export default function ClientProfileScreen() {
  const { client, signOut } = useAuth();

  if (!client) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>{client.name}</Text>
      <Text style={styles.email}>{client.email}</Text>

      <View style={[styles.statusPill, statusStyle(client.access_status)]}>
        <Text style={styles.statusText}>{STATUS_LABEL[client.access_status]}</Text>
      </View>

      {client.plan_expires_at && (
        <Text style={styles.helper}>Plan renews/expires {new Date(client.plan_expires_at).toLocaleDateString()}</Text>
      )}

      <Text style={styles.sectionHeading}>Goals</Text>
      <Text style={styles.body}>{client.goals || "Not set yet - your trainer will add this."}</Text>

      <Text style={styles.sectionHeading}>Injuries / notes for your trainer</Text>
      <Text style={styles.body}>{client.injuries || "None on file."}</Text>

      <Pressable style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

function statusStyle(status: string) {
  switch (status) {
    case "active":
      return { backgroundColor: "#22C55E" };
    case "expiring_soon":
      return { backgroundColor: "#F59E0B" };
    default:
      return { backgroundColor: "#EF4444" };
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  title: { fontSize: 26, fontWeight: "700", color: "#fff" },
  email: { color: "#94A3B8", marginBottom: 12 },
  statusPill: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginBottom: 8 },
  statusText: { color: "#0F172A", fontWeight: "700", fontSize: 12 },
  helper: { color: "#64748B", fontSize: 12, marginBottom: 16 },
  sectionHeading: { color: "#94A3B8", fontWeight: "600", marginTop: 16, marginBottom: 6 },
  body: { color: "#E2E8F0", fontSize: 14, lineHeight: 20 },
  button: {
    backgroundColor: "#334155",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 32,
  },
  buttonText: { color: "#fff", fontWeight: "600" },
});
