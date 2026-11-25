import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import Pressable from "@/components/Pressable";
import { ScrollView } from "@/components/ScrollView";
import SafeBottom from "@/components/SafeBottom";
import KeepScreenOn from "@/components/KeepScreenOn";
import HeartRateGauge from "@/components/HeartRateGauge";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { success, tick } from "@/lib/haptics";
import { toast } from "@/lib/toast";
import { useStepBack } from "@/hooks/useStepBack";
import {
  EMPTY_TALLY,
  HR_EXERCISES,
  HR_GOALS,
  addSecond,
  buildZones,
  clock,
  inputsFromSaved,
  restingFromSamples,
  zoneForGoal,
  zoneHint,
  type HrInputs,
  type HrTally,
} from "@/lib/heartRateZones";
import { connectStrap, lastStrap, scanForStraps, strapSupported, type FoundStrap, type ScanProblem, type StrapConnection } from "@/lib/heartRateStrap";
import { MONITOR_BRANDS } from "@/lib/watchBroadcast";
import type { ClientStackParamList } from "@/navigation/types";
import type { ClientHrZones } from "@/types/database";
import { themeText, themedStyles } from "@/lib/theme";

// Live heart rate (GRIZZ, 2026-11-25): connect a chest strap, arm band or a
// watch with heart rate broadcast on (tap-through steps per brand), then the
// speedometer glides with each beat and says Speed up a little, HOLD THIS ZONE
// or Ease off a little, counting time in the zone, calories and fat. Finish
// saves it as Other exercise, so the trainer sees it. mode "resting" measures
// their resting heart rate instead: sit still for a minute.

type Phase = "connect" | "scanning" | "connecting" | "live" | "resting" | "done";
const RESTING_SECONDS = 60;

const PROBLEM_TEXT: Record<ScanProblem, string> = {
  not_here: "This needs the newest version of the app.",
  permission: "The app needs Bluetooth permission to find your monitor. Allow it in your phone's settings for Daily Evolution, then try again.",
  bluetooth_off: "Bluetooth is off. Turn it on in your phone's settings, then try again.",
  failed: "Couldn't search for monitors. Try again.",
};

