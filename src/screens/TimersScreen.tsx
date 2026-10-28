import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import ModalSafeArea from "../components/ModalSafeArea";
import TextInput from "@/components/TextInput";
import KeyboardSafe from "@/components/KeyboardSafe";
import FoldSection from "@/components/FoldSection";
import ScreenTabBar, { type ScreenTab } from "@/components/ScreenTabBar";
import IntervalTimerModal from "@/components/IntervalTimerModal";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { formatClock } from "@/lib/programs";
import {
  LIMITS,
  MAX_EXERCISES,
  TIMER_KINDS,
  buildTimerPhases,
  cleanSettings,
  defaultSettings,
  defaultTimerName,
  describeTimer,
  formatSeconds,
  totalSeconds,
  type SavedTimer,
  type TimerKind,
  type TimerSettings,
} from "@/lib/timerWorkouts";
import { themeText, themedStyles } from "@/lib/theme";

type TabKey = TimerKind | "saved";

const BOXING_ROUND_MINUTES = [2, 3, 4, 5, 6];

const TABS: ScreenTab<TabKey>[] = [
  { key: "emom", label: "EMOM", icon: "alarm" },
  { key: "tabata", label: "Tabata", icon: "flame" },
  { key: "custom", label: "Intervals", icon: "timer" },
  { key: "boxing", label: "Boxing", icon: "fitness" },
  { key: "saved", label: "Saved", icon: "bookmark" },
];

// Bigger steps for longer times, so 3 minutes isn't 36 taps away.
const timeStep = (v: number, up: boolean) => {
  const at = up ? v : v - 1;
  return at < 60 ? 5 : at < 180 ? 15 : 30;
};

