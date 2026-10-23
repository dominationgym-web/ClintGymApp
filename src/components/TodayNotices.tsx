import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ClientStackParamList } from "@/navigation/types";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { todayIso } from "@/lib/dates";
import { planEndingSoon, planEndingWhen } from "@/lib/planEnding";
import NotificationsPrompt from "@/components/NotificationsPrompt";
import WatchLinkPrompt from "@/components/WatchLinkPrompt";
import SleepReminder from "@/components/SleepReminder";
import ResetReminderBanner from "@/components/reset/ResetReminderBanner";
import ProgressPhotoReminder from "@/components/ProgressPhotoReminder";
import { CycleTodayBanner } from "@/components/CycleTracker";
import { CoachMessageCard } from "@/components/CoachMessages";

// What sits above the check-in (app-flow review C3, 2026-10-18). Up to seven
// cards used to stack there and push the first question off the screen. Now:
// messages from the coach first, then the plan-ending banner in its last week
// (C8), then every other reminder behind one tap-to-open line ("3 things for
// today ›"). A single reminder just shows.
//
// Each reminder decides for itself whether it has anything to say, so they
// all stay mounted (they also top up the phone's notifications) and the line
// counts the ones that took up space.
export default function TodayNotices({ extra }: { extra?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [heights, setHeights] = useState<Record<number, number>>({});
  const items = [
    <NotificationsPrompt key="n" who="client" />,
    <WatchLinkPrompt key="w" />,
    <SleepReminder key="s" />,
    <CycleTodayBanner key="c" />,
    <ResetReminderBanner key="r" />,
    <ProgressPhotoReminder key="p" />,
    ...(extra ? [<React.Fragment key="x">{extra}</React.Fragment>] : []),
  ];
  const count = Object.values(heights).filter((h) => h > 0).length;
  const folded = count > 1 && !open;
  return (
    <>
      <CoachMessageCard />
      <PlanEndingBanner />
      {count > 1 && (
        <Pressable style={styles.line} onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
          <Text style={styles.lineText}>📌 {count} things for today</Text>
          <Text style={styles.lineOpen}>{open ? "Close ▴" : "Open ›"}</Text>
        </Pressable>
      )}
      <View
        style={folded ? styles.hidden : null}
        pointerEvents={folded ? "none" : "auto"}
        accessibilityElementsHidden={folded}
        importantForAccessibility={folded ? "no-hide-descendants" : "auto"}
      >
        {items.map((item, i) => (
          <View
            key={i}
            onLayout={(e) => {
              const h = Math.round(e.nativeEvent.layout.height);
              setHeights((prev) => (prev[i] === h ? prev : { ...prev, [i]: h }));
            }}
          >
            {item}
          </View>
        ))}
      </View>
    </>
  );
}

/** In the last 7 days of the plan: "Your plan ends on …. Tap to pay", opening Profile → Paying your trainer. */
function PlanEndingBanner() {
  const { client } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const ending = planEndingSoon(client?.plan_expires_at, todayIso());
  if (!ending) return null;
  return (
    <Pressable
      style={styles.plan}
      onPress={() => navigation.navigate("ClientTabs", { screen: "Profile", params: { open: "pay" } })}
      accessibilityRole="button"
    >
      <Text style={styles.planTitle}>💳 Your plan ends {planEndingWhen(ending)}</Text>
      <Text style={styles.planText}>Renew with your trainer before then to keep your access. Tap to see how to pay.</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hidden: { height: 0, overflow: "hidden" },
  line: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1E293B",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  lineText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  lineOpen: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14 },
  plan: { backgroundColor: "#1E293B", borderLeftWidth: 4, borderLeftColor: "#F59E0B", borderRadius: 8, padding: 12, marginBottom: 14 },
  planTitle: { color: "#fff", fontWeight: "700", marginBottom: 4 },
  planText: { color: "#E2E8F0" },
});
