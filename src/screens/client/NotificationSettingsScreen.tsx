import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Switch, Text, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import {
  ALWAYS_ON_NOTIFICATIONS,
  NOTIFICATION_GROUPS,
  loadNotificationPrefs,
  saveNotificationPrefs,
  type NotificationGroup,
  type NotificationPrefs,
} from "@/lib/notificationPrefs";
import { cancelRemindersForGroups } from "@/lib/notifications";
import NotificationsPrompt from "@/components/NotificationsPrompt";
import { themeBg, themeText, themedStyles } from "@/lib/theme";

// Menu > Notifications (GRIZZ, 2026-10-26): one switch per group, so a client
// who finds the reminders too much can keep only the ones they want.
export default function NotificationSettingsScreen() {
  const { client } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [saving, setSaving] = useState<NotificationGroup | null>(null);

  useEffect(() => {
    if (!client) return;
    loadNotificationPrefs(client.id).then(setPrefs);
  }, [client]);

  const groups = NOTIFICATION_GROUPS.filter((g) => !g.womenOnly || client?.sex === "female");

  const toggle = async (group: NotificationGroup, on: boolean) => {
    if (!client || !prefs) return;
    const before = prefs;
    const next = { ...prefs, [group]: on };
    setPrefs(next);
    setSaving(group);
    try {
      await saveNotificationPrefs(client.id, next);
      if (!on) await cancelRemindersForGroups([group]);
    } catch (e) {
      setPrefs(before);
      Alert.alert("Couldn't save", "Check your connection and try again.");
      console.warn("Couldn't save the notification settings", e);
    } finally {
      setSaving(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <NotificationsPrompt who="client" />
      <Text style={styles.intro}>
        Choose which reminders you get on your phone. Anything you switch off still shows in the app when you open it.
      </Text>

      {!prefs ? (
        <ActivityIndicator color={themeText(BRAND_GOLD)} style={styles.loading} />
      ) : (
        groups.map((g) => (
          <View key={g.key} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.title}>
                {g.icon} {g.title}
              </Text>
              <Switch
                value={prefs[g.key]}
                onValueChange={(on) => toggle(g.key, on)}
                disabled={saving !== null}
                trackColor={{ true: themeBg(BRAND_GOLD), false: themeBg("#334155") }}
                accessibilityLabel={g.title}
              />
            </View>
            <Text style={styles.includes}>{g.includes}</Text>
          </View>
        ))
      )}

      <View style={[styles.card, styles.always]}>
        <Text style={styles.title}>🔒 Always on</Text>
        <Text style={styles.includes}>{ALWAYS_ON_NOTIFICATIONS}</Text>
      </View>
    </ScrollView>
  );
}

const styles = themedStyles({
  container: { flex: 1, backgroundColor: "#0F172A" },
  content: { padding: 16, paddingBottom: 40 },
  intro: { color: "#CBD5E1", fontSize: 14, lineHeight: 20, marginBottom: 14 },
  loading: { marginVertical: 24 },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginBottom: 10 },
  always: { borderWidth: 1, borderColor: "#334155", backgroundColor: "#0F172A" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  title: { color: "#fff", fontWeight: "700", fontSize: 16, flexShrink: 1 },
  includes: { color: "#94A3B8", fontSize: 13, lineHeight: 18, marginTop: 6 },
});
