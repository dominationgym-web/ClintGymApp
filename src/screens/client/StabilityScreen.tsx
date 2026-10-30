import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import { useStepBack } from "@/hooks/useStepBack";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { BRAND_GOLD } from "@/lib/brand";
import { useAuth } from "@/context/AuthContext";
import type { ClientStabilityProgram, StabilityLog } from "@/types/database";
import StabilityExerciseCard, { type StabilityEntry } from "@/components/stability/StabilityExerciseCard";
import StabilityHowTo from "@/components/stability/StabilityHowTo";
import {
  findArea,
  findExercise,
  findProgram,
  itemsFor,
  LEVELS,
  levelInfo,
  phaseFor,
  STABILITY_AREAS,
  STABILITY_BASICS,
  STABILITY_MENU_ITEM,
  stabilityWeek,
  targetText,
  type StabilityArea,
  type StabilityExercise,
  type StabilityLevel,
  type StabilityMode,
} from "@/lib/stability";
import { themeBorder, themeText, themedStyles } from "@/lib/theme";

type Step =
  | { kind: "home" }
  | { kind: "area"; area: StabilityArea }
  | { kind: "level"; area: StabilityArea; level: StabilityLevel }
  | { kind: "session"; enrollmentId: string };

// A heading that opens one part at a time, so the page stays short (GRIZZ
// doesn't like scrolling).
function Fold({ title, icon, open, onPress, children }: { title: string; icon?: string; open: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Pressable style={[styles.fold, open && styles.foldOpen]} onPress={onPress}>
        <Text style={styles.foldTitle}>
          {icon ? `${icon}  ` : ""}
          {title}
        </Text>
        <Text style={styles.arrow}>{open ? "▲" : "▼"}</Text>
      </Pressable>
      {open && <View style={styles.foldBody}>{children}</View>}
    </View>
  );
}

const Bullet = ({ children }: { children: React.ReactNode }) => <Text style={styles.text}>•  {children}</Text>;

