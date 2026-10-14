import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { BRAND_GOLD } from "@/lib/brand";
import type { ClientStabilityProgram, StabilityLog } from "@/types/database";
import { assessExercise, findArea, findExercise, findProgram, levelInfo, phaseFor, stabilityWeek, targetText, unitLabel } from "@/lib/stability";

// For the trainer, on the client's Training tab: the stability programs the
// client is running, the week they're on, and for each of this week's
// exercises their last logged sets, their best, and whether they're ready to
// progress or struggling. Tap to open, so it stays out of the way.
export default function TrainerStabilityCard({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [programs, setPrograms] = useState<ClientStabilityProgram[]>([]);
  const [logs, setLogs] = useState<StabilityLog[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase
      .from("client_stability_programs")
      .select("*")
      .eq("client_id", clientId)
      .is("ended_at", null)
      .order("created_at")
      .then(async ({ data }) => {
        const rows = data ?? [];
        setPrograms(rows);
        if (rows.length === 0) return;
        const { data: logRows } = await supabase
          .from("stability_logs")
          .select("*")
          .in(
            "stability_program_id",
            rows.map((r) => r.id),
          )
          .order("log_date");
        setLogs(logRows ?? []);
      });
  }, [clientId]);

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={() => setOpen((o) => !o)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>🛡️ Stability programs</Text>
          <Text style={styles.sub}>
            {programs.length === 0
              ? `${clientName} isn't doing any yet. They start them from the menu: Stability & injury prevention.`
              : programs.map((p) => `${findArea(p.area).title} ${levelInfo(p.level).label}`).join(" · ")}
          </Text>
        </View>
        {programs.length > 0 && <Text style={styles.arrow}>{open ? "▲" : "▼"}</Text>}
      </Pressable>
      {open &&
        programs.map((p) => {
          const program = findProgram(p.area, p.level);
          const week = stabilityWeek(p.started_on, todayIso());
          const phase = phaseFor(program, week);
          const mine = logs.filter((l) => l.stability_program_id === p.id);
          const lastDate = mine.length ? mine[mine.length - 1].log_date : null;
          return (
            <View key={p.id} style={styles.program}>
              <Text style={styles.programTitle}>
                {findArea(p.area).icon} {findArea(p.area).title} · {levelInfo(p.level).label}
              </Text>
              <Text style={styles.sub}>
                {week > program.weeks ? `Finished all ${program.weeks} weeks` : `Week ${week} of ${program.weeks}: ${phase.title}`}
                {lastDate ? ` · last logged ${lastDate}` : " · nothing logged yet"}
              </Text>
              {phase.items.map((item) => {
                const ex = findExercise(p.area, item.ex)!;
                const a = assessExercise(
                  mine.filter((l) => l.exercise_key === item.ex),
                  item,
                  ex,
                );
                return (
                  <View key={item.ex} style={styles.row}>
                    <Text style={styles.exName}>
                      {ex.name} <Text style={styles.target}>({targetText(item, ex, "full")})</Text>
                    </Text>
                    <Text style={styles.exLine}>
                      {a.last ? `Last: ${a.last}${ex.measure === "hold" ? " sec" : ""} · Best: ${unitLabel(ex, a.best ?? 0)}` : "Not logged yet"}
                      {a.status === "ready" ? "  ⬆ ready to progress" : a.status === "easier" ? "  ⬇ struggling: under half the target" : ""}
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
