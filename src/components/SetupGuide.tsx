import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Alert, AppState, Modal, Pressable, Share, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";
import { useTrainerSide } from "@/context/TrainerSideContext";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { navigationRef } from "@/navigation/navigationRef";
import { onPopupChange, popupOpen, setPopupOpen } from "@/lib/popupGate";
import {
  GUIDE_TITLE,
  activeGuide,
  guideKey,
  guideSteps,
  readGuideState,
  requestGuideOpen,
  shouldAutoStart,
  type GuideCheck,
  type GuideKind,
  type GuideState,
  type GuideStep,
} from "@/lib/setupGuide";
import { themedStyles } from "@/lib/theme";

// The setup guide for new trainers (GRIZZ, 2026-11-10). A welcome page, then
// one step at a time in a small card just above the tabs, so the trainer does
// each step on the real page. Later, Skip and ✕ are always there, and
// ☰ Menu › Setup guide starts it again.

type Ctx = {
  state: GuideState;
  // Which guide the card shows, if any.
  showing: GuideKind | null;
  small: boolean;
  setSmall: (v: boolean) => void;
  done: Partial<Record<GuideCheck, boolean>>;
  start: (kind: GuideKind) => void;
  next: () => void;
  back: () => void;
  stop: () => void;
  go: (step: GuideStep) => void;
};

const GuideContext = createContext<Ctx | null>(null);
export const useSetupGuide = () => useContext(GuideContext);