export default function HeartRateScreen() {
  const { client } = useAuth();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ClientStackParamList, "HeartRate">>();
  const mode = route.params?.mode ?? "session";
  const supported = useMemo(() => strapSupported(), []);

  const [row, setRow] = useState<ClientHrZones | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [phase, setPhase] = useState<Phase>("connect");
  const [brand, setBrand] = useState<string | null>(null);
  const [found, setFound] = useState<FoundStrap[]>([]);
  const [problem, setProblem] = useState<ScanProblem | null>(null);
  const [last, setLast] = useState<FoundStrap | null>(null);
  const [strap, setStrap] = useState<FoundStrap | null>(null);
  const [hr, setHr] = useState<number | null>(null);
  const [lost, setLost] = useState(false);
  const [paused, setPaused] = useState(false);
  const [tally, setTally] = useState<HrTally>(EMPTY_TALLY);
  const [restSamples, setRestSamples] = useState<number[]>([]);
  const [restResult, setRestResult] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const stopScan = useRef<() => void>(() => undefined);
  const conn = useRef<StrapConnection | null>(null);
  const latest = useRef<{ bpm: number; at: number } | null>(null);
  const wasIn = useRef(false);

  useEffect(() => {
    if (!client) return;
    supabase
      .from("client_hr_zones")
      .select("*")
      .eq("client_id", client.id)
      .maybeSingle()
      .then(({ data }) => {
        setRow((data as ClientHrZones | null) ?? null);
        setLoaded(true);
      });
    lastStrap().then(setLast);
  }, [client]);

  useEffect(
    () => () => {
      stopScan.current();
      conn.current?.disconnect();
    },
    [],
  );

  const inputs: HrInputs | null = row?.sent_at ? inputsFromSaved(row) : null;
  const zones = useMemo(() => (inputs ? buildZones(inputs) : null), [row]); // eslint-disable-line react-hooks/exhaustive-deps
  const target = zones ? zoneForGoal(zones, row?.goal ?? "fat") : null;
  const goalLabel = HR_GOALS.find((g) => g.key === (row?.goal ?? "fat"))?.label ?? "";

  const onBeat = useCallback((bpm: number) => {
    latest.current = { bpm, at: Date.now() };
    setHr(bpm);
    setLost(false);
  }, []);

  const connect = async (s: FoundStrap) => {
    stopScan.current();
    setStrap(s);
    setPhase("connecting");
    const c = await connectStrap(s, onBeat, () => {
      setLost(true);
      // Try to get it back (out of range for a moment, or a loose strap).
      setTimeout(() => reconnect(s), 3000);
    });
    if (!c) {
      setPhase("connect");
      return Alert.alert("Couldn't connect", "Make sure it's on (wet the strap pads, or turn on broadcast on the watch), keep it close and try again.");
    }
    conn.current = c;
    setPhase(mode === "resting" ? "resting" : "live");
  };

  const reconnect = async (s: FoundStrap) => {
    if (!conn.current) return;
    conn.current.disconnect();
    const c = await connectStrap(s, onBeat, () => {
      setLost(true);
      setTimeout(() => reconnect(s), 3000);
    });
    if (c) conn.current = c;
  };

  const startScan = async () => {
    setFound([]);
    setProblem(null);
    setPhase("scanning");
    stopScan.current = await scanForStraps(
      (s) => setFound((f) => [...f, s]),
      (p) => {
        setProblem(p);
        setPhase("connect");
      },
    );
  };

  // A second at a time: time in the zone, calories and fat (only with a fresh reading).
  useEffect(() => {
    if (phase !== "live" || paused || !inputs || !target) return;
    const t = setInterval(() => {
      const l = latest.current;
      if (!l || Date.now() - l.at > 5000) return;
      setTally((prev) => addSecond(prev, l.bpm, inputs, target));
      const isIn = l.bpm >= target.low && l.bpm <= target.high;
      if (isIn && !wasIn.current) success();
      wasIn.current = isIn;
    }, 1000);
    return () => clearInterval(t);
  }, [phase, paused, row]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resting: a minute of readings, then the lowest 20-second average.
  useEffect(() => {
    if (phase !== "resting" || restResult != null) return;
    const t = setInterval(() => {
      const l = latest.current;
      if (!l || Date.now() - l.at > 5000) return;
      setRestSamples((s) => {
        const next = [...s, l.bpm];
        if (next.length >= RESTING_SECONDS) {
          setRestResult(restingFromSamples(next));
          tick();
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, restResult]);

  const leave = () => {
    stopScan.current();
    conn.current?.disconnect();
    conn.current = null;
    navigation.goBack();
  };

  const finish = async () => {
    conn.current?.disconnect();
    conn.current = null;
    setPhase("done");
    if (!client || tally.seconds < 60 || !target) return;
    setSaving(true);
    const kind = HR_EXERCISES.find((e) => e.key === row?.exercise)?.activity ?? "other";
    const avg = Math.round(tally.hrSum / Math.max(1, tally.samples));
    const share = tally.inZoneSeconds / tally.seconds;
    const { error } = await supabase.from("client_activities").insert({
      client_id: client.id,
      kind,
      name: "Heart rate session",
      minutes: Math.max(1, Math.round(tally.seconds / 60)),
      avg_hr: avg,
      effort: target.key === "calories" || target.key === "speed" ? "hard" : target.key === "fat" || target.key === "recover" ? "easy" : "moderate",
      notes: `❤️ ${clock(tally.inZoneSeconds)} in ${target.name} (${Math.round(share * 100)}% of the time) · ~${Math.round(tally.kcal)} kcal · ~${Math.round(tally.fatG)} g fat`,
    });
    setSaving(false);
    if (error) Alert.alert("Couldn't save the session", error.message);
    else toast("Saved", "Your coach can see it under Other exercise.");
  };

  const saveResting = async () => {
    if (restResult == null) return;
    setSaving(true);
    const { error } = await supabase.rpc("set_my_resting_hr", { p_bpm: restResult });
    setSaving(false);
    if (error) return Alert.alert("Couldn't save it", error.message);
    toast("Saved", `Resting heart rate ${restResult}. Your coach will use it for your zones.`);
    leave();
  };

  // Back closes the brand steps first, then the scan list.
  useStepBack(phase === "connect" && brand != null, () => setBrand(null));
  useStepBack(phase === "scanning", () => {
    stopScan.current();
    setPhase("connect");
  });

  if (mode === "session" && !loaded) return <ActivityIndicator color={BRAND_GOLD} style={{ marginTop: 40 }} />;

  if (!supported)
    return (
      <View style={styles.page}>
        <View style={styles.content}>
          <Text style={styles.title}>Connect your heart rate monitor</Text>
          <Text style={styles.sub}>
            {Platform.OS === "web"
              ? "Live heart rate works in the Daily Evolution app on your phone, not on the website."
              : "Live heart rate comes with the next app update. Update Daily Evolution from the Play Store or App Store (or TestFlight), then come back here."}
          </Text>
        </View>
      </View>
    );

  // ---- Connect: which monitor, its steps, then find it ----
  if (phase === "connect" || phase === "scanning" || phase === "connecting") {
    const picked = MONITOR_BRANDS.find((b) => b.key === brand);
    return (
      <View style={styles.page}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>{mode === "resting" ? "Measure your resting heart rate" : "Connect your heart rate monitor"}</Text>
          {phase === "connecting" ? (
            <View style={styles.center}>
              <ActivityIndicator color={BRAND_GOLD} size="large" />
              <Text style={styles.sub}>Connecting to {strap?.name}…</Text>
            </View>
          ) : phase === "scanning" ? (
            <>
              <Text style={styles.sub}>Looking for monitors nearby. Tap yours when it shows up.</Text>
              {found.map((s) => (
                <Pressable key={s.id} style={styles.device} onPress={() => connect(s)} accessibilityRole="button">
                  <Text style={styles.deviceName}>❤️ {s.name}</Text>
                  <Text style={styles.deviceGo}>Connect</Text>
                </Pressable>
              ))}
              <View style={styles.searching}>
                <ActivityIndicator color={BRAND_GOLD} />
                <Text style={styles.sub}>Searching…</Text>
              </View>
              <Text style={styles.helper}>Nothing showing? Wet the strap pads, or check heart rate broadcast is on and the watch is on that screen.</Text>
            </>
          ) : picked ? (
            <>
              <Text style={styles.label}>{picked.name.toUpperCase()}</Text>
              {picked.steps.map((step, i) => (
                <View key={i} style={styles.step}>
                  <Text style={styles.stepNo}>{i + 1}</Text>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
              {!picked.comingSoon && <Text style={styles.helper}>Names can be slightly different on some models.</Text>}
              <Pressable style={styles.secondary} onPress={() => setBrand(null)} accessibilityRole="button">
                <Text style={styles.secondaryText}>‹ A different monitor</Text>
              </Pressable>
            </>
          ) : (
            <>
              {mode === "resting" && (
                <Text style={styles.sub}>Best first thing in the morning, before coffee. You'll sit still for a minute while it measures.</Text>
              )}
              {problem && <Text style={styles.problem}>{PROBLEM_TEXT[problem]}</Text>}
              {last && (
                <Pressable style={styles.device} onPress={() => connect(last)} accessibilityRole="button">
                  <Text style={styles.deviceName}>❤️ {last.name}</Text>
                  <Text style={styles.deviceGo}>Connect</Text>
                </Pressable>
              )}
              <Text style={styles.label}>WHICH DO YOU HAVE?</Text>
              <View style={styles.brands}>
                {MONITOR_BRANDS.map((b) => (
                  <Pressable key={b.key} style={[styles.brand, b.comingSoon && styles.brandSoon]} onPress={() => setBrand(b.key)} accessibilityRole="button">
                    <Text style={styles.brandText}>{b.name}</Text>
                    {b.comingSoon && <Text style={styles.soon}>Coming soon</Text>}
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </ScrollView>
        {(phase === "connect" && !(picked?.comingSoon ?? false)) && (
          <View style={styles.footer}>
            <Pressable style={styles.main} onPress={startScan} accessibilityRole="button">
              <Text style={styles.mainText}>Find my monitor</Text>
            </Pressable>
            <SafeBottom />
          </View>
        )}
      </View>
    );
  }

  // ---- Resting heart rate: sit still for a minute ----
  if (phase === "resting") {
    const left = RESTING_SECONDS - restSamples.length;
    return (
      <View style={styles.page}>
        <KeepScreenOn />
        <View style={[styles.content, styles.center, { flex: 1 }]}>
          {restResult == null ? (
            <>
              <Text style={styles.title}>Sit still and breathe normally</Text>
              <Text style={styles.big}>{hr ?? "–"}</Text>
              <Text style={styles.sub}>bpm now · {lost ? "lost the monitor, reconnecting…" : `${Math.max(0, left)} seconds to go`}</Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>Your resting heart rate</Text>
              <Text style={[styles.big, { color: themeText("#22C55E") }]}>{restResult}</Text>
              <Text style={styles.sub}>bpm. Your coach uses this to work out your zones.</Text>
            </>
          )}
        </View>
        <View style={styles.footer}>
          {restResult != null ? (
            <Pressable style={[styles.main, saving && { opacity: 0.6 }]} onPress={saveResting} disabled={saving} accessibilityRole="button">
              <Text style={styles.mainText}>{saving ? "Saving…" : "Save"}</Text>
            </Pressable>
          ) : restSamples.length >= RESTING_SECONDS ? (
            <Text style={styles.problem}>Couldn't get a steady reading. Check the monitor is snug and try again.</Text>
          ) : null}
          <Pressable style={styles.secondary} onPress={leave} accessibilityRole="button">
            <Text style={styles.secondaryText}>Cancel</Text>
          </Pressable>
          <SafeBottom />
        </View>
      </View>
    );
  }

  if (!zones || !target || !inputs) return null;

  // ---- Done ----
  if (phase === "done") {
    return (
      <View style={styles.page}>
        <View style={[styles.content, styles.center, { flex: 1 }]}>
          <Text style={styles.title}>Well done!</Text>
          <Text style={[styles.big, { color: themeText("#22C55E") }]}>{clock(tally.inZoneSeconds)}</Text>
          <Text style={styles.sub}>in {target.name}</Text>
          <View style={[styles.stats, { marginTop: 24, alignSelf: "stretch" }]}>
            <Stat value={clock(tally.seconds)} label="total" />
            <Stat value={`~${Math.round(tally.kcal)}`} label="kcal" />
            <Stat value={grams(tally.fatG)} label="fat burned" green />
          </View>
          {tally.seconds < 60 && <Text style={styles.helper}>Under a minute, so it wasn't saved.</Text>}
        </View>
        <View style={styles.footer}>
          <Pressable style={[styles.main, saving && { opacity: 0.6 }]} onPress={() => navigation.goBack()} disabled={saving} accessibilityRole="button">
            <Text style={styles.mainText}>{saving ? "Saving…" : "Done"}</Text>
          </Pressable>
          <SafeBottom />
        </View>
      </View>
    );
  }

  // ---- Live speedometer ----
  const hint = hr == null ? null : zoneHint(target, hr);
  const inZone = hint?.kind === "in";
  const hrColour = hint == null ? "#F1F5F9" : inZone ? "#22C55E" : hint.kind === "below" ? BRAND_GOLD : "#F97316";
  return (
    <View style={[styles.page, inZone && styles.pageIn]}>
      <KeepScreenOn />
      <View style={styles.liveTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.liveGoal}>{goalLabel}</Text>
          <Text style={styles.liveClock}>{clock(tally.seconds)}</Text>
        </View>
        <View style={styles.strapPill}>
          <View style={[styles.dot, lost && { backgroundColor: "#EF4444" }]} />
          <Text style={styles.strapText} numberOfLines={1}>
            {lost ? "Reconnecting…" : strap?.name}
          </Text>
        </View>
      </View>
      <View style={styles.targetBar}>
        <Text style={styles.targetLabel}>Your zone</Text>
        <Text style={styles.targetValue}>
          {target.name} · {target.low}–{target.high} bpm
        </Text>
      </View>
      <View style={styles.liveMid}>
        <HeartRateGauge zones={zones} target={target} hr={hr} />
        <Text style={[styles.liveHr, { color: themeText(hrColour) }]}>
          {hr ?? "–"}
          <Text style={styles.bpm}> bpm</Text>
        </Text>
        {hint == null ? (
          <Text style={styles.sub}>Waiting for your heart rate…</Text>
        ) : inZone ? (
          <>
            <View style={styles.holdBanner}>
              <Text style={styles.holdText}>HOLD THIS ZONE</Text>
            </View>
            <Text style={styles.sub}>Perfect pace. Keep it right here.</Text>
          </>
        ) : (
          <>
            <View style={[styles.hintBanner, { borderColor: hrColour }]}>
              <Text style={[styles.hintText, { color: themeText(hrColour) }]}>{hint.kind === "below" ? "▲ Speed up a little" : "▼ Ease off a little"}</Text>
            </View>
            <Text style={styles.sub}>
              {hint.kind === "below"
                ? `${hint.beats} more beat${hint.beats === 1 ? "" : "s"} to reach your zone`
                : `${hint.beats} beat${hint.beats === 1 ? "" : "s"} too high. Slow down to get back in.`}
            </Text>
          </>
        )}
        {paused && <Text style={styles.problem}>Paused</Text>}
      </View>
      <View style={styles.stats}>
        <Stat value={clock(tally.inZoneSeconds)} label="in zone" green />
        <Stat value={grams(tally.fatG)} label="fat burned" green />
        <Stat value={`~${Math.round(tally.kcal)}`} label="kcal" />
      </View>
      <View style={styles.buttons}>
        <Pressable style={styles.pause} onPress={() => setPaused((p) => !p)} accessibilityRole="button">
          <Text style={styles.pauseText}>{paused ? "Carry on" : "Pause"}</Text>
        </Pressable>
        <Pressable style={[styles.main, { flex: 1 }]} onPress={finish} accessibilityRole="button">
          <Text style={styles.mainText}>Finish</Text>
        </Pressable>
      </View>
      <SafeBottom />
    </View>
  );
}

/** Fat in grams: one decimal while it is small, so it visibly goes up. */
function grams(g: number): string {
  return g < 10 ? `~${g.toFixed(1)} g` : `~${Math.round(g)} g`;
}

function Stat({ value, label, green }: { value: string; label: string; green?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, green && { color: themeText("#22C55E") }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = themedStyles({
  page: { flex: 1, backgroundColor: "#0F172A" },
  pageIn: { backgroundColor: "#0D1F1E" },
  content: { padding: 16, paddingBottom: 24 },
  center: { alignItems: "center", justifyContent: "center" },
  title: { color: "#F1F5F9", fontSize: 22, fontWeight: "800", textAlign: "left" },
  sub: { color: "#94A3B8", fontSize: 15, marginTop: 6, lineHeight: 21, textAlign: "center" },
  helper: { color: "#94A3B8", fontSize: 13, marginTop: 10, lineHeight: 18 },
  problem: { color: "#F97316", fontSize: 14, fontWeight: "700", marginTop: 10, lineHeight: 20 },
  label: { color: "#94A3B8", fontSize: 13, fontWeight: "800", letterSpacing: 0.6, marginTop: 16, marginBottom: 8 },
  brands: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  brand: { width: "48.5%", minHeight: 56, borderRadius: 12, borderWidth: 1, borderColor: "#334155", backgroundColor: "#1E293B", padding: 10, justifyContent: "center" },
  brandSoon: { opacity: 0.75 },
  brandText: { color: "#F1F5F9", fontWeight: "700", fontSize: 14 },
  soon: { color: BRAND_GOLD, fontSize: 11, fontWeight: "800", marginTop: 2 },
  step: { flexDirection: "row", gap: 10, marginBottom: 10, alignItems: "flex-start" },
  stepNo: { color: "#0F172A", backgroundColor: BRAND_GOLD, width: 26, height: 26, borderRadius: 13, textAlign: "center", lineHeight: 26, fontWeight: "900", overflow: "hidden" },
  stepText: { color: "#F1F5F9", fontSize: 15, lineHeight: 21, flex: 1 },
  device: { flexDirection: "row", alignItems: "center", marginTop: 10, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: "#22C55E", backgroundColor: "#1E293B" },
  deviceName: { color: "#F1F5F9", fontWeight: "800", fontSize: 16, flex: 1 },
  deviceGo: { color: "#22C55E", fontWeight: "800", fontSize: 15 },
  searching: { flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", marginTop: 16 },
  secondary: { marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: "#334155", backgroundColor: "#1E293B", paddingVertical: 14, alignItems: "center" },
  secondaryText: { color: "#F1F5F9", fontWeight: "700", fontSize: 15 },
  footer: { paddingHorizontal: 16, paddingTop: 8 },
  main: { backgroundColor: BRAND_GOLD, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  mainText: { color: "#0F172A", fontWeight: "800", fontSize: 17 },
  big: { color: "#F1F5F9", fontSize: 84, fontWeight: "800", letterSpacing: -2, marginTop: 12 },
  liveTop: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12 },
  liveGoal: { color: "#94A3B8", fontSize: 15 },
  liveClock: { color: "#F1F5F9", fontSize: 18, fontWeight: "800" },
  strapPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#1E293B", borderRadius: 20, paddingVertical: 6, paddingHorizontal: 10, maxWidth: 170 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E" },
  strapText: { color: "#94A3B8", fontSize: 12 },
  targetBar: { marginHorizontal: 16, marginTop: 12, backgroundColor: "#1E293B", borderWidth: 1, borderColor: "#334155", borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, flexDirection: "row", justifyContent: "space-between", gap: 8 },
  targetLabel: { color: "#94A3B8", fontSize: 14 },
  targetValue: { color: BRAND_GOLD, fontSize: 14, fontWeight: "800", flexShrink: 1, textAlign: "right" },
  liveMid: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  liveHr: { fontSize: 84, fontWeight: "800", letterSpacing: -2, marginTop: -24 },
  bpm: { fontSize: 16, color: "#94A3B8", fontWeight: "600", letterSpacing: 0 },
  holdBanner: { marginTop: 12, backgroundColor: "#22C55E", borderRadius: 16, paddingVertical: 12, paddingHorizontal: 26, shadowColor: "#22C55E", shadowOpacity: 0.7, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  holdText: { color: "#0F172A", fontSize: 26, fontWeight: "900", letterSpacing: 1 },
  hintBanner: { marginTop: 12, borderWidth: 2, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 22 },
  hintText: { fontSize: 24, fontWeight: "900" },
  stats: { flexDirection: "row", paddingHorizontal: 16, marginBottom: 14 },
  stat: { flex: 1, alignItems: "center" },
  statValue: { color: "#F1F5F9", fontSize: 22, fontWeight: "800" },
  statLabel: { color: "#94A3B8", fontSize: 12 },
  buttons: { flexDirection: "row", gap: 12, paddingHorizontal: 16 },
  pause: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: "#334155", backgroundColor: "#1E293B", paddingVertical: 16, alignItems: "center" },
  pauseText: { color: "#F1F5F9", fontWeight: "800", fontSize: 17 },
});