// Stability & injury prevention (GRIZZ, 2026-10-14). The trainer browses the
// 7 areas and 4 levels here (from their menu) and gives a client a program on
// the client's Training tab. The client only sees the programs their coach
// gave them: they do them and log each exercise as seconds held or reps done
// before losing control. Runs alongside the client's main program.
export default function StabilityScreen({ role = "client", initialArea }: { role?: "client" | "trainer"; initialArea?: StabilityArea }) {
  const { client } = useAuth();
  const [step, setStep] = useState<Step>(initialArea ? { kind: "area", area: initialArea } : { kind: "home" });
  const [fold, setFold] = useState<string | null>(null);
  const [openEx, setOpenEx] = useState<string | null>(null);
  const [mode, setMode] = useState<StabilityMode>("primer");
  const [enrollments, setEnrollments] = useState<ClientStabilityProgram[] | null>(null);
  const [logs, setLogs] = useState<StabilityLog[]>([]);
  const [videos, setVideos] = useState<Record<string, string | null>>({});

  const go = (next: Step) => {
    setFold(null);
    setOpenEx(null);
    setStep(next);
  };

  const stepBack = useCallback(() => {
    if (openEx) return setOpenEx(null);
    setFold(null);
    setStep((s) => (s.kind === "level" ? { kind: "area", area: s.area } : { kind: "home" }));
  }, [openEx]);
  useStepBack(step.kind !== "home" || openEx !== null, stepBack);

  const loadEnrollments = useCallback(async () => {
    if (role === "trainer") return setEnrollments([]);
    if (!client) return;
    const { data } = await supabase
      .from("client_stability_programs")
      .select("*")
      .eq("client_id", client.id)
      .is("ended_at", null)
      .order("created_at");
    setEnrollments(data ?? []);
  }, [client, role]);

  useEffect(() => {
    loadEnrollments();
    supabase.rpc("stability_exercise_videos").then(({ data }) => {
      setVideos(Object.fromEntries((data ?? []).map((r) => [r.name, r.external_url])));
    });
  }, [loadEnrollments]);

  const enrollmentId = step.kind === "session" ? step.enrollmentId : null;
  const loadLogs = useCallback(async () => {
    if (!enrollmentId) return;
    // Newest first, then flipped, so the 1000-row limit drops the oldest logs, never today's.
    const { data } = await supabase
      .from("stability_logs")
      .select("*")
      .eq("stability_program_id", enrollmentId)
      .order("log_date", { ascending: false })
      .order("set_number", { ascending: false });
    setLogs((data ?? []).reverse());
  }, [enrollmentId]);

  useEffect(() => {
    setLogs([]);
    loadLogs();
  }, [loadLogs]);

  const saveSets = async (e: ClientStabilityProgram, week: number, exerciseKey: string, measure: "hold" | "reps", entries: StabilityEntry[]) => {
    if (!client) return false;
    const today = todayIso();
    // Sets already logged today for this exercise come first, so a second save adds on.
    const already = logs.filter((l) => l.exercise_key === exerciseKey && l.log_date === today);
    const offset = already.length ? Math.max(...already.map((l) => l.set_number)) : 0;
    const rows = entries.map((en) => ({
      client_id: client.id,
      stability_program_id: e.id,
      area: e.area,
      level: e.level,
      week,
      mode,
      exercise_key: exerciseKey,
      set_number: Math.min(20, en.set_number + offset),
      side: en.side,
      seconds: measure === "hold" ? en.value : null,
      reps: measure === "reps" ? en.value : null,
      log_date: today,
    }));
    const { error } = await supabase.from("stability_logs").insert(rows);
    if (error) {
      Alert.alert("Couldn't save", error.message);
      return false;
    }
    await loadLogs();
    return true;
  };

  if (!enrollments) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator color={themeText(BRAND_GOLD)} />
      </View>
    );
  }

  const toggle = (key: string) => setFold((f) => (f === key ? null : key));

  // A tappable exercise in the browse views: opens its video (or watch-online
  // link) and how-to, so trainers can coach it 1-on-1 (GRIZZ, 2026-10-16).
  const exerciseRow = (ex: StabilityExercise, rowKey: string, label: React.ReactNode) => (
    <View key={rowKey}>
      <Pressable onPress={() => setOpenEx((o) => (o === rowKey ? null : rowKey))} style={styles.exRow} accessibilityRole="button">
        <Text style={[styles.text, { flex: 1 }]}>{label}</Text>
        <Text style={styles.exPlay}>{openEx === rowKey ? "▲" : "▶"}</Text>
      </Pressable>
      {openEx === rowKey && (
        <View style={styles.exBody}>
          <StabilityHowTo exercise={ex} videoUrl={ex.video ? (videos[ex.video] ?? null) : null} />
        </View>
      )}
    </View>
  );

  // ---- Home: your programs, the 7 areas, the basics ----
  if (step.kind === "home") {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>{STABILITY_MENU_ITEM.icon}</Text>
          <Text style={styles.heroTitle}>{role === "trainer" ? "Stability & Rehab programming" : "Stability & injury prevention"}</Text>
          <Text style={styles.heroText}>
            {role === "trainer"
              ? "28 programs from the ground up: 7 areas, each at Rehab, Beginner, Intermediate and Advanced. Browse them here, then give a client one on their Training tab."
              : "Programs from your coach to keep your joints strong and controlled. Do the short ⚡ version before a workout, or the full session to go deeper."}
          </Text>
        </View>

        {role === "client" && <Text style={styles.section}>Your programs</Text>}
        {role === "client" && enrollments.length === 0 && (
          <Text style={styles.text}>Your coach hasn't given you a stability program yet. Ask them if you'd like one for a joint that's sore or weak.</Text>
        )}
        {enrollments.map((e) => {
          const area = findArea(e.area);
          const program = findProgram(e.area, e.level);
          const week = stabilityWeek(e.started_on, todayIso());
          return (
            <Pressable key={e.id} style={[styles.myProgram, { borderLeftColor: themeBorder(area.accent) }]} onPress={() => (setMode("primer"), go({ kind: "session", enrollmentId: e.id }))}>
              <Text style={styles.myIcon}>{area.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.myTitle}>
                  {area.title} · {levelInfo(e.level).label}
                </Text>
                <Text style={styles.mySub}>
                  {week > program.weeks ? "Finished: take the finish test" : `Week ${week} of ${program.weeks} · ${phaseFor(program, week).title}`}
                </Text>
              </View>
              <Text style={styles.arrow}>▶</Text>
            </Pressable>
          );
        })}

        {role === "trainer" && (
          <>
            <Text style={styles.section}>The 7 areas</Text>
            <View style={styles.grid}>
              {STABILITY_AREAS.map((a) => (
                <Pressable key={a.area} style={[styles.tile, { borderTopColor: themeBorder(a.accent) }]} onPress={() => go({ kind: "area", area: a.area })}>
                  <Text style={styles.tileIcon}>{a.icon}</Text>
                  <Text style={styles.tileTitle}>{a.title}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Text style={styles.section}>The basics</Text>
        {STABILITY_BASICS.map((b) => (
          <Fold key={b.heading} title={b.heading} icon={b.icon} open={fold === b.heading} onPress={() => toggle(b.heading)}>
            {b.points.map((p, i) => (
              <Bullet key={i}>{p}</Bullet>
            ))}
          </Fold>
        ))}
      </ScrollView>
    );
  }

  // ---- An area: why it matters, which level, red flags, the 4 programs ----
  if (step.kind === "area") {
    const area = findArea(step.area);
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={[styles.hero, { borderTopColor: themeBorder(area.accent) }]}>
          <Text style={styles.heroIcon}>{area.icon}</Text>
          <Text style={styles.heroTitle}>{area.title} stability</Text>
          <Text style={styles.heroText}>{area.summary}</Text>
        </View>
        <Fold title="Why it matters" icon="🔬" open={fold === "why"} onPress={() => toggle("why")}>
          {area.why.map((w, i) => (
            <Bullet key={i}>{w}</Bullet>
          ))}
        </Fold>
        <Fold title="Which level is right for me?" icon="🧭" open={fold === "choose"} onPress={() => toggle("choose")}>
          {LEVELS.map((l) => (
            <Text key={l.level} style={styles.text}>
              <Text style={{ color: themeText(l.colour), fontWeight: "700" }}>{l.label}: </Text>
              {area.chooseLevel[l.level]}
            </Text>
          ))}
          <Text style={[styles.text, { marginTop: 6 }]}>Not sure? Start one level lower. It's better to fly through an easy week than to train sloppy control.</Text>
        </Fold>
        <Fold title="Stop and see a doctor if..." icon="🚩" open={fold === "flags"} onPress={() => toggle("flags")}>
          {area.redFlags.map((r, i) => (
            <Bullet key={i}>{r}</Bullet>
          ))}
        </Fold>

        <Fold title={`All ${area.title.toLowerCase()} exercises, with videos`} icon="▶" open={fold === "exercises"} onPress={() => toggle("exercises")}>
          <Text style={[styles.hint, { marginTop: 0, marginBottom: 6 }]}>Tap one for its video (or examples online), how to do it, and how to make it easier or harder.</Text>
          {area.exercises.map((ex) => exerciseRow(ex, `all-${ex.key}`, <Text style={{ fontWeight: "700" }}>{ex.name}</Text>))}
        </Fold>

        <Text style={styles.section}>Choose your level</Text>
        {LEVELS.map((l) => {
          const program = findProgram(step.area, l.level);
          return (
            <Pressable key={l.level} style={[styles.levelCard, { borderLeftColor: themeBorder(l.colour) }]} onPress={() => go({ kind: "level", area: step.area, level: l.level })}>
              <View style={{ flex: 1 }}>
                <Text style={styles.levelTitle}>
                  {l.icon} {l.label} · {program.weeks} weeks
                </Text>
                <Text style={styles.levelWho}>{program.who}</Text>
              </View>
              <Text style={styles.arrow}>▶</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }

  // ---- A program's overview, with Start ----
  if (step.kind === "level") {
    const area = findArea(step.area);
    const program = findProgram(step.area, step.level);
    const info = levelInfo(step.level);
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={[styles.hero, { borderTopColor: themeBorder(info.colour) }]}>
          <Text style={styles.heroIcon}>{area.icon}</Text>
          <Text style={styles.heroTitle}>
            {area.title} · {info.label}
          </Text>
          <Text style={[styles.heroText, { color: themeText(info.colour), fontWeight: "700" }]}>{program.weeks} weeks</Text>
          <Text style={styles.heroText}>{program.goal}</Text>
        </View>
        <Fold title="Who it's for" icon="🙋" open={fold === "who"} onPress={() => toggle("who")}>
          <Text style={styles.text}>{program.who}</Text>
        </Fold>
        <Fold title="How often" icon="📅" open={fold === "often"} onPress={() => toggle("often")}>
          <Text style={styles.text}>{program.howOften}</Text>
        </Fold>
        <Fold title="Resistance: how hard and how heavy" icon="🏋️" open={fold === "res"} onPress={() => toggle("res")}>
          <Text style={styles.text}>{program.resistance}</Text>
        </Fold>
        <Fold title="How to progress" icon="📈" open={fold === "prog"} onPress={() => toggle("prog")}>
          <Text style={styles.text}>{program.progression}</Text>
        </Fold>
        {program.phases.map((ph) => (
          <Fold
            key={ph.from}
            title={`Weeks ${ph.from}-${ph.to}: ${ph.title}`}
            icon="🗓️"
            open={fold === `ph${ph.from}`}
            onPress={() => toggle(`ph${ph.from}`)}
          >
            <Text style={[styles.text, { fontStyle: "italic", marginBottom: 6 }]}>{ph.focus}</Text>
            {ph.items.map((item) => {
              const ex = findExercise(step.area, item.ex)!;
              return exerciseRow(
                ex,
                `ph${ph.from}-${item.ex}`,
                <>
                  {item.primer ? "⚡ " : "•  "}
                  <Text style={{ fontWeight: "700" }}>{ex.name}</Text>: {ex.measure === "hold" ? "hold " : ""}
                  {targetText(item, ex, "full")}
                </>,
              );
            })}
            <Text style={styles.hint}>⚡ = part of the short version before a workout. Tap an exercise for its video and how-to.</Text>
          </Fold>
        ))}
        <Fold title="The finish test" icon="🏁" open={fold === "test"} onPress={() => toggle("test")}>
          <Text style={styles.text}>Pass this to move up a level: {program.finishTest}</Text>
        </Fold>
        <Text style={styles.hint}>To give a client this program, open the client, go to their Training tab, and tap 🛡️ Stability programs.</Text>
      </ScrollView>
    );
  }

  // ---- A running program: this week's exercises, with logging ----
  const enrollment = enrollments.find((e) => e.id === step.enrollmentId);
  if (!enrollment) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator color={themeText(BRAND_GOLD)} />
      </View>
    );
  }
  const area = findArea(enrollment.area);
  const program = findProgram(enrollment.area, enrollment.level);
  const week = stabilityWeek(enrollment.started_on, todayIso());
  const finished = week > program.weeks;
  const phase = phaseFor(program, week);
  const items = itemsFor(phase, mode);
  const nextLevel = LEVELS[LEVELS.findIndex((l) => l.level === enrollment.level) + 1];
  const today = todayIso();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <View style={[styles.sessionHead, { borderLeftColor: themeBorder(area.accent) }]}>
        <Text style={styles.myTitle}>
          {area.icon} {area.title} · {levelInfo(enrollment.level).label}
        </Text>
        <Text style={styles.mySub}>{finished ? `All ${program.weeks} weeks done` : `Week ${week} of ${program.weeks}`}</Text>
        <Text style={styles.phaseTitle}>
          Weeks {phase.from}-{phase.to}: {phase.title}
        </Text>
        <Text style={styles.text}>{phase.focus}</Text>
      </View>

      {finished && (
        <View style={styles.finished}>
          <Text style={styles.finishedTitle}>🏁 Program finished. Well done!</Text>
          <Text style={styles.text}>Take the finish test: {program.finishTest}</Text>
          <Text style={[styles.text, { marginTop: 4 }]}>
            Tell your coach how you did. {nextLevel ? `If you passed, they'll move you up to ${nextLevel.label}; if not, you'll repeat this program.` : "They may keep the advanced program going 2 times a week so you hold onto it."} Until then, keep going with the last phase.
          </Text>
        </View>
      )}

      <View style={styles.modeRow}>
        {(["primer", "full"] as const).map((m) => (
          <Pressable key={m} style={[styles.modeBtn, mode === m && styles.modeOn]} onPress={() => (setOpenEx(null), setMode(m))}>
            <Text style={[styles.modeText, mode === m && styles.modeTextOn]}>{m === "primer" ? "⚡ Before a workout" : "Full session"}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>
        {mode === "primer"
          ? "The short version: 1-2 sets of the key exercises, about 8-10 minutes, as part of your warm-up."
          : "The whole session. Rest about 30-60 seconds between sets."}
      </Text>

      {items.map((item) => {
        const ex = findExercise(enrollment.area, item.ex)!;
        const exLogs = logs.filter((l) => l.exercise_key === item.ex);
        return (
          <StabilityExerciseCard
            key={`${mode}-${item.ex}`}
            exercise={ex}
            dose={item}
            mode={mode}
            videoUrl={ex.video ? (videos[ex.video] ?? null) : null}
            logs={exLogs}
            loggedToday={exLogs.some((l) => l.log_date === today)}
            open={openEx === item.ex}
            onToggle={() => setOpenEx((o) => (o === item.ex ? null : item.ex))}
            onSave={(entries) => saveSets(enrollment, week, item.ex, ex.measure, entries)}
          />
        );
      })}

      <Fold title="How hard and how to progress" icon="📈" open={fold === "how"} onPress={() => toggle("how")}>
        <Text style={styles.text}>{program.resistance}</Text>
        <Text style={[styles.text, { marginTop: 6 }]}>{program.progression}</Text>
        <Text style={[styles.text, { marginTop: 6 }]}>{program.howOften}</Text>
      </Fold>
      <Fold title="Stop and see a doctor if..." icon="🚩" open={fold === "flags"} onPress={() => toggle("flags")}>
        {area.redFlags.map((r, i) => (
          <Bullet key={i}>{r}</Bullet>
        ))}
      </Fold>
    </ScrollView>
  );
}

const styles = themedStyles({
  container: { flex: 1, backgroundColor: "#0F172A" },
  content: { padding: 16, paddingBottom: 40 },
  hero: { backgroundColor: "#1E293B", borderRadius: 16, borderTopWidth: 4, borderTopColor: BRAND_GOLD, padding: 18, alignItems: "center", marginBottom: 14 },
  heroIcon: { fontSize: 34, marginBottom: 6 },
  heroTitle: { color: "#fff", fontSize: 21, fontWeight: "800", textAlign: "center", marginBottom: 6 },
  heroText: { color: "#CBD5E1", fontSize: 14, lineHeight: 20, textAlign: "center" },
  section: { color: BRAND_GOLD, fontSize: 13, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginTop: 10, marginBottom: 8 },
  myProgram: { flexDirection: "row", alignItems: "center", backgroundColor: "#1E293B", borderRadius: 12, padding: 12, marginBottom: 8, borderLeftWidth: 4 },
  myIcon: { fontSize: 26, marginRight: 12 },
  myTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  mySub: { color: "#94A3B8", fontSize: 13, marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  tile: { width: "48%", backgroundColor: "#1E293B", borderRadius: 12, borderTopWidth: 3, paddingVertical: 14, alignItems: "center", marginBottom: 10 },
  tileIcon: { fontSize: 28 },
  tileTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginTop: 4 },
  tileOn: { color: "#22C55E", fontSize: 12, fontWeight: "700", marginTop: 2 },
  fold: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#1E293B", borderRadius: 12, padding: 12 },
  foldOpen: { backgroundColor: "#273449", borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  foldTitle: { color: "#fff", fontSize: 15, fontWeight: "700", flex: 1, marginRight: 8 },
  foldBody: { backgroundColor: "#1E293B", borderBottomLeftRadius: 12, borderBottomRightRadius: 12, padding: 12, paddingTop: 8 },
  arrow: { color: BRAND_GOLD, fontSize: 13 },
  text: { color: "#E2E8F0", fontSize: 14, lineHeight: 20, marginBottom: 4 },
  hint: { color: "#94A3B8", fontSize: 12.5, marginTop: 4, marginBottom: 10 },
  exRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  exPlay: { color: BRAND_GOLD, fontSize: 13, marginLeft: 8 },
  exBody: { backgroundColor: "#0F172A", borderRadius: 10, padding: 10, marginBottom: 8 },
  levelCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#1E293B", borderRadius: 12, padding: 12, marginBottom: 8, borderLeftWidth: 4 },
  levelTitle: { color: "#fff", fontSize: 15.5, fontWeight: "800" },
  levelWho: { color: "#94A3B8", fontSize: 13, lineHeight: 18, marginTop: 3 },
  primary: { backgroundColor: BRAND_GOLD, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8, marginBottom: 10 },
  primaryText: { color: "#0F172A", fontSize: 16, fontWeight: "800" },
  secondary: { borderColor: BRAND_GOLD, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  secondaryText: { color: BRAND_GOLD, fontSize: 15, fontWeight: "700" },
  sessionHead: { backgroundColor: "#1E293B", borderRadius: 12, padding: 12, borderLeftWidth: 4, marginBottom: 12 },
  phaseTitle: { color: BRAND_GOLD, fontSize: 14.5, fontWeight: "700", marginTop: 8, marginBottom: 2 },
  finished: { backgroundColor: "#14532D", borderRadius: 12, padding: 12, marginBottom: 12 },
  finishedTitle: { color: "#fff", fontSize: 16, fontWeight: "800", marginBottom: 6 },
  modeRow: { flexDirection: "row", backgroundColor: "#1E293B", borderRadius: 12, padding: 4 },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
  modeOn: { backgroundColor: BRAND_GOLD },
  modeText: { color: "#CBD5E1", fontSize: 14, fontWeight: "700" },
  modeTextOn: { color: "#0F172A" },
  stop: { alignItems: "center", paddingVertical: 14, marginTop: 8 },
  stopText: { color: "#F87171", fontSize: 14, fontWeight: "700" },
});