// Timers (GRIZZ, 2026-10-25): EMOM, Tabata and custom work/rest intervals,
// for clients and trainers, from the menu. Set the times and rounds with
// − and +, add exercises if you want them named on each effort, then Start.
// Save keeps it under Saved; a trainer can save one for a client, who is told
// (0152). One tab per timer so nothing needs scrolling.
export default function TimersScreen({ initialTab }: { initialTab?: TabKey }) {
  const { session, role, trainer } = useAuth();
  const userId = session?.user.id ?? null;
  const [tab, setTab] = useState<TabKey>(initialTab ?? "emom");
  const [settings, setSettings] = useState<Record<TimerKind, TimerSettings>>({
    emom: defaultSettings("emom"),
    tabata: defaultSettings("tabata"),
    custom: defaultSettings("custom"),
    boxing: defaultSettings("boxing"),
  });
  const [exerciseText, setExerciseText] = useState("");
  const [exercisesOpen, setExercisesOpen] = useState(false);
  const [running, setRunning] = useState<{ title: string; settings: TimerSettings } | null>(null);
  const [saved, setSaved] = useState<SavedTimer[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveFor, setSaveFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);

  const loadSaved = useCallback(async () => {
    const { data } = await supabase.from("timer_workouts").select("*").order("created_at", { ascending: false });
    setSaved((data ?? []).map((r) => ({ ...r, settings: cleanSettings(r.settings) }) as SavedTimer));
    setLoadingSaved(false);
  }, []);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  // A trainer can save a timer for one of their clients.
  useEffect(() => {
    if (role !== "trainer" || !trainer) return;
    supabase
      .from("clients")
      .select("id, name")
      .eq("trainer_id", trainer.id)
      .neq("id", trainer.id)
      .is("archived_at", null)
      .order("name")
      .then(({ data }) => setClients(data ?? []));
  }, [role, trainer]);

  const clientName = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);
  const phases = useMemo(() => (running ? buildTimerPhases(running.settings) : []), [running]);

  const kind: TimerKind | null = tab === "saved" ? null : tab;
  const s = kind ? settings[kind] : null;
  const update = (patch: Partial<TimerSettings>) => {
    if (!kind) return;
    setSettings((prev) => ({ ...prev, [kind]: { ...prev[kind], ...patch } }));
  };

  const addExercise = () => {
    const name = exerciseText.trim();
    if (!s || !name) return;
    if (s.exercises.length >= MAX_EXERCISES) {
      Alert.alert("That's the most", `A timer can have up to ${MAX_EXERCISES} exercises.`);
      return;
    }
    update({ exercises: [...s.exercises, name] });
    setExerciseText("");
  };

  const openSave = () => {
    if (!s) return;
    setSaveName(defaultTimerName(s));
    setSaveFor(null);
    setSaveOpen(true);
  };

  const save = async () => {
    if (!s || !userId) return;
    const name = saveName.trim() || defaultTimerName(s);
    setSaving(true);
    const { data, error } = await supabase
      .from("timer_workouts")
      .insert({ name: name.slice(0, 80), settings: s, client_id: saveFor })
      .select()
      .single();
    setSaving(false);
    if (error || !data) {
      Alert.alert("Couldn't save", error?.message ?? "Please try again.");
      return;
    }
    setSaved((prev) => [{ ...data, settings: cleanSettings(data.settings) } as SavedTimer, ...prev]);
    setSaveOpen(false);
    Alert.alert(
      "Saved ✓",
      saveFor ? `${clientName.get(saveFor) ?? "Your client"} has been told and will find it under Saved on their Timers page.` : "You'll find it under Saved."
    );
  };

  const remove = (t: SavedTimer) => {
    Alert.alert("Delete this timer?", t.client_id && t.client_id !== userId ? `${t.name}. Your client won't have it any more either.` : t.name, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setSaved((prev) => prev.filter((x) => x.id !== t.id));
          const { error } = await supabase.from("timer_workouts").delete().eq("id", t.id);
          if (error) {
            Alert.alert("Couldn't delete", error.message);
            loadSaved();
          }
        },
      },
    ]);
  };

  // Opens a saved timer on its own tab, ready to change or start.
  const openSaved = (t: SavedTimer) => {
    setSettings((prev) => ({ ...prev, [t.settings.kind]: t.settings }));
    setTab(t.settings.kind);
  };

  const savedLabel = (t: SavedTimer) => {
    if (t.owner_id !== userId) return "From your coach";
    if (t.client_id && t.client_id !== userId) return `For ${clientName.get(t.client_id) ?? "a client"}`;
    return null;
  };

  return (
    <View style={styles.screen}>
      <ScreenTabBar tabs={TABS} current={tab} onChange={setTab} position="top" />
      {kind && s ? (
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          <Text style={styles.summary}>{TIMER_KINDS.find((k) => k.kind === kind)?.summary}</Text>

          {kind === "emom" && (
            <>
              <Stepper
                label="Every"
                value={s.work}
                text={formatSeconds(s.work)}
                min={LIMITS.emomInterval.min}
                max={LIMITS.emomInterval.max}
                step={(v, up) => ((up ? v : v - 1) < 120 ? 15 : 30)}
                onChange={(work) => update({ work })}
              />
              <Stepper label="Rounds" value={s.rounds} min={LIMITS.rounds.min} max={LIMITS.rounds.max} onChange={(rounds) => update({ rounds })} />
            </>
          )}

          {kind === "boxing" && (
            <>
              <View style={[styles.stepper, styles.roundPicker]}>
                <Text style={styles.stepperLabel}>Round length</Text>
                <View style={styles.minuteChips}>
                  {BOXING_ROUND_MINUTES.map((m) => (
                    <Pressable
                      key={m}
                      style={[styles.minuteChip, s.work === m * 60 && styles.chipOn]}
                      onPress={() => update({ work: m * 60 })}
                      accessibilityLabel={`${m} minute rounds`}
                    >
                      <Text style={[styles.chipText, s.work === m * 60 && styles.chipTextOn]}>{m} min</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <Stepper
                label="Rest"
                value={s.rest}
                text={formatSeconds(s.rest)}
                min={LIMITS.boxingRest.min}
                max={LIMITS.boxingRest.max}
                step={() => 15}
                onChange={(rest) => update({ rest })}
              />
              <Stepper label="Rounds" value={s.rounds} min={LIMITS.boxingRounds.min} max={LIMITS.boxingRounds.max} onChange={(rounds) => update({ rounds })} />
            </>
          )}

          {(kind === "tabata" || kind === "custom") && (
            <>
              <Stepper label="Work" value={s.work} text={formatSeconds(s.work)} min={LIMITS.work.min} max={LIMITS.work.max} step={timeStep} onChange={(work) => update({ work })} />
              <Stepper label="Rest" value={s.rest} text={s.rest ? formatSeconds(s.rest) : "No rest"} min={LIMITS.rest.min} max={LIMITS.rest.max} step={timeStep} onChange={(rest) => update({ rest })} />
              <Stepper label="Rounds" value={s.rounds} min={LIMITS.rounds.min} max={LIMITS.rounds.max} onChange={(rounds) => update({ rounds })} />
            </>
          )}

          {kind === "tabata" && (
            <>
              <Stepper label="Tabatas" value={s.sets} min={LIMITS.sets.min} max={LIMITS.sets.max} onChange={(sets) => update({ sets })} />
              {s.sets > 1 && (
                <Stepper
                  label="Rest between"
                  value={s.setRest}
                  text={s.setRest ? formatSeconds(s.setRest) : "No rest"}
                  min={LIMITS.setRest.min}
                  max={LIMITS.setRest.max}
                  step={timeStep}
                  onChange={(setRest) => update({ setRest })}
                />
              )}
            </>
          )}

          {kind === "custom" && s.exercises.length > 1 && (
            <Stepper
              label="Rest after a round"
              value={s.setRest}
              text={s.setRest ? formatSeconds(s.setRest) : "Same as rest"}
              min={LIMITS.setRest.min}
              max={LIMITS.setRest.max}
              step={timeStep}
              onChange={(setRest) => update({ setRest })}
            />
          )}

          <FoldSection
            icon="🏋️"
            title="Exercises (optional)"
            hint={s.exercises.length ? `${s.exercises.length} added` : "None: just the timer"}
            open={exercisesOpen}
            onToggle={() => setExercisesOpen((o) => !o)}
          >
            <Text style={styles.help}>
              {kind === "emom"
                ? "Each minute is the next exercise on the list, then back to the first. Put the reps in, e.g. 10 burpees."
                : kind === "tabata"
                  ? "The exercises take turns. Leave it empty to just use the timer."
                  : kind === "boxing"
                    ? "Each round is the next one on the list, e.g. Bag work, Pads, Shadow boxing. Leave it empty for plain rounds."
                  : "Every round goes through the whole list, with your rest between each one."}
            </Text>
            {s.exercises.map((e, i) => (
              <View key={`${e}-${i}`} style={styles.exerciseRow}>
                <Text style={styles.exerciseNum}>{i + 1}</Text>
                <Text style={styles.exerciseName}>{e}</Text>
                <Pressable hitSlop={10} onPress={() => update({ exercises: s.exercises.filter((_, j) => j !== i) })} accessibilityLabel={`Remove ${e}`}>
                  <Text style={styles.remove}>✕</Text>
                </Pressable>
              </View>
            ))}
            <View style={styles.addRow}>
              <TextInput
                style={styles.input}
                value={exerciseText}
                onChangeText={setExerciseText}
                placeholder={kind === "emom" ? "e.g. 10 burpees" : kind === "boxing" ? "e.g. Pad work" : "e.g. Kettlebell swings"}
                maxLength={60}
                returnKeyType="done"
                onSubmitEditing={addExercise}
              />
              <Pressable style={styles.addButton} onPress={addExercise}>
                <Text style={styles.addText}>Add</Text>
              </Pressable>
            </View>
            {kind === "tabata" && s.exercises.length > 1 && s.sets > 1 && (
              <View style={styles.switchRow}>
                <Text style={styles.help}>Change exercise</Text>
                {(["round", "set"] as const).map((each) => (
                  <Pressable key={each} style={[styles.chip, s.switchEach === each && styles.chipOn]} onPress={() => update({ switchEach: each })}>
                    <Text style={[styles.chipText, s.switchEach === each && styles.chipTextOn]}>{each === "round" ? "Every round" : "Every Tabata"}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </FoldSection>

        </ScrollView>
      ) : null}
      {kind && s ? (
        // Pinned under the settings, so Start is always in reach.
        <View style={styles.footer}>
          <Pressable style={styles.footerStart} onPress={() => setRunning({ title: describeTimer(s), settings: s })}>
            <Text style={styles.startText}>▶ Start</Text>
            <Text style={styles.footerTime}>{formatClock(totalSeconds(s))}</Text>
          </Pressable>
          <Pressable style={styles.footerSave} onPress={openSave} accessibilityLabel={role === "trainer" ? "Save for you or a client" : "Save"}>
            <Text style={styles.secondaryText}>💾 Save</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.pad}>
          {loadingSaved ? (
            <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginTop: 30 }} />
          ) : saved.length === 0 ? (
            <Text style={styles.summary}>
              No saved timers yet. Set one up on the EMOM, Tabata, Intervals or Boxing tab and tap Save.
              {role === "client" ? " Timers your coach makes for you show here too." : ""}
            </Text>
          ) : (
            saved.map((t) => {
              const label = savedLabel(t);
              return (
                <View key={t.id} style={styles.savedCard}>
                  <Pressable style={{ flex: 1 }} onPress={() => openSaved(t)}>
                    {label ? <Text style={styles.savedLabel}>{label}</Text> : null}
                    <Text style={styles.savedName}>{t.name}</Text>
                    <Text style={styles.savedDesc}>{describeTimer(t.settings)}</Text>
                    {t.settings.exercises.length ? (
                      <Text style={styles.savedDesc} numberOfLines={1}>
                        {t.settings.exercises.join(" · ")}
                      </Text>
                    ) : null}
                  </Pressable>
                  <View style={styles.savedButtons}>
                    <Pressable style={styles.smallStart} onPress={() => setRunning({ title: t.name, settings: t.settings })} accessibilityLabel={`Start ${t.name}`}>
                      <Text style={styles.smallStartText}>▶</Text>
                    </Pressable>
                    {t.owner_id === userId && (
                      <Pressable hitSlop={10} onPress={() => remove(t)} accessibilityLabel={`Delete ${t.name}`}>
                        <Text style={styles.remove}>✕</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })
          )}
          {saved.length > 0 && <Text style={styles.help}>Tap a timer to change it before you start, or ▶ to start it now.</Text>}
        </ScrollView>
      )}

      <IntervalTimerModal
        visible={!!running}
        title={running?.title ?? ""}
        description={null}
        warmUp={null}
        rows={[]}
        phases={phases}
        onClose={() => setRunning(null)}
      />

      <Modal visible={saveOpen} transparent animationType="fade" onRequestClose={() => setSaveOpen(false)}>
        <KeyboardSafe>
          <ModalSafeArea style={styles.backdrop}>
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>Save this timer</Text>
              {s ? <Text style={styles.savedDesc}>{describeTimer(s)}</Text> : null}
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput style={styles.input} value={saveName} onChangeText={setSaveName} maxLength={80} placeholder="e.g. Friday finisher" />
              {role === "trainer" && (
                <>
                  <Text style={styles.fieldLabel}>Who is it for?</Text>
                  <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="handled">
                    <View style={styles.chips}>
                      <Pressable style={[styles.chip, saveFor === null && styles.chipOn]} onPress={() => setSaveFor(null)}>
                        <Text style={[styles.chipText, saveFor === null && styles.chipTextOn]}>Me</Text>
                      </Pressable>
                      {clients.map((c) => (
                        <Pressable key={c.id} style={[styles.chip, saveFor === c.id && styles.chipOn]} onPress={() => setSaveFor(c.id)}>
                          <Text style={[styles.chipText, saveFor === c.id && styles.chipTextOn]}>{c.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                  {saveFor ? <Text style={styles.help}>{clientName.get(saveFor)} gets a notification and finds it under Saved.</Text> : null}
                </>
              )}
              <Pressable style={styles.start} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.startText}>Save</Text>}
              </Pressable>
              <Pressable style={styles.secondary} onPress={() => setSaveOpen(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          </ModalSafeArea>
        </KeyboardSafe>
      </Modal>
    </View>
  );
}

// A number with − and + either side, so nothing needs typing.
function Stepper({
  label,
  value,
  text,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  text?: string;
  min: number;
  max: number;
  step?: (value: number, up: boolean) => number;
  onChange: (v: number) => void;
}) {
  const move = (up: boolean) => {
    const by = step ? step(value, up) : 1;
    onChange(Math.min(max, Math.max(min, value + (up ? by : -by))));
  };
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <Pressable style={[styles.stepButton, value <= min && styles.stepOff]} onPress={() => move(false)} disabled={value <= min} accessibilityLabel={`Less ${label}`}>
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <Text style={styles.stepValue}>{text ?? value}</Text>
      <Pressable style={[styles.stepButton, value >= max && styles.stepOff]} onPress={() => move(true)} disabled={value >= max} accessibilityLabel={`More ${label}`}>
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = themedStyles({
  screen: { flex: 1, backgroundColor: "#0F172A" },
  pad: { padding: 16, paddingBottom: 40 },
  summary: { color: "#CBD5E1", fontSize: 14, lineHeight: 20, marginBottom: 6 },
  help: { color: "#94A3B8", fontSize: 13, lineHeight: 18, marginTop: 6 },
  roundPicker: { flexDirection: "column", alignItems: "stretch", gap: 8 },
  minuteChips: { flexDirection: "row", gap: 6 },
  minuteChip: { flex: 1, alignItems: "center", borderRadius: 14, borderWidth: 1, borderColor: "#334155", paddingVertical: 8 },
  stepper: { flexDirection: "row", alignItems: "center", backgroundColor: "#111C33", borderRadius: 12, padding: 10, marginTop: 8 },
  stepperLabel: { flex: 1, color: "#fff", fontWeight: "700", fontSize: 15 },
  stepButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1E293B", alignItems: "center", justifyContent: "center" },
  stepOff: { opacity: 0.35 },
  stepText: { color: BRAND_GOLD, fontSize: 24, fontWeight: "800", lineHeight: 28 },
  stepValue: { color: "#fff", fontWeight: "800", fontSize: 16, minWidth: 104, textAlign: "center" },
  exerciseRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1E293B" },
  exerciseNum: { color: BRAND_GOLD, fontWeight: "800", width: 20 },
  exerciseName: { flex: 1, color: "#fff", fontSize: 15 },
  remove: { color: "#F87171", fontSize: 18, fontWeight: "800", paddingHorizontal: 4 },
  addRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  input: { flex: 1, backgroundColor: "#F8FAFC", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  addButton: { backgroundColor: BRAND_GOLD, borderRadius: 10, paddingHorizontal: 16, justifyContent: "center" },
  addText: { color: "#0F172A", fontWeight: "800" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 16, borderWidth: 1, borderColor: "#334155", paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "700", fontSize: 13 },
  chipTextOn: { color: "#0F172A" },
  footer: { flexDirection: "row", gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: "#1E293B", backgroundColor: "#0F172A" },
  footerStart: { flex: 1, flexDirection: "row", gap: 10, backgroundColor: BRAND_GOLD, borderRadius: 12, padding: 14, alignItems: "center", justifyContent: "center" },
  footerTime: { color: "#0F172A", fontWeight: "700", fontSize: 15, opacity: 0.75 },
  footerSave: { borderRadius: 12, borderWidth: 1, borderColor: BRAND_GOLD, paddingHorizontal: 16, justifyContent: "center" },
  start: { backgroundColor: BRAND_GOLD, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 12 },
  startText: { color: "#0F172A", fontWeight: "800", fontSize: 18 },
  secondary: { alignItems: "center", padding: 14 },
  secondaryText: { color: BRAND_GOLD, fontWeight: "800", fontSize: 15 },
  cancelText: { color: "#94A3B8", fontWeight: "700", fontSize: 15 },
  savedCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#111C33", borderRadius: 12, padding: 12, marginBottom: 10, gap: 10 },
  savedLabel: { color: BRAND_GOLD, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 2 },
  savedName: { color: "#fff", fontWeight: "800", fontSize: 16 },
  savedDesc: { color: "#94A3B8", fontSize: 13, marginTop: 2 },
  savedButtons: { flexDirection: "row", alignItems: "center", gap: 12 },
  smallStart: { width: 42, height: 42, borderRadius: 21, backgroundColor: BRAND_GOLD, alignItems: "center", justifyContent: "center" },
  smallStartText: { color: "#0F172A", fontSize: 18, fontWeight: "800" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 16 },
  sheet: { backgroundColor: "#1E293B", borderRadius: 16, padding: 18 },
  sheetTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  fieldLabel: { color: BRAND_GOLD, fontWeight: "800", fontSize: 12, letterSpacing: 1, marginTop: 14, marginBottom: 6 },
});
