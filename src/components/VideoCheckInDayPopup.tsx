import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { markClientContact } from "@/lib/checkinNudges";
import { canJoin, checkinClock, isUpcoming, todaysCheckin, whatsappLink } from "@/lib/videoCheckins";
import type { VideoCheckin } from "@/types/database";

type Shown = { checkin: VideoCheckin; name: string; phone: string | null; more: number };

// The pop-up on the day of a video check-in (GRIZZ, 2026-10-25: "maybe a
// constant pop up on the day to remind both"). It sits over every screen
// from the morning until the call is over; ✕ hides it until the app is next
// opened or brought back, when it shows again. A floating card, not a Modal,
// so it never stacks with the daily check-in pop-up or blocks taps.
export default function VideoCheckInDayPopup({ who }: { who: "client" | "trainer" }) {
  const { client, trainer } = useAuth();
  const me = who === "client" ? client?.id : trainer?.id;
  const coachId = client?.trainer_id;
  const navigation = useNavigation<{ navigate: (screen: string) => void }>();
  const insets = useSafeAreaInsets();
  const [shown, setShown] = useState<Shown | null>(null);
  const [hidden, setHidden] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const loading = useRef(false);

  const check = useCallback(async () => {
    if (!me || loading.current) return;
    loading.current = true;
    try {
      const at = new Date();
      setNow(at);
      const { data } = await supabase
        .from("video_checkins")
        .select("*")
        .eq(who === "client" ? "client_id" : "trainer_id", me)
        .eq("status", "confirmed")
        .gte("starts_at", new Date(at.getTime() - 3 * 3600000).toISOString())
        .lte("starts_at", new Date(at.getTime() + 24 * 3600000).toISOString())
        .order("starts_at");
      const today = todaysCheckin(data ?? [], at);
      if (!today) {
        setShown(null);
        return;
      }
      const more = (data ?? []).filter((v) => v.id !== today.id && todaysCheckin([v], at)).length;
      if (who === "client") {
        const { data: s } = await supabase.from("video_checkin_settings").select("whatsapp").eq("trainer_id", coachId ?? "").maybeSingle();
        setShown({ checkin: today, name: "your coach", phone: s?.whatsapp ?? null, more });
      } else {
        const { data: c } = await supabase.from("clients").select("name, phone").eq("id", today.client_id).maybeSingle();
        setShown({ checkin: today, name: c?.name?.split(" ")[0] ?? "a client", phone: c?.phone ?? null, more });
      }
    } finally {
      loading.current = false;
    }
  }, [me, who, coachId]);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        // Back in the app: show it again.
        setHidden(false);
        check();
      }
    });
    // Keeps the time and the WhatsApp button current, and goes once the call's over.
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [check]);

  if (!shown || hidden || !isUpcoming(shown.checkin, now)) return null;
  const { checkin, name, phone, more } = shown;
  const time = checkinClock(checkin.starts_at);
  const live = canJoin(checkin, now);
  const link = whatsappLink(phone);

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 60 }]}>
      <View style={[styles.card, live && styles.cardLive]}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => navigation.navigate(who === "client" ? "VideoCheckIn" : "VideoCheckIns")}
          accessibilityRole="button"
        >
          <Text style={styles.title}>
            📹 {live ? "Video check-in now" : `Video check-in today at ${time}`}
          </Text>
          <Text style={styles.body}>
            {who === "client"
              ? live
                ? "Your coach will video call you on WhatsApp."
                : `With ${name} on WhatsApp. Keep your phone close.`
              : `With ${name}${live ? ` at ${time}` : ""}.${more ? ` +${more} more today.` : ""}`}
          </Text>
        </Pressable>
        {link && (
          <Pressable style={styles.whatsapp} onPress={() => {
              if (who === "trainer") markClientContact(checkin.client_id);
              Linking.openURL(link);
            }}
            accessibilityLabel={`WhatsApp ${name}`}>
            <Text style={styles.whatsappText}>💬</Text>
          </Pressable>
        )}
        <Pressable onPress={() => setHidden(true)} hitSlop={10} accessibilityLabel="Hide until I next open the app">
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 12, right: 12, zIndex: 50, elevation: 50 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#1E293B",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND_GOLD,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  cardLive: { borderColor: "#22C55E" },
  title: { color: "#fff", fontSize: 15, fontWeight: "700" },
  body: { color: "#CBD5E1", fontSize: 13, marginTop: 2 },
  whatsapp: { backgroundColor: "#22C55E", borderRadius: 999, width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  whatsappText: { fontSize: 18 },
  close: { color: "#94A3B8", fontSize: 18, fontWeight: "700", paddingHorizontal: 4 },
});
