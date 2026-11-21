import React from "react";
import { Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Pressable from "@/components/Pressable";
import { useAuth } from "@/context/AuthContext";
import { badgeText, useInboxUnread } from "@/lib/inbox";
import { navigationRef } from "@/navigation/navigationRef";
import { BRAND_GOLD } from "@/lib/brand";
import { themeText, themedStyles } from "@/lib/theme";

// The 🔔 at the top of every main page (0232): opens the inbox, with a red
// count of unread messages and notifications.
export default function InboxButton() {
  const { session } = useAuth();
  const count = useInboxUnread(session?.user?.id);
  const badge = badgeText(count);
  return (
    <Pressable
      onPress={() => navigationRef.navigate("Inbox")}
      hitSlop={10}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel={badge ? `Messages and notifications, ${count} new` : "Messages and notifications"}
    >
      <Ionicons name={badge ? "notifications" : "notifications-outline"} size={23} color={themeText(badge ? BRAND_GOLD : "#fff")} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** The same count, for the laptop sidebar's "Messages" line. */
export function InboxCountPill() {
  const { session } = useAuth();
  const badge = badgeText(useInboxUnread(session?.user?.id));
  if (!badge) return null;
  return (
    <View style={styles.pill}>
      <Text style={styles.badgeText}>{badge}</Text>
    </View>
  );
}

const styles = themedStyles({
  button: { marginRight: 16, paddingVertical: 2 },
  badge: {
    position: "absolute",
    top: -5,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    marginLeft: "auto",
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  // White on red in both modes.
}, ["badge", "pill", "badgeText"]);
