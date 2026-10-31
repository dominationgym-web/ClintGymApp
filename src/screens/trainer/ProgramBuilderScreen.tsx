import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { ScrollView } from "@/components/ScrollView";
import TextInput from "@/components/TextInput";
import ModalSafeArea from "../../components/ModalSafeArea";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { supabase } from "@/lib/supabase";
import { filterExercises, forPlace, type ExercisePlace } from "@/lib/exerciseFilter";
import GymHomeTabs, { PROGRAM_PLACE_LABELS } from "@/components/GymHomeTabs";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import {
  blankCardio,
  CARDIO_ALL,
  CARDIO_CUSTOM,
  CARDIO_OPTIONS,
  cardioDuration,
  DEFAULT_WARM_UP,
  resizeExercises,
  defaultSessionTitle,
  EXERCISE_COUNTS,
  formatRest,
  REST_OPTIONS,
  WEEKDAY_NAMES,
  weeklyDraftProblem,
  type DraftExercise,
  type DraftSession,
} from "@/lib/programs";
import { clearProgramDraft, loadProgramDraft, saveProgramDraft } from "@/lib/programDraft";
import ExerciseVideoPreview from "@/components/ExerciseVideoPreview";
import { ExerciseThumb } from "@/components/YouTubeCard";
import CardioDurationPicker from "@/components/CardioDurationPicker";
import type { Exercise } from "@/types/database";
import type { TrainerStackParamList } from "@/navigation/types";
import KeyboardSafe from "@/components/KeyboardSafe";
import { AB_EXERCISES, AB_REP_OPTIONS, AB_REPS } from "@/lib/absBetweenSets";
import { useWideScreen } from "@/hooks/useWideScreen";
import ExerciseLibraryPanel from "@/components/ExerciseLibraryPanel";
import { themeText, themedStyles } from "@/lib/theme";

// Abs between sets (0083), chosen when the program is saved.
type AbsChoice = { on: boolean; reps: number; exercise: string | null };

type Props = NativeStackScreenProps<TrainerStackParamList, "ProgramBuilder">;

