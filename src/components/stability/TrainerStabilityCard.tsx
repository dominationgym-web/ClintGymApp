import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { BRAND_GOLD } from "@/lib/brand";
import type { ClientStabilityProgram, StabilityLog } from "@/types/database";
import StabilityHowTo from "@/components/stability/StabilityHowTo";
import {
  assessExercise,
  findArea,
  findExercise,
  findProgram,
  LEVELS,
  levelInfo,
  phaseFor,
  stabilityWeek,
  targetText,
  unitLabel,
  type StabilityArea,
  type StabilityExercise,
  type StabilityLevel,
} from "@/lib/stability";
import { themeText, themedStyles } from "@/lib/theme";
import { useStepBack } from "@/hooks/useStepBack";

// For the trainer, on the client's Training tab. Stability programs are the
// trainer's to give (GRIZZ, 2026-10-14): pick an area and a level to start one
// (one per area; picking another level switches it), stop it, or move the
// client up once they've finished. For each running program: the week
// they're on, and for this week's exercises their last sets, their best, and
// whether they're ready to progress or struggling. Tap to open.
export default function TrainerStabilityCard({
  clientId,
  clientName,
  trainerId,
  onChanged,
}: {
  clientId: string;
  clientName: string;
  trainerId?: string;
  // A program started or stopped, so the calendar's stability days reload (0110).
  onChanged?: () => void;
}) {
  const [programs, setPrograms] = useState<ClientStabilityProgram[]>([]);
  const [logs, setLogs] = useState<StabilityLog[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Every exercise opens its video and how-to, so the trainer can do and coach
  // it too (GRIZZ, 2026-10-16).
  const [openEx, setOpenEx] = useState<string | null>(null);
  // Phone Back closes what is open first, one step at a time.
  useStepBack(open, () => setOpen(false));
  useStepBack(openEx !== null, () => setOpenEx(null));
  const [videos, setVideos] = useState<Record<string, string | null>>({});

  useEffect(() => {
    supabase.rpc("stability_exercise_videos").then(({ data }) => {
      setVideos(Object.fromEntries((data ?? []).map((r) => [r.name, r.external_url])));
    });
  }, []);

  const howTo = (rowKey: string, ex: StabilityExercise) =>
    openEx === rowKey && (
      <View style={styles.howTo}>
        <StabilityHowTo exercise={ex} videoUrl={ex.video ? (videos[ex.video] ?? null) : null} />
      </View>
    );

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("client_stability_programs")
      .select("*")
      .eq("client_id", clientId)
      .is("ended_at", null)
      .order("created_at");
    const rows = data ?? [];
    setPrograms(rows);
    if (rows.length === 0) return setLogs([]);
    const { data: logRows } = await supabase
      .from("stability_logs")
      .select("*")
      .in(
        "stability_program_id",
        rows.map((r) => r.id),
      )
      // Newest first, then flipped, so the 1000-row limit drops the oldest logs.
      .order("log_date", { ascending: false })
      .order("set_number", { ascending: false });
    setLogs((logRows ?? []).reverse());
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const start = async (a: StabilityArea, l: StabilityLevel) => {
    setBusy(true);
    const current = programs.find((p) => p.area === a);
    if (current) {
      const { error } = await supabase.from("client_stability_programs").update({ ended_at: new Date().toISOString() }).eq("id", current.id);
      if (error) {
        setBusy(false);
        return Alert.alert("Couldn't switch the program", error.message);
      }
    }
    const { error } = await supabase.from("client_stability_programs").insert({ client_id: clientId, area: a, level: l, started_on: todayIso() });
    if (error) {
      setBusy(false);
      return Alert.alert("Couldn't start the program", error.message);
    }
    // No automatic note (GRIZZ: never ready-made messages from trainer to
    // client). It shows on their calendar and in their ☰ menu.
    setBusy(false);
    setOpen(true);
    load();
    onChanged?.();
  };

  const confirmStart = (a: StabilityArea, l: StabilityLevel) => {
    const current = programs.find((p) => p.area === a);
    const name = `${findArea(a).title} ${levelInfo(l).label}`;
    const text = current
      ? current.level === l
        ? `${clientName} starts ${name} again from week 1 today. Their logs so far are kept.`
        : `This ends ${clientName}'s ${findArea(a).title} ${levelInfo(current.level).label} program (logs are kept) and starts ${name} from week 1 today.`
      : `${clientName} starts ${name} (${findProgram(a, l).weeks} weeks) today. It shows on their calendar and under ☰ menu → My stability program.`;
    Alert.alert(`Start ${name}?`, text, [
      { text: "Cancel", style: "cancel" },
      { text: "Start", onPress: () => start(a, l) },
    ]);
  };

  const stop = (p: ClientStabilityProgram) => {
    Alert.alert(`Stop ${findArea(p.area).title} ${levelInfo(p.level).label}?`, `It disappears from ${clientName}'s app. Their logs are kept.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Stop",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("client_stability_programs").update({ ended_at: new Date().toISOString() }).eq("id", p.id);
          if (error) Alert.alert("Couldn't stop it", error.message);
          load();
          onChanged?.();
        },
      },
    ]);
  };

  // New ones start from the calendar: tap a day, then Rehab (GRIZZ, 2026-10-20:
  // one way in). This card follows the ones running.
  if (programs.length === 0) return null;

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={() => setOpen((o) => !o)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>🛡️ Stability programs</Text>
          <Text style={styles.sub}>
            {programs.map((p) => `${findArea(p.area).title} ${levelInfo(p.level).label}`).join(" · ")}
          </Text>
        </View>
        <Text style={styles.arrow}>{open ? "▲" : "▼"}</Text>
      </Pressable>
      {open &&
        programs.map((p) => {
          const program = findProgram(p.area, p.level);
          const week = stabilityWeek(p.started_on, todayIso());
          const finished = week > program.weeks;
          const phase = phaseFor(program, week);
          const mine = logs.filter((l) => l.stability_program_id === p.id);
          const lastDate = mine.length ? mine[mine.length - 1].log_date : null;
          const next = LEVELS[LEVELS.findIndex((l) => l.level === p.level) + 1];
          return (
            <View key={p.id} style={styles.program}>
              <Text style={styles.programTitle}>
                {findArea(p.area).icon} {findArea(p.area).title} · {levelInfo(p.level).label}
              </Text>
              <Text style={styles.sub}>
                {finished ? `Finished all ${program.weeks} weeks` : `Week ${week} of ${program.weeks}: ${phase.title}`}
                {lastDate ? ` · last logged ${lastDate}` : " · nothing logged yet"}
              </Text>
              {finished && <Text style={styles.exLine}>Finish test: {program.finishTest}</Text>}
              {phase.items.map((item) => {
                const ex = findExercise(p.area, item.ex)!;
                const a = assessExercise(
                  mine.filter((l) => l.exercise_key === item.ex),
                  item,
                  ex,
                );
                return (
                  <View key={item.ex} style={styles.row}>
                    <Pressable onPress={() => setOpenEx((o) => (o === `${p.id}-${item.ex}` ? null : `${p.id}-${item.ex}`))} accessibilityRole="button">
                      <Text style={styles.exName}>
                        {ex.name} <Text style={styles.target}>({targetText(item, ex, "full")})</Text>
                        <Text style={styles.target}>  {openEx === `${p.id}-${item.ex}` ? "▲" : "▶ video"}</Text>
                      </Text>
                    </Pressable>
                    {howTo(`${p.id}-${item.ex}`, ex)}
                    <Text style={styles.exLine}>
                      {a.last ? `Last: ${a.last}${ex.measure === "hold" ? " sec" : ""} · Best: ${unitLabel(ex, a.best ?? 0)}` : "Not logged yet"}
                      {a.status === "ready" ? "  ⬆ ready to progress" : a.status === "easier" ? "  ⬇ struggling: under half the target" : ""}
                    </Text>
                  </View>
                );
              })}
              <View style={styles.actions}>
                {finished && next && (
                  <Pressable style={styles.smallBtn} onPress={() => confirmStart(p.area, next.level)} disabled={busy}>
                    <Text style={styles.smallBtnText}>Move up to {next.label}</Text>
                  </Pressable>
                )}
                {finished && (
                  <Pressable style={styles.smallBtn} onPress={() => confirmStart(p.area, p.level)} disabled={busy}>
                    <Text style={styles.smallBtnText}>Repeat it</Text>
                  </Pressable>
                )}
                <Pressable style={[styles.smallBtn, styles.stopBtn]} onPress={() => stop(p)} disabled={busy}>
                  <Text style={[styles.smallBtnText, { color: themeText("#F87171") }]}>Stop</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
    </View>
  );
}

const styles = themedStyles({
  howTo: { backgroundColor: "#0F172A", borderRadius: 10, padding: 10, marginTop: 6 },
  card: { backgroundColor: "#1E293B", borderRadius: 12, marginTop: 12, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", padding: 12 },
  title: { color: "#fff", fontSize: 15, fontWeight: "700" },
  sub: { color: "#94A3B8", fontSize: 12.5, marginTop: 2 },
  arrow: { color: BRAND_GOLD, fontSize: 13, marginLeft: 8 },
  program: { borderTopWidth: 1, borderTopColor: "#0F172A", padding: 12 },
  programTitle: { color: BRAND_GOLD, fontSize: 14.5, fontWeight: "700" },
  row: { marginTop: 8 },
  exName: { color: "#E2E8F0", fontSize: 13.5, fontWeight: "600" },
  target: { color: "#94A3B8", fontWeight: "400" },
  exLine: { color: "#CBD5E1", fontSize: 12.5, marginTop: 1 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  smallBtn: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12 },
  smallBtnText: { color: BRAND_GOLD, fontSize: 13, fontWeight: "700" },
  stopBtn: { borderColor: "#F87171" },
  addBtn: { borderTopWidth: 1, borderTopColor: "#0F172A", padding: 12, alignItems: "center" },
  addText: { color: BRAND_GOLD, fontSize: 14, fontWeight: "700" },
  pickLabel: { color: "#fff", fontSize: 14, fontWeight: "700", marginTop: 4, marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  chip: { backgroundColor: "#0F172A", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  chipOn: { backgroundColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontSize: 13, fontWeight: "600" },
  chipTextOn: { color: "#0F172A" },
  levelRow: { backgroundColor: "#0F172A", borderRadius: 10, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: "transparent" },
  levelRowOn: { borderColor: BRAND_GOLD },
  levelTitle: { color: "#fff", fontSize: 14, fontWeight: "700" },
  levelWho: { color: "#94A3B8", fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  startBtn: { backgroundColor: BRAND_GOLD, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 18, minWidth: 90, alignItems: "center" },
  startText: { color: "#0F172A", fontSize: 14, fontWeight: "800" },
});
