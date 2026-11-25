import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Pressable from "@/components/Pressable";
import { HeartRateSession, type HrStatus } from "@/screens/client/HeartRateScreen";
import { useWorkoutClient } from "@/context/LiveClientContext";
import { themeText, themedStyles } from "@/lib/theme";

// Heart rate in the trainer's live workout (GRIZZ, 2026-11-25): a ❤️ button in
// the header opens the client's heart rate zones and speedometer over the
// workout. "Back to the workout" tucks it away while the strap stays connected
// and the header keeps showing the live heart rate in its zone colour, so the
// trainer can log sets and still see it. Tap the heart rate to open it again.
// Hidden with height 0, never display:none (Android Modal rule).
export default function LiveHeartRateLayer() {
  const navigation = useNavigation();
  const { client } = useWorkoutClient();
  const first = client?.name.split(" ")[0] ?? "";
  const [started, setStarted] = useState(false);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<HrStatus>({ hr: null, colour: "#F1F5F9", running: false });

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          style={[styles.pill, status.running && { borderColor: status.colour }]}
          onPress={() => {
            setStarted(true);
            setOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={status.hr != null ? `Heart rate ${status.hr}` : "Heart rate"}
          hitSlop={6}
        >
          <Text style={[styles.pillText, status.running && { color: themeText(status.colour) }]}>
            ❤️ {status.running ? (status.hr ?? "–") : "HR"}
          </Text>
        </Pressable>
      ),
    });
  }, [navigation, status]);

  if (!started) return null;
  return (
    <View style={open ? styles.layer : styles.tucked} pointerEvents={open ? "auto" : "none"}>
      <View style={styles.bar}>
        <Text style={styles.barTitle} numberOfLines={1}>
          ❤️ Heart rate{first ? ` · ${first}` : ""}
        </Text>
        <Pressable style={styles.back} onPress={() => setOpen(false)} accessibilityRole="button">
          <Text style={styles.backText}>{status.running ? "Back to the workout" : "Hide"}</Text>
        </Pressable>
      </View>
      <View style={{ flex: 1 }}>
        <HeartRateSession
          mode="session"
          active={open}
          onStatus={setStatus}
          onClose={() => {
            setOpen(false);
            setStarted(false);
            setStatus({ hr: null, colour: "#F1F5F9", running: false });
          }}
        />
      </View>
    </View>
  );
}

const styles = themedStyles({
  layer: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "#0F172A", zIndex: 20, elevation: 20 },
  tucked: { position: "absolute", left: 0, right: 0, top: 0, height: 0, overflow: "hidden" },
  bar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#1E293B", gap: 10 },
  barTitle: { color: "#F1F5F9", fontSize: 16, fontWeight: "800", flex: 1 },
  back: { borderRadius: 10, borderWidth: 1, borderColor: "#334155", backgroundColor: "#1E293B", paddingVertical: 8, paddingHorizontal: 12 },
  backText: { color: "#F1F5F9", fontWeight: "700", fontSize: 14 },
  pill: { borderRadius: 16, borderWidth: 1, borderColor: "#334155", backgroundColor: "#1E293B", paddingVertical: 5, paddingHorizontal: 10, marginRight: 8 },
  pillText: { color: "#F1F5F9", fontWeight: "800", fontSize: 14 },
});