const blankSlot = (): DraftExercise => ({ exerciseId: null, exerciseName: "", sets: 3, reps: "8-12", restSeconds: 120 });
const blankSession = (day: number): DraftSession => ({ day, title: "", exercises: Array.from({ length: 6 }, blankSlot) });
const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Design a weekly program: tick the training days, then for each day pick 4,
// 6 or 8 exercises from the library (with a demo video to check) and tap in
// sets, reps and rest. A "how to do it" note covers technique and safety.
// The client works through the sessions in order (0037).
export default function ProgramBuilderScreen({ navigation }: Props) {
  const { trainer } = useAuth();
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [name, setName] = useState("");
  const [howTo, setHowTo] = useState("");
  const [warmUp, setWarmUp] = useState(DEFAULT_WARM_UP);
  // Monday, Wednesday and Friday to start with.
  const [sessions, setSessions] = useState<DraftSession[]>(() => [1, 3, 5].map(blankSession));
  const [activeDay, setActiveDay] = useState(1);
  const [picking, setPicking] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [place, setPlace] = useState<ExercisePlace>("gym");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Save asks about abs between sets first (GRIZZ, 2026-10-12).
  const [askAbs, setAskAbs] = useState(false);
  const [abs, setAbs] = useState<AbsChoice>({ on: false, reps: AB_REPS, exercise: null });
  // Work in progress is kept on the phone (programDraft.ts), so going back by
  // mistake doesn't lose it. It's brought back on opening the builder.
  const [draftReady, setDraftReady] = useState(false);
  const [restored, setRestored] = useState(false);
  const saved = useRef(false);
  // On a laptop the exercise videos sit beside the program instead of in a pop-up.
  const wide = useWideScreen();

  useEffect(() => {
    if (!trainer) return;
    loadProgramDraft(trainer.id).then((draft) => {
      if (draft) {
        setName(draft.name);
        setHowTo(draft.howTo);
        setWarmUp(draft.warmUp);
        setSessions(draft.sessions);
        setActiveDay(draft.activeDay);
        setPlace(draft.place);
        setRestored(true);
      }
      setDraftReady(true);
    });
  }, [trainer?.id]);

  useEffect(() => {
    if (!trainer || !draftReady || saved.current) return;
    const timer = setTimeout(
      () => !saved.current && saveProgramDraft(trainer.id, { name, howTo, warmUp, sessions, activeDay, place }),
      400,
    );
    return () => clearTimeout(timer);
  }, [trainer?.id, draftReady, name, howTo, warmUp, sessions, activeDay, place]);

  const startOver = () =>
    Alert.alert("Start over?", "This deletes the program you were building.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (trainer) await clearProgramDraft(trainer.id);
          setName("");
          setHowTo("");
          setWarmUp(DEFAULT_WARM_UP);
          setSessions([1, 3, 5].map(blankSession));
          setActiveDay(1);
          setPlace("gym");
          setRestored(false);
        },
      },
    ]);

  useEffect(() => {
    supabase
      .from("exercises")
      .select("*")
      .order("sort_order")
      .then(({ data }) => setLibrary(data ?? []));
  }, []);

  const session = sessions.find((s) => s.day === activeDay) ?? sessions[0];
  const sessionIndex = (day: number) => sessions.findIndex((s) => s.day === day);
  const titleFor = (s: DraftSession) => s.title.trim() || defaultSessionTitle(sessionIndex(s.day));

  const toggleDay = (day: number) => {
    if (sessions.some((s) => s.day === day)) {
      const next = sessions.filter((s) => s.day !== day);
      setSessions(next);
      if (activeDay === day && next.length > 0) setActiveDay(next[0].day);
      return;
    }
    setSessions([...sessions, blankSession(day)].sort((a, b) => a.day - b.day));
    setActiveDay(day);
  };

  const updateSession = (change: Partial<DraftSession>) =>
    setSessions((prev) => prev.map((s) => (s.day === session?.day ? { ...s, ...change } : s)));

  const setCount = (count: number) => {
    if (!session) return;
    updateSession({ exercises: resizeExercises(session.exercises, count, blankSlot) });
  };

  // Cardio blocks (0048) go between exercises or at the end of the session.
  const addCardio = (at: number) => {
    if (!session) return;
    const next = [...session.exercises];
    next.splice(at, 0, blankCardio());
    updateSession({ exercises: next });
  };

  const removeSlot = (index: number) => {
    if (!session) return;
    updateSession({ exercises: session.exercises.filter((_, i) => i !== index) });
  };

  const exerciseCount = session ? session.exercises.filter((s) => s.kind !== "cardio").length : 0;
  const exerciseNumber = (index: number) =>
    session ? session.exercises.slice(0, index + 1).filter((s) => s.kind !== "cardio").length : 0;

  const update = (index: number, change: Partial<DraftExercise>) => {
    if (!session) return;
    updateSession({ exercises: session.exercises.map((s, i) => (i === index ? { ...s, ...change } : s)) });
  };

  const closePicker = () => {
    setPicking(null);
    setPreviewId(null);
    setSearch("");
  };

  const filtered = filterExercises(forPlace(library, place), search);

  // Laptop: where the library's Add goes. The slot the trainer clicked, else
  // the first empty exercise of the day.
  const firstEmpty = session ? session.exercises.findIndex((s) => s.kind !== "cardio" && !s.exerciseId && !s.exerciseName) : -1;
  const target = picking !== null && session?.exercises[picking] ? picking : firstEmpty;
  const targetLabel = !session
    ? "the program"
    : target >= 0
      ? `Exercise ${exerciseNumber(target)} · ${SHORT_DAYS[session.day - 1]}`
      : `a new exercise · ${SHORT_DAYS[session.day - 1]}`;
  const addFromLibrary = (exercise: Exercise) => {
    if (!session) {
      Alert.alert("Pick a training day first", "Tick at least one day under Training days.");
      return;
    }
    const chosen = { exerciseId: exercise.id, exerciseName: exercise.name };
    if (target >= 0) update(target, chosen);
    else updateSession({ exercises: [...session.exercises, { ...blankSlot(), ...chosen }] });
    // Straight on to the next empty one.
    setPicking(null);
  };

  const askToSave = () => {
    const problem = weeklyDraftProblem(name, sessions);
    if (problem) {
      Alert.alert("Not quite ready", problem);
      return;
    }
    setAskAbs(true);
  };

  const save = async (absChoice: AbsChoice) => {
    if (!trainer) return;
    setAskAbs(false);
    setSaving(true);
    const dayTitles = WEEKDAY_NAMES.map((_, i) => {
      const s = sessions.find((x) => x.day === i + 1);
      return s ? titleFor(s) : "";
    });
    const { data: program, error } = await supabase
      .from("programs")
      .insert({
        trainer_id: trainer.id,
        name: name.trim(),
        kind: "weekly",
        description: howTo.trim() || null,
        day_titles: dayTitles,
        warm_up: warmUp.trim() || DEFAULT_WARM_UP,
        place,
        abs_between_sets: absChoice.on,
        abs_reps: absChoice.reps,
        abs_exercise: absChoice.exercise,
      })
      .select()
      .single();
    if (error || !program) {
      setSaving(false);
      Alert.alert("Couldn't save", error?.message ?? "Unknown error");
      return;
    }
    const { error: rowsError } = await supabase.from("program_exercises").insert(
      sessions.flatMap((s) =>
        s.exercises.map((e, i) => ({
          program_id: program.id,
          day_number: s.day,
          sort_order: i + 1,
          exercise_id: e.exerciseId,
          exercise_name: e.exerciseName,
          sets: e.sets,
          reps: e.reps.trim(),
          rest_seconds: e.restSeconds,
          kind: e.kind ?? "exercise",
        }))
      )
    );
    if (rowsError) {
      // Don't leave an empty program behind.
      await supabase.from("programs").delete().eq("id", program.id);
      setSaving(false);
      Alert.alert("Couldn't save", rowsError.message);
      return;
    }
    saved.current = true;
    await clearProgramDraft(trainer.id);
    setSaving(false);
    Alert.alert("Program saved", "Open a client and go to their Training tab to put them on it.");
    navigation.goBack();
  };

  const form = (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      <View style={styles.draftBar}>
        <Text style={styles.draftText}>
          {restored ? "📝 Carrying on where you left off." : "📝 Your work is kept if you go back."}
        </Text>
        <Pressable onPress={startOver} hitSlop={8}>
          <Text style={styles.startOver}>Start over</Text>
        </Pressable>
      </View>
      <Text style={styles.label}>This program is for</Text>
      <GymHomeTabs current={place} onChange={setPlace} accent={BRAND_GOLD} labels={PROGRAM_PLACE_LABELS} />
      <Text style={styles.label}>Program name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 3-day strength"
        placeholderTextColor="#64748B"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>How to do it (movement specifics and safety)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        multiline
        placeholder="e.g. Control the lowering for 3 seconds. Brace your core before each rep. Stop if you feel sharp pain."
        placeholderTextColor="#64748B"
        value={howTo}
        onChangeText={setHowTo}
      />

      <Text style={styles.label}>Warm-up before every session</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        multiline
        placeholder={DEFAULT_WARM_UP}
        placeholderTextColor="#64748B"
        value={warmUp}
        onChangeText={setWarmUp}
      />

      <Text style={styles.label}>Training days</Text>
      <View style={styles.chipRow}>
        {SHORT_DAYS.map((d, i) => {
          const on = sessions.some((s) => s.day === i + 1);
          return (
            <Pressable key={d} style={[styles.chip, on && styles.chipOn]} onPress={() => toggleDay(i + 1)}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{d}</Text>
            </Pressable>
          );
        })}
      </View>

      {sessions.length > 0 && session && (
        <>
          <View style={styles.dayTabs}>
            {sessions.map((s) => (
              <Pressable key={s.day} style={[styles.dayTab, s.day === session.day && styles.dayTabOn]} onPress={() => setActiveDay(s.day)}>
                <Text style={[styles.dayTabText, s.day === session.day && styles.chipTextOn]}>{SHORT_DAYS[s.day - 1]}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>{WEEKDAY_NAMES[session.day - 1]} session name</Text>
          <TextInput
            style={styles.input}
            placeholder={defaultSessionTitle(sessionIndex(session.day))}
            placeholderTextColor="#64748B"
            value={session.title}
            onChangeText={(title) => updateSession({ title })}
          />

          <Text style={styles.label}>Number of exercises</Text>
          <View style={styles.chipRow}>
            {EXERCISE_COUNTS.map((n) => (
              <Pressable key={n} style={[styles.chip, exerciseCount === n && styles.chipOn]} onPress={() => setCount(n)}>
                <Text style={[styles.chipText, exerciseCount === n && styles.chipTextOn]}>{n}</Text>
              </Pressable>
            ))}
          </View>

          {session.exercises.map((slot, i) => (
            <React.Fragment key={`${session.day}-${i}`}>
            {slot.kind === "cardio" ? (
              <CardioSlot
                slot={slot}
                isLast={i === session.exercises.length - 1}
                onChange={(change) => update(i, change)}
                onRemove={() => removeSlot(i)}
              />
            ) : (
            <View style={[styles.slot, wide && i === target && styles.slotTarget]}>
              <Text style={styles.slotNumber}>Exercise {exerciseNumber(i)}</Text>
              <Pressable style={styles.picker} onPress={() => setPicking(i)}>
                <Text style={slot.exerciseName ? styles.pickerText : styles.pickerPlaceholder}>
                  {slot.exerciseName || (wide ? "Click, then add one from the videos on the right" : "Tap to pick from the exercise videos")}
                </Text>
              </Pressable>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Sets</Text>
                  <View style={styles.stepperRow}>
                    <Pressable style={styles.stepper} onPress={() => update(i, { sets: Math.max(1, slot.sets - 1) })}>
                      <Text style={styles.stepperText}>-</Text>
                    </Pressable>
                    <Text style={styles.stepperValue}>{slot.sets}</Text>
                    <Pressable style={styles.stepper} onPress={() => update(i, { sets: Math.min(10, slot.sets + 1) })}>
                      <Text style={styles.stepperText}>+</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Reps</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 8-12"
                    placeholderTextColor="#64748B"
                    value={slot.reps}
                    onChangeText={(reps) => update(i, { reps })}
                  />
                </View>
              </View>

              <Text style={styles.label}>Rest between sets</Text>
              <View style={styles.chipRow}>
                {REST_OPTIONS.map((r) => (
                  <Pressable
                    key={r}
                    style={[styles.chip, slot.restSeconds === r && styles.chipOn]}
                    onPress={() => update(i, { restSeconds: r })}
                  >
                    <Text style={[styles.chipText, slot.restSeconds === r && styles.chipTextOn]}>{formatRest(r)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            )}
            <Pressable onPress={() => addCardio(i + 1)} hitSlop={6} style={styles.addCardio}>
              <Text style={styles.addCardioText}>
                + Add cardio {i === session.exercises.length - 1 ? "at the end" : "here"}
              </Text>
            </Pressable>
            </React.Fragment>
          ))}
        </>
      )}

      <Pressable style={styles.saveButton} onPress={askToSave} disabled={saving}>
        {saving ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.saveText}>Complete and save program</Text>}
      </Pressable>

      <Modal visible={picking !== null && !wide} animationType="slide" onRequestClose={closePicker}>
        <KeyboardSafe>
        <ModalSafeArea style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Pick an exercise</Text>
            <Pressable onPress={closePicker}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
          <View style={{ marginHorizontal: 20 }}>
            <GymHomeTabs current={place} onChange={setPlace} accent={BRAND_GOLD} />
          </View>
          <TextInput
            style={[styles.input, { marginHorizontal: 20, marginBottom: 10 }]}
            placeholder="Search, e.g. squat or Legs"
            placeholderTextColor="#64748B"
            value={search}
            onChangeText={setSearch}
          />
          <FlatList
            data={filtered}
            keyExtractor={(e) => e.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
            renderItem={({ item }) => (
              <View style={styles.libraryRow}>
                <View style={styles.libraryTop}>
                  <ExerciseThumb url={item.external_url} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerText}>{item.name}</Text>
                    {item.category && <Text style={styles.category}>{item.category}</Text>}
                  </View>
                  <Pressable hitSlop={6} onPress={() => setPreviewId((id) => (id === item.id ? null : item.id))}>
                    <Text style={styles.watch}>{previewId === item.id ? "Hide" : "▶ Watch"}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.useButton}
                    onPress={() => {
                      if (picking !== null) update(picking, { exerciseId: item.id, exerciseName: item.name });
                      closePicker();
                    }}
                  >
                    <Text style={styles.useText}>Use</Text>
                  </Pressable>
                </View>
                {previewId === item.id && <ExerciseVideoPreview url={item.external_url} name={item.name} />}
              </View>
            )}
          />
        </ModalSafeArea>
        </KeyboardSafe>
      </Modal>

      <Modal visible={askAbs} transparent animationType="fade" onRequestClose={() => setAskAbs(false)}>
        <View style={styles.absBackdrop}>
          <View style={styles.absCard}>
            <ScrollView contentContainerStyle={{ padding: 18 }}>
              <Text style={styles.modalTitle}>Add abs between each set?</Text>
              <Text style={styles.absHelp}>
                After every set the client does the ab exercise, then taps Complete to start their rest timer.
              </Text>
              <View style={[styles.chipRow, { marginTop: 12 }]}>
                <Pressable style={[styles.chip, !abs.on && styles.chipOn]} onPress={() => setAbs({ ...abs, on: false })}>
                  <Text style={[styles.chipText, !abs.on && styles.chipTextOn]}>No thanks</Text>
                </Pressable>
                <Pressable style={[styles.chip, abs.on && styles.chipOn]} onPress={() => setAbs({ ...abs, on: true })}>
                  <Text style={[styles.chipText, abs.on && styles.chipTextOn]}>Yes, add abs</Text>
                </Pressable>
              </View>
              {abs.on && (
                <>
                  <Text style={styles.label}>How many reps</Text>
                  <View style={styles.chipRow}>
                    {AB_REP_OPTIONS.map((n) => (
                      <Pressable key={n} style={[styles.chip, abs.reps === n && styles.chipOn]} onPress={() => setAbs({ ...abs, reps: n })}>
                        <Text style={[styles.chipText, abs.reps === n && styles.chipTextOn]}>{n}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.label}>Which exercise</Text>
                  <View style={styles.chipRow}>
                    {[null, ...AB_EXERCISES].map((e) => (
                      <Pressable
                        key={e ?? "mix"}
                        style={[styles.chip, abs.exercise === e && styles.chipOn]}
                        onPress={() => setAbs({ ...abs, exercise: e })}
                      >
                        <Text style={[styles.chipText, abs.exercise === e && styles.chipTextOn]}>{e ?? "Mix it up"}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {abs.exercise === null && <Text style={styles.category}>Mix it up gives a different ab exercise each set.</Text>}
                </>
              )}
              <Pressable style={styles.saveButton} onPress={() => save(abs)}>
                <Text style={styles.saveText}>Save program</Text>
              </Pressable>
              <Pressable onPress={() => setAskAbs(false)} hitSlop={8} style={{ alignSelf: "center", marginTop: 12 }}>
                <Text style={styles.close}>Back to editing</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );

  if (!wide) return form;
  return (
    <View style={styles.wideRow}>
      <View style={styles.wideForm}>{form}</View>
      <View style={styles.wideLibrary}>
        <ExerciseLibraryPanel library={library} place={place} onPlaceChange={setPlace} onAdd={addFromLibrary} target={targetLabel} />
      </View>
    </View>
  );
}

// A cardio block: pick the machine and 10 to 60 seconds. The block at the end
// of the session can also be "All of the above" or the trainer's own words,
// e.g. "Run 5km at speed 8, incline 6 on the treadmill".
function CardioSlot({
  slot,
  isLast,
  onChange,
  onRemove,
}: {
  slot: DraftExercise;
  isLast: boolean;
  onChange: (change: Partial<DraftExercise>) => void;
  onRemove: () => void;
}) {
  const custom = slot.exerciseName === CARDIO_CUSTOM;
  const options = isLast ? [...CARDIO_OPTIONS, CARDIO_ALL] : CARDIO_OPTIONS;
  return (
    <View style={[styles.slot, styles.cardioSlot]}>
      <View style={styles.cardioHeader}>
        <Text style={styles.slotNumber}>🔥 Cardio</Text>
        <Pressable onPress={onRemove} hitSlop={8}>
          <Text style={styles.removeText}>Remove</Text>
        </Pressable>
      </View>
      <View style={styles.chipRow}>
        {options.map((o) => (
          <Pressable
            key={o}
            style={[styles.chip, slot.exerciseName === o && styles.chipOn]}
            onPress={() => onChange({ exerciseName: o, reps: custom ? cardioDuration(30) : slot.reps })}
          >
            <Text style={[styles.chipText, slot.exerciseName === o && styles.chipTextOn]}>{o}</Text>
          </Pressable>
        ))}
      </View>
      {!custom && (
        <>
          <Text style={styles.label}>How long</Text>
          <CardioDurationPicker value={slot.reps} onChange={(reps) => onChange({ reps })} />
        </>
      )}
      {isLast && (
        <>
          <Text style={styles.label}>Or type your own</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Run 5km at speed 8, incline 6 on the treadmill"
            placeholderTextColor="#64748B"
            value={custom ? slot.reps : ""}
            onChangeText={(text) =>
              onChange(text ? { exerciseName: CARDIO_CUSTOM, reps: text } : { exerciseName: CARDIO_OPTIONS[0], reps: cardioDuration(30) })
            }
          />
        </>
      )}
    </View>
  );
}

const styles = themedStyles({
  draftBar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#1E293B", borderRadius: 10, padding: 10, marginBottom: 4 },
  draftText: { color: "#CBD5E1", fontSize: 13, flex: 1 },
  startOver: { color: "#F87171", fontWeight: "700", fontSize: 13 },
  cardioSlot: { borderColor: "#F97316" },
  cardioHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  removeText: { color: "#94A3B8", fontWeight: "600", fontSize: 13 },
  addCardio: { alignSelf: "flex-start", marginTop: -4, marginBottom: 12 },
  addCardioText: { color: "#F97316", fontWeight: "700", fontSize: 13 },
  container: { flex: 1, backgroundColor: "#0F172A" },
  label: { color: "#64748B", fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 8, padding: 10, fontSize: 14 },
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { backgroundColor: "#1E293B", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: BRAND_GOLD },
  chipText: { color: "#94A3B8", fontWeight: "600", fontSize: 13 },
  chipTextOn: { color: "#0F172A" },
  slot: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginTop: 14 },
  slotTarget: { borderWidth: 2, borderColor: BRAND_GOLD },
  wideRow: { flex: 1, flexDirection: "row", backgroundColor: "#0F172A" },
  wideForm: { flex: 1, minWidth: 360 },
  wideLibrary: { flex: 1.3, borderLeftWidth: 1, borderLeftColor: "#1E293B" },
  slotNumber: { color: BRAND_GOLD, fontWeight: "800", fontSize: 13, marginBottom: 8 },
  picker: { backgroundColor: "#0F172A", borderRadius: 8, padding: 12 },
  pickerText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  pickerPlaceholder: { color: "#64748B", fontSize: 14 },
  row: { flexDirection: "row", gap: 12 },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepper: { width: 36, height: 36, borderRadius: 8, backgroundColor: "#0F172A", alignItems: "center", justifyContent: "center" },
  stepperText: { color: BRAND_GOLD, fontSize: 18, fontWeight: "700" },
  stepperValue: { color: "#fff", fontSize: 16, fontWeight: "700", minWidth: 20, textAlign: "center" },
  saveButton: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 20 },
  saveText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
  modal: { flex: 1, backgroundColor: "#0F172A" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20 },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  close: { color: BRAND_GOLD, fontWeight: "600", fontSize: 15 },
  libraryRow: { backgroundColor: "#1E293B", borderRadius: 10, padding: 14, marginBottom: 8 },
  libraryTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  watch: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13 },
  useButton: { backgroundColor: BRAND_GOLD, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12 },
  useText: { color: "#0F172A", fontWeight: "800", fontSize: 13 },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  dayTabs: { flexDirection: "row", gap: 6, marginTop: 16, flexWrap: "wrap" },
  dayTab: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  dayTabOn: { backgroundColor: BRAND_GOLD },
  dayTabText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13 },
  category: { color: "#64748B", fontSize: 12, marginTop: 2 },
  absBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 16 },
  absCard: { backgroundColor: "#0F172A", borderRadius: 14, borderWidth: 1.5, borderColor: BRAND_GOLD, maxHeight: "90%" },
  absHelp: { color: "#CBD5E1", fontSize: 14, lineHeight: 20, marginTop: 6 },
});
