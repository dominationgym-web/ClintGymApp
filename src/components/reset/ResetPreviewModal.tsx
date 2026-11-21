import React, { useEffect, useState } from "react";
import { Modal, Text, View } from "react-native";
import Pressable from "@/components/Pressable";
import { ScrollView } from "@/components/ScrollView";
import ModalSafeArea from "@/components/ModalSafeArea";
import WeekBrowser from "@/components/reset/WeekBrowser";
import LifestyleResetContent from "@/screens/client/LifestyleResetContent";
import { BRAND_GOLD } from "@/lib/brand";
import {
  RESET_HOME_KIT,
  RESET_HOME_WARM_UP,
  RESET_PHASES,
  RESET_WARM_UP,
  RESET_WEEKS_TOTAL,
  resetName,
  resetSetTarget,
  resetTraining,
  resetWeek,
  type ResetLocation,
  type ResetSex,
} from "@/lib/resetProgram";
import { useStepBack } from "@/hooks/useStepBack";
import { themeText, themedStyles } from "@/lib/theme";

type View3 = "weeks" | "training" | "guide";

const VIEWS: { key: View3; label: string }[] = [
  { key: "weeks", label: "12 weeks" },
  { key: "training", label: "Training" },
  { key: "guide", label: "Full guide" },
];

/** "90s" or "2 min" for the rest column. */
function restLabel(seconds: number): string {
  return seconds % 60 === 0 ? `${seconds / 60} min` : seconds < 60 ? `${seconds}s` : `${Math.round(seconds / 6) / 10} min`;
}