export function SetupGuideProvider({ children }: { children: React.ReactNode }) {
  const { trainer } = useAuth();
  const { side, setSide, evolutionOn, toggleEvolution } = useTrainerSide();
  const sideKind: GuideKind = side === "one" ? "one" : "evo";
  const [state, setState] = useState<GuideState | null>(null);
  const [intro, setIntro] = useState<GuideKind | null>(null);
  const [finished, setFinished] = useState<GuideKind | null>(null);
  const [small, setSmall] = useState(false);
  const [done, setDone] = useState<Partial<Record<GuideCheck, boolean>>>({});
  const trainerId = trainer?.id;

  const save = useCallback(
    (next: GuideState) => {
      setState(next);
      if (trainerId) AsyncStorage.setItem(guideKey(trainerId), JSON.stringify(next)).catch(() => {});
    },
    [trainerId],
  );

  // Load what's saved on this phone.
  useEffect(() => {
    if (!trainerId) return;
    AsyncStorage.getItem(guideKey(trainerId))
      .then((raw) => setState(readGuideState(raw)))
      .catch(() => setState({}));
  }, [trainerId]);

  // A new trainer (no session setup yet) gets the 1 on 1 guide straight away;
  // the Evolution guide starts the first time they're on a newly switched-on Evolution side.
  const checkedAuto = useRef<Record<GuideKind, boolean>>({ one: false, evo: false });
  useEffect(() => {
    if (!trainer || !trainer.approved || !state) return;
    const kind = sideKind;
    if (checkedAuto.current[kind]) return;
    checkedAuto.current[kind] = true;
    (async () => {
      let hasSettings = true;
      if (kind === "one") {
        const { data, error } = await supabase.from("session_settings").select("trainer_id").eq("trainer_id", trainer.id).maybeSingle();
        if (error) return;
        hasSettings = !!data;
      }
      if (shouldAutoStart(kind, state, trainer, { hasSettings, side: kind, evolutionOn })) {
        save({ ...state, [kind]: { step: 0, status: "running" } });
        setIntro(kind);
      }
    })();
  }, [trainer, state, sideKind, evolutionOn, save]);

  const showing = state ? activeGuide(state, sideKind) : null;
  const run = showing && state ? state[showing] : undefined;
  const steps = showing ? guideSteps(showing) : [];
  const step = run ? steps[run.step] : undefined;

  // Steps the app can check tick themselves.
  const check = useCallback(async () => {
    if (!trainerId || !step?.check) return;
    const count = async (table: "live_sessions" | "session_plans" | "diary_name_fees" | "session_settings") => {
      const { count: n } = await supabase.from(table).select("trainer_id", { count: "exact", head: true }).eq("trainer_id", trainerId);
      return (n ?? 0) > 0;
    };
    let ok = false;
    if (step.check === "settings") ok = await count("session_settings");
    else if (step.check === "sessions") ok = await count("live_sessions");
    else if (step.check === "prices") ok = (await count("session_plans")) || (await count("diary_name_fees"));
    else if (step.check === "clients") {
      const { count: n } = await supabase.from("clients").select("id", { count: "exact", head: true }).eq("trainer_id", trainerId).neq("id", trainerId);
      ok = (n ?? 0) > 0;
    }
    setDone((d) => (d[step.check!] === ok ? d : { ...d, [step.check!]: ok }));
  }, [trainerId, step]);
  useEffect(() => {
    if (!step?.check) return;
    check();
    // Every few seconds while the step is open, so it ticks once it's done.
    const timer = setInterval(check, 6000);
    const sub = AppState.addEventListener("change", (s) => s === "active" && check());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [step, check]);

  const start = useCallback(
    (kind: GuideKind) => {
      if (!state) return;
      save({ ...state, [kind]: { step: 0, status: "running" } });
      setSmall(false);
      // Wait for the menu to close: iPhone can't open a Modal while another is closing.
      setTimeout(() => setIntro(kind), 400);
    },
    [state, save],
  );

  const setStep = (n: number) => {
    if (!state || !showing) return;
    if (n >= steps.length) {
      save({ ...state, [showing]: { step: steps.length - 1, status: "done" } });
      setFinished(showing);
      return;
    }
    save({ ...state, [showing]: { step: Math.max(0, n), status: "running" } });
    setSmall(false);
  };

  // "Show me": the right side, the right tab, then open the page's part.
  const goFor = useCallback(
    (kind: GuideKind, s: GuideStep) => {
      const target = s.target;
      if (!target) return;
      const want = kind === "one" ? "one" : "evolution";
      const switching = side !== want;
      if (switching) setSide(want);
      setTimeout(
        () => {
          if (!navigationRef.isReady()) return;
          navigationRef.navigate("TrainerTabs", { screen: target.tab });
          const open = target.open;
          if (open) setTimeout(() => requestGuideOpen(open), 350);
        },
        switching ? 400 : 0,
      );
    },
    [side, setSide],
  );
  const go = useCallback((s: GuideStep) => showing && goFor(showing, s), [showing, goFor]);

  const stop = () => {
    if (!state || !showing || !run) return;
    const kind = showing;
    Alert.alert("Stop the setup guide?", "You can start it again any time: ☰ Menu › Setup guide.", [
      { text: "Keep going", style: "cancel" },
      { text: "Stop", onPress: () => save({ ...state, [kind]: { ...run, status: "stopped" } }) },
    ]);
  };

  // The welcome and finish pages wait for any other pop-up (referral, link a client).
  const [blocked, setBlocked] = useState(() => popupOpen("guide"));
  useEffect(() => onPopupChange(() => setBlocked(popupOpen("guide"))), []);
  const modalKind = finished ?? intro;
  const modalVisible = !!modalKind && !blocked;
  useEffect(() => {
    setPopupOpen("guide", modalVisible);
    return () => setPopupOpen("guide", false);
  }, [modalVisible]);

  const begin = () => {
    const kind = intro;
    setIntro(null);
    if (!kind) return;
    const first = guideSteps(kind)[0];
    setTimeout(() => goFor(kind, first), 300);
  };
  const later = () => {
    setIntro(null);
    setSmall(true);
  };

  const closeFinished = () => setFinished(null);
  const onToEvolution = () => {
    setFinished(null);
    if (evolutionOn) {
      setSide("evolution");
      if (state && !state.evo) start("evo");
    } else toggleEvolution();
  };

  return (
    <GuideContext.Provider
      value={{
        state: state ?? {},
        showing,
        small,
        setSmall,
        done,
        start,
        next: () => run && setStep(run.step + 1),
        back: () => run && setStep(run.step - 1),
        stop,
        go,
      }}
    >
      {children}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={finished ? closeFinished : later}>
        <View style={styles.backdrop}>
          <View style={styles.box}>
            {modalKind && finished ? (
              <FinishPage kind={modalKind} evolutionOn={evolutionOn} isOwner={!!trainer?.is_owner} onEvolution={onToEvolution} onClose={closeFinished} />
            ) : modalKind ? (
              <IntroPage kind={modalKind} onStart={begin} onLater={later} />
            ) : null}
          </View>
        </View>
      </Modal>
    </GuideContext.Provider>
  );
}

function IntroPage({ kind, onStart, onLater }: { kind: GuideKind; onStart: () => void; onLater: () => void }) {
  const steps = guideSteps(kind);
  return (
    <>
      <Text style={styles.title}>{kind === "one" ? "Welcome! Let's set up your 1 on 1 side" : "Welcome to your Evolution side"}</Text>
      <Text style={styles.text}>
        {kind === "one"
          ? `${steps.length} short steps, about 10 minutes. A small card above the tabs shows each step, and Show me takes you there.`
          : `${steps.length} short steps: where everything is and how programs work.`}
      </Text>
      <View style={styles.list}>
        {steps.map((s, i) => (
          <Text key={s.key} style={styles.listLine} numberOfLines={1}>
            {i + 1}. {s.icon} {s.title}
          </Text>
        ))}
      </View>
      <Pressable style={styles.primary} onPress={onStart} accessibilityRole="button">
        <Text style={styles.primaryText}>Start</Text>
      </Pressable>
      <Pressable style={styles.cancel} onPress={onLater} hitSlop={8} accessibilityRole="button">
        <Text style={styles.cancelText}>Later</Text>
      </Pressable>
    </>
  );
}

function FinishPage({
  kind,
  evolutionOn,
  isOwner,
  onEvolution,
  onClose,
}: {
  kind: GuideKind;
  evolutionOn: boolean;
  isOwner: boolean;
  onEvolution: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <Text style={styles.title}>{kind === "one" ? "Your 1 on 1 side is set up ✅" : "You're all set ✅"}</Text>
      <Text style={styles.text}>You can run this guide again any time: ☰ Menu › Setup guide.</Text>
      {kind === "one" && !isOwner ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🌐 Online clients too?</Text>
          <Text style={styles.text}>
            {evolutionOn
              ? "Your Evolution side is on. Have a look at where the programs are and how they work."
              : "Switch on the Evolution side for programs, check-ins and nutrition for clients who train on their own. 30 days free, your first 5 clients free."}
          </Text>
          <Pressable style={styles.primary} onPress={onEvolution} accessibilityRole="button">
            <Text style={styles.primaryText}>{evolutionOn ? "Show me Evolution" : "Switch on Evolution"}</Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable style={kind === "one" && !isOwner ? styles.cancel : styles.primary} onPress={onClose} accessibilityRole="button">
        <Text style={kind === "one" && !isOwner ? styles.cancelText : styles.primaryText}>{kind === "one" && !isOwner ? "Not now" : "Done"}</Text>
      </Pressable>
    </>
  );
}

// The step card, just above the tabs (and at the bottom on a laptop).
export function SetupGuideBar() {
  const g = useSetupGuide();
  const { trainer } = useAuth();
  if (!g || !g.showing) return null;
  const run = g.state[g.showing];
  const steps = guideSteps(g.showing);
  const s = run ? steps[run.step] : undefined;
  if (!run || !s) return null;
  const ticked = !!s.check && !!g.done[s.check];
  const last = run.step === steps.length - 1;

  if (g.small)
    return (
      <Pressable style={styles.smallBar} onPress={() => g.setSmall(false)} accessibilityRole="button" accessibilityLabel="Open the setup guide">
        <Text style={styles.smallText} numberOfLines={1}>
          🧭 {GUIDE_TITLE[g.showing]} · step {run.step + 1} of {steps.length}: {s.title}
        </Text>
        <Text style={styles.smallOpen}>Open ▴</Text>
      </Pressable>
    );

  const share = () =>
    trainer &&
    Share.share({ message: `Join me on the Daily Evolution app. When you sign up, enter my trainer code: ${trainer.join_code}` }).catch(() => {});

  return (
    <View style={styles.bar}>
      <View style={styles.head}>
        <Text style={styles.stepNo}>
          🧭 Step {run.step + 1} of {steps.length}
        </Text>
        <View style={styles.headRight}>
          <Pressable onPress={() => g.setSmall(true)} hitSlop={10} accessibilityLabel="Make the guide small">
            <Text style={styles.icon}>▾</Text>
          </Pressable>
          <Pressable onPress={g.stop} hitSlop={10} accessibilityLabel="Stop the guide">
            <Text style={styles.icon}>✕</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.stepTitle}>
        {s.icon} {s.title}
        {ticked ? <Text style={styles.tick}>  ✓ Done</Text> : null}
      </Text>
      <Text style={styles.stepText}>{s.text}</Text>
      {s.shareCode && trainer ? <Text style={styles.code}>Your code: {trainer.join_code}</Text> : null}
      <View style={styles.buttons}>
        {run.step > 0 ? (
          <Pressable style={styles.small} onPress={g.back} hitSlop={6} accessibilityRole="button">
            <Text style={styles.smallBtnText}>‹</Text>
          </Pressable>
        ) : null}
        {s.target ? (
          <Pressable style={[styles.btn, ticked ? styles.btnOutline : styles.btnGold]} onPress={() => g.go(s)} accessibilityRole="button">
            <Text style={ticked ? styles.btnOutlineText : styles.btnGoldText}>Show me</Text>
          </Pressable>
        ) : null}
        {s.shareCode ? (
          <Pressable style={[styles.btn, styles.btnGold]} onPress={share} accessibilityRole="button">
            <Text style={styles.btnGoldText}>Send my code</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.btn, (ticked || (!s.target && !s.shareCode)) ? styles.btnGold : styles.btnOutline]}
          onPress={g.next}
          accessibilityRole="button"
        >
          <Text style={(ticked || (!s.target && !s.shareCode)) ? styles.btnGoldText : styles.btnOutlineText}>
            {last ? "Finish" : ticked || !s.check ? "Next ›" : "Skip ›"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = themedStyles({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 20 },
  box: { backgroundColor: "#1E293B", borderRadius: 16, padding: 18, width: "100%", maxWidth: 420 },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  text: { color: "#CBD5E1", fontSize: 14, marginTop: 8, lineHeight: 20 },
  list: { marginTop: 12, gap: 6 },
  listLine: { color: "#fff", fontSize: 15 },
  card: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 12, padding: 12, marginTop: 14 },
  cardTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  primary: { backgroundColor: BRAND_GOLD, borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 16 },
  primaryText: { color: "#0F172A", fontWeight: "700", fontSize: 15 },
  cancel: { alignSelf: "center", marginTop: 14 },
  cancelText: { color: "#94A3B8", fontWeight: "700", fontSize: 15 },
  bar: { backgroundColor: "#1E293B", borderTopWidth: 2, borderTopColor: BRAND_GOLD, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headRight: { flexDirection: "row", gap: 18 },
  stepNo: { color: BRAND_GOLD, fontSize: 12, fontWeight: "700" },
  icon: { color: "#94A3B8", fontSize: 16, fontWeight: "700" },
  stepTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginTop: 4 },
  tick: { color: "#22C55E", fontSize: 14 },
  stepText: { color: "#CBD5E1", fontSize: 13, lineHeight: 18, marginTop: 4 },
  code: { color: "#fff", fontSize: 14, fontWeight: "700", marginTop: 6 },
  buttons: { flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center" },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  btnGold: { backgroundColor: BRAND_GOLD },
  btnGoldText: { color: "#0F172A", fontWeight: "700", fontSize: 14 },
  btnOutline: { borderWidth: 1, borderColor: "#475569" },
  btnOutlineText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  small: { borderWidth: 1, borderColor: "#475569", borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14 },
  smallBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  smallBar: {
    backgroundColor: "#1E293B",
    borderTopWidth: 2,
    borderTopColor: BRAND_GOLD,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  smallText: { color: "#fff", fontSize: 13, flex: 1 },
  smallOpen: { color: BRAND_GOLD, fontSize: 13, fontWeight: "700" },
});
