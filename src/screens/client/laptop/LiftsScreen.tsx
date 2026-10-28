import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { parseIsoDate, todayIso } from "@/lib/dates";
import { compare, liftChoices, liftSeries, sinceMonths } from "@/lib/progress";
import { bestSet, grouped, lastSession, liftedKg, monthStarts, oneRepMax, pctChange, records } from "@/lib/clientDashboard";
import { useWorkoutLogs } from "@/hooks/useClientDashboardData";
import ProgressChart, { fmt } from "@/components/ProgressChart";
import { Card, CardTitle, DashChips, DashPage, DashTabs, Muted, Pill, Row, Stat, Table, dash, natural } from "@/components/DashboardParts";

type Tab = "graph" | "records";
const RANGES: { key: number; label: string; months: number | null }[] = [
  { key: 3, label: "3 months", months: 3 },
  { key: 6, label: "6 months", months: 6 },
  { key: 12, label: "1 year", months: 12 },
  { key: 0, label: "All", months: null },
];
const PAGE = 12;

const shortDate = (iso: string) => parseIsoDate(iso).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });

// Weights lifted (GRIZZ, 2026-10-27): every set the client logged, as a graph
// per lift with their best set and last session beside it, and a Records
// page with their best set of every exercise.
export default function LiftsScreen() {
  const { client } = useAuth();
  const logs = useWorkoutLogs(client?.id);
  const today = todayIso();
  const [tab, setTab] = useState<Tab>("graph");
  const [lift, setLift] = useState<string | null>(null);
  const [range, setRange] = useState(6);
  const [page, setPage] = useState(0);

  const choices = useMemo(() => liftChoices(logs ?? [], 10), [logs]);
  const all = useMemo(() => records(logs ?? []), [logs]);

  if (!logs) return <ActivityIndicator color={BRAND_GOLD} style={{ marginTop: 40 }} />;

  const key = lift && choices.some((c) => c.key === lift) ? lift : choices[0]?.key ?? null;
  const label = choices.find((c) => c.key === key)?.label ?? "";

  const tabs = (
    <DashTabs<Tab>
      tabs={[
        { key: "graph", label: "Graphs" },
        { key: "records", label: "Records" },
      ]}
      on={tab}
      onPick={setTab}
    />
  );

  if (!key) {
    return (
      <DashPage title="Weights lifted" subtitle="Every set you log, as graphs and records" right={tabs}>
        <Card>
          <Muted>No sets logged yet. Once you log a workout, your weights show here.</Muted>
        </Card>
      </DashPage>
    );
  }

  if (tab === "records") {
    const pages = Math.max(1, Math.ceil(all.length / PAGE));
    const shown = all.slice(page * PAGE, page * PAGE + PAGE);
    return (
      <DashPage title="Weights lifted" subtitle="Your best set of every exercise" right={tabs}>
        <Card>
          <CardTitle right={<Pill text={`${all.length} exercises`} tone="grey" />}>🏆 Your records</CardTitle>
          <Table
            head={["Exercise", "Best set", "Estimated 1-rep max", "When"]}
            widths={[2.4, 1.2, 1.4, 1.2]}
            rows={shown.map((r) => [
              <Pressable key="n" onPress={() => { setLift(r.key); setTab("graph"); }}>
                <Text style={styles.link} numberOfLines={1}>{r.name}</Text>
              </Pressable>,
              `${fmt(r.kg)} kg × ${r.reps}`,
              `${fmt(r.oneRm)} kg`,
              shortDate(r.date),
            ])}
          />
          {pages > 1 && (
            <View style={styles.pager}>
              <Pressable disabled={page === 0} onPress={() => setPage(page - 1)} style={[styles.pageBtn, page === 0 && styles.off]}>
                <Text style={styles.pageText}>‹ Back</Text>
              </Pressable>
              <Text style={styles.small}>Page {page + 1} of {pages}</Text>
              <Pressable disabled={page >= pages - 1} onPress={() => setPage(page + 1)} style={[styles.pageBtn, page >= pages - 1 && styles.off]}>
                <Text style={styles.pageText}>Next ›</Text>
              </Pressable>
            </View>
          )}
          <Muted style={{ marginTop: 8 }}>Tap an exercise to see its graph. Estimated 1-rep max is worked out from your best set; you don't need to test it.</Muted>
        </Card>
      </DashPage>
    );
  }

  const series = liftSeries(logs, key);
  const points = sinceMonths(series.points, RANGES.find((r) => r.key === range)?.months ?? null, today);
  const cmp = compare(points, "up");
  const best = bestSet(logs, key);
  const { thisMonth, lastMonth, lastMonthEnd } = monthStarts(today);
  const volume = liftedKg(logs, thisMonth, today, key);
  const volumeChange = pctChange(volume, liftedKg(logs, lastMonth, lastMonthEnd, key));
  const last = lastSession(logs, key);
  let setNo = 0;
  const others = choices.filter((c) => c.key !== key).slice(0, 4);

  return (
    <DashPage title="Weights lifted" subtitle="Every set you log, as graphs and records" right={tabs}>
      <View style={styles.chipRow}>
        <View style={{ flex: 1 }}>
          <DashChips items={choices.map((c) => ({ key: c.key, label: c.label }))} on={key} onPick={setLift} />
        </View>
        <DashChips items={RANGES.map((r) => ({ key: r.key, label: r.label }))} on={range} onPick={setRange} />
      </View>

      <Row>
        <Card style={{ flex: 1.7 }}>
          <CardTitle
            right={cmp && cmp.change !== 0 && points.length > 1 ? <Pill text={`${cmp.change > 0 ? "▲" : "▼"} ${fmt(Math.abs(cmp.change))} ${series.unit}`} tone={cmp.change > 0 ? "green" : "grey"} /> : undefined}
          >
            {label} · {series.unit === "kg" ? "heaviest set each day" : "most reps in a set each day"}
          </CardTitle>
          <Muted>Click a dot to see that day's set</Muted>
          {points.length ? <ProgressChart points={points} unit={series.unit} height={340} /> : <Muted style={{ marginTop: 12 }}>Nothing in this time. Try All.</Muted>}
        </Card>
        <View style={styles.side}>
          <Stat
            style={natural}
            label="Best set"
            value={best ? `${fmt(best.kg)} kg × ${best.reps}` : "–"}
            note={best ? `${shortDate(best.date)} · estimated 1-rep max ${fmt(oneRepMax(best.kg, best.reps))} kg` : "Body weight only"}
          />
          <Stat
            style={natural}
            label="Lifted this month (weight × reps)"
            value={grouped(volume)}
            unit="kg"
            note={volumeChange != null ? `${volumeChange >= 0 ? "▲" : "▼"} ${Math.abs(volumeChange)}% on last month` : undefined}
            noteColor={volumeChange != null && volumeChange >= 0 ? dash.green : undefined}
          />
          {last && (
            <Card style={natural}>
              <CardTitle>Last time · {shortDate(last.date)}</CardTitle>
              <Table
                head={["Set", "Weight", "Reps", ""]}
                widths={[1.1, 1.1, 0.8, 0.8]}
                rows={last.sets.map((s) => {
                  const top = best && s.log_date === best.date && (s.weight_kg ?? 0) === best.kg && s.reps === best.reps;
                  return [
                    s.warm_up ? "Warm-up" : String(++setNo),
                    s.weight_kg ? `${fmt(s.weight_kg)} kg` : "Body",
                    String(s.reps),
                    top ? <Text key="b" style={styles.gold}>🏆 Best</Text> : "",
                  ];
                })}
              />
            </Card>
          )}
        </View>
      </Row>

      {others.length > 0 && (
        <Row>
          {others.map((o) => {
            const s = liftSeries(logs, o.key);
            const c = compare(s.points, "up");
            return (
              <Card key={o.key} onPress={() => setLift(o.key)}>
                <Text style={styles.label} numberOfLines={1}>{o.label}</Text>
                <Text style={styles.value}>
                  {c ? `${fmt(c.latest.value)} ${s.unit}` : "–"}
                  {c && s.points.length > 1 ? (
                    <Text style={[styles.small, { color: c.change > 0 ? dash.green : c.change < 0 ? dash.orange : dash.muted }]}>
                      {"  "}{c.change > 0 ? "▲" : c.change < 0 ? "▼" : "="} {fmt(Math.abs(c.change))}
                    </Text>
                  ) : null}
                </Text>
                <Text style={styles.small}>Last time, and the change since your first</Text>
              </Card>
            );
          })}
        </Row>
      )}
    </DashPage>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  side: { flex: 1, gap: 16 },
  link: { color: BRAND_GOLD, fontSize: 14, fontWeight: "600" },
  small: { color: dash.muted, fontSize: 12 },
  gold: { color: BRAND_GOLD, fontWeight: "700", fontSize: 13 },
  label: { color: dash.muted, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  value: { color: "#fff", fontSize: 22, fontWeight: "800", marginTop: 4 },
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  pageBtn: { backgroundColor: "#1B2846", borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
  pageText: { color: "#fff", fontWeight: "700" },
  off: { opacity: 0.4 },
});