// The 12-Week Health Reset for the trainer to look through before enrolling
// anyone (GRIZZ, 2026-11-16: "Can allocate it, but not peruse it before
// allocating"). The same week cards the client sees, each phase's workouts as
// Exercise / Sets / Reps / Rest rows like a program's week, and the full guide.
export default function ResetPreviewModal({
  visible,
  onClose,
  sex,
  place,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  /** The client's, when opened from a client. Otherwise the trainer picks Women / Men. */
  sex?: ResetSex;
  place?: ResetLocation | null;
  /** E.g. the Enroll button when opened from a client. */
  footer?: React.ReactNode;
}) {
  const [view, setView] = useState<View3>("weeks");
  const [week, setWeek] = useState(1);
  const [who, setWho] = useState<"female" | "male">(sex === "male" ? "male" : "female");
  const [location, setLocation] = useState<ResetLocation>(place === "home" ? "home" : "gym");
  useEffect(() => {
    if (!visible) return;
    setWho(sex === "male" ? "male" : "female");
    setLocation(place === "home" ? "home" : "gym");
  }, [visible, sex, place]);
  useStepBack(visible, onClose);

  const plan = resetWeek(week, who);
  const phase = RESET_PHASES[plan.phase];
  const training = resetTraining(plan.phase, location, who);
  const target = resetSetTarget(training.sets);

  const toggle = <T extends string>(options: { value: T; label: string }[], current: T, onPick: (v: T) => void) => (
    <View style={styles.toggle}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          style={[styles.toggleBtn, current === o.value && styles.toggleOn]}
          onPress={() => onPick(o.value)}
          accessibilityRole="button"
          accessibilityState={{ selected: current === o.value }}
        >
          <Text style={[styles.toggleText, current === o.value && styles.toggleTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ModalSafeArea style={styles.modal}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Back">
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              12-Week {resetName(who)}
            </Text>
            <Text style={styles.subtitle}>What the client sees, week by week</Text>
          </View>
        </View>

        <View style={styles.controls}>
          {sex === "male" || sex === "female"
            ? null
            : toggle(
                [
                  { value: "female" as const, label: "Women" },
                  { value: "male" as const, label: "Men" },
                ],
                who,
                setWho,
              )}
          {toggle(
            [
              { value: "gym" as const, label: "🏋️ Gym" },
              { value: "home" as const, label: "🏠 Home" },
            ],
            location,
            setLocation,
          )}
        </View>
        <View style={styles.tabs}>
          {VIEWS.map((v) => (
            <Pressable
              key={v.key}
              style={[styles.tab, view === v.key && styles.tabOn]}
              onPress={() => setView(v.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: view === v.key }}
            >
              <Text style={[styles.tabText, view === v.key && styles.tabTextOn]}>{v.label}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16 }}>
          {view === "weeks" ? (
            <WeekBrowser week={week} onChange={setWeek} location={location} sex={who} />
          ) : view === "training" ? (
            <View>
              <View style={styles.weekRow}>
                <Pressable
                  style={[styles.navButton, week === 1 && styles.navDisabled]}
                  disabled={week === 1}
                  onPress={() => setWeek(week - 1)}
                >
                  <Text style={styles.navText}>‹</Text>
                </Pressable>
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Text style={[styles.phase, { color: themeText(phase.color) }]}>
                    WEEK {week} OF {RESET_WEEKS_TOTAL} · {phase.name}
                  </Text>
                  <Text style={styles.summary}>{training.summary}</Text>
                </View>
                <Pressable
                  style={[styles.navButton, week === RESET_WEEKS_TOTAL && styles.navDisabled]}
                  disabled={week === RESET_WEEKS_TOTAL}
                  onPress={() => setWeek(week + 1)}
                >
                  <Text style={styles.navText}>›</Text>
                </Pressable>
              </View>
              <Text style={styles.note}>Warm-up: {location === "home" ? RESET_HOME_WARM_UP : RESET_WARM_UP}</Text>
              {location === "home" ? <Text style={styles.note}>{RESET_HOME_KIT}</Text> : null}
              {training.sessions.map((s) => (
                <View key={s.key} style={styles.session}>
                  <Text style={styles.sessionTitle}>{s.label}</Text>
                  <View style={styles.headRow}>
                    <Text style={[styles.head, styles.colName]}>Exercise</Text>
                    <Text style={[styles.head, styles.col]}>Sets</Text>
                    <Text style={[styles.head, styles.col]}>Reps</Text>
                    <Text style={[styles.head, styles.col]}>Rest</Text>
                  </View>
                  {s.exercises.map((e) => (
                    <View key={e.name} style={styles.exRow}>
                      <View style={styles.colName}>
                        <Text style={styles.exName}>{e.name}</Text>
                        {e.or || e.note ? (
                          <Text style={styles.exNote}>{[e.or ? `or ${e.or}` : null, e.note].filter(Boolean).join(" · ")}</Text>
                        ) : null}
                      </View>
                      <Text style={[styles.cell, styles.col]}>{target.setsLabel}</Text>
                      <Text style={[styles.cell, styles.col]}>{/second/.test(e.note ?? "") ? "hold" : target.reps}</Text>
                      <Text style={[styles.cell, styles.col]}>{restLabel(target.restSeconds)}</Text>
                    </View>
                  ))}
                </View>
              ))}
              <Text style={styles.note}>Effort: {training.effort}</Text>
              <Text style={styles.note}>Cardio: {training.cardio}</Text>
              <Text style={styles.note}>{training.energyNote}</Text>
            </View>
          ) : (
            <LifestyleResetContent sex={who} />
          )}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </ModalSafeArea>
    </Modal>
  );
}

const styles = themedStyles({
  modal: { flex: 1, backgroundColor: "#0F172A" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingTop: 6, paddingBottom: 2 },
  back: { color: BRAND_GOLD, fontSize: 28, fontWeight: "800", lineHeight: 30 },
  title: { color: "#fff", fontSize: 17, fontWeight: "800" },
  subtitle: { color: "#94A3B8", fontSize: 12 },
  controls: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingTop: 8 },
  toggle: { flex: 1, flexDirection: "row", backgroundColor: "#1E293B", borderRadius: 10, padding: 3 },
  toggleBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: "center" },
  toggleOn: { backgroundColor: "#334155" },
  toggleText: { color: "#94A3B8", fontWeight: "700", fontSize: 13 },
  toggleTextOn: { color: "#fff" },
  tabs: { flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#334155", alignItems: "center" },
  tabOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  tabText: { color: "#CBD5E1", fontWeight: "700", fontSize: 13 },
  tabTextOn: { color: "#0F172A" },
  weekRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  navButton: { width: 44, borderRadius: 10, paddingVertical: 8, alignItems: "center", backgroundColor: "#1E293B" },
  navDisabled: { opacity: 0.35 },
  navText: { color: BRAND_GOLD, fontWeight: "800", fontSize: 18 },
  phase: { fontSize: 11.5, fontWeight: "800", letterSpacing: 0.5 },
  summary: { color: "#fff", fontSize: 14, fontWeight: "700", marginTop: 2 },
  note: { color: "#94A3B8", fontSize: 12.5, lineHeight: 18, marginTop: 6 },
  session: { backgroundColor: "#1E293B", borderRadius: 12, padding: 10, marginTop: 10 },
  sessionTitle: { color: BRAND_GOLD, fontWeight: "800", fontSize: 13.5, marginBottom: 6 },
  headRow: { flexDirection: "row", paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: "#334155" },
  head: { color: "#64748B", fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  exRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#0F172A" },
  colName: { flex: 1, paddingRight: 6 },
  col: { width: 52, textAlign: "center" },
  exName: { color: "#fff", fontSize: 13.5, fontWeight: "600" },
  exNote: { color: "#94A3B8", fontSize: 11.5 },
  cell: { color: "#E2E8F0", fontSize: 13 },
  footer: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 6, borderTopWidth: 1, borderTopColor: "#1E293B" },
});
