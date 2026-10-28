import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import TextInput from "@/components/TextInput";
import KeyboardSafe from "@/components/KeyboardSafe";
import ProgressChart, { fmt } from "@/components/ProgressChart";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { BRAND_GOLD } from "@/lib/brand";
import { addDays } from "@/lib/programSchedule";
import {
  BODY_MEASURES,
  CARDIO_MACHINES,
  WEIGH_IN_OPTIONS,
  bodySeries,
  cardioChoices,
  cardioSeries,
  compare,
  liftChoices,
  liftSeries,
  parseTime,
  sinceMonths,
  weighInDueIn,
  type Better,
  type BodyMeasureKey,
  type BodyStat,
  type CardioTest,
  type LiftLog,
  type Point,
  type WeighInEvery,
} from "@/lib/progress";
import { themeText, themedStyles } from "@/lib/theme";

// The Progress section (0143, GRIZZ 2026-10-22). Three pages you tap between,
// each one graph: main lifts from the training log, timed cardio tests, and
// weight and measurements. The client sees it on their Profile, the trainer
// on the client's Training tab, where they also set how often to weigh in.
type Page = "strength" | "cardio" | "body";
const RANGES: { label: string; months: number | null }[] = [
  { label: "3 months", months: 3 },
  { label: "6 months", months: 6 },
  { label: "1 year", months: 12 },
  { label: "All", months: null },
];

export default function ProgressCard({ clientId, role }: { clientId: string; role: "client" | "trainer" }) {
  const today = todayIso();
  const [page, setPage] = useState<Page>("strength");
  const [range, setRange] = useState<number | null>(null);
  const [logs, setLogs] = useState<LiftLog[] | null>(null);
  const [tests, setTests] = useState<CardioTest[]>([]);
  const [stats, setStats] = useState<BodyStat[]>([]);
  const [every, setEvery] = useState<WeighInEvery | null>(null);
  const [lift, setLift] = useState<string | null>(null);
  const [cardio, setCardio] = useState<string | null>(null);
  const [measure, setMeasure] = useState<"distance" | "calories">("distance");
  const [body, setBody] = useState<BodyMeasureKey>("weight_kg");
  const [adding, setAdding] = useState<"cardio" | "body" | null>(null);

  const load = useCallback(async () => {
    const all: LiftLog[] = [];
    for (let from = 0; from < 20000; from += 1000) {
      const { data } = await supabase
        .from("workout_logs")
        .select("exercise_name, log_date, weight_kg, reps, warm_up")
        .eq("client_id", clientId)
        .order("id")
        .range(from, from + 999);
      all.push(...((data as LiftLog[] | null) ?? []));
      if (!data || data.length < 1000) break;
    }
    const [t, s, c] = await Promise.all([
      supabase.from("client_cardio_tests").select("*").eq("client_id", clientId).order("test_date"),
      supabase.from("client_body_stats").select("*").eq("client_id", clientId).order("measured_on"),
      supabase.from("clients").select("weigh_in_every").eq("id", clientId).maybeSingle(),
    ]);
    setLogs(all);
    setTests((t.data as CardioTest[] | null) ?? []);
    setStats((s.data as BodyStat[] | null) ?? []);
    setEvery((c.data?.weigh_in_every as WeighInEvery | null) ?? null);
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const lifts = useMemo(() => liftChoices(logs ?? []), [logs]);
  const cardios = useMemo(() => cardioChoices(tests), [tests]);
  const liftNow = lift && lifts.some((l) => l.key === lift) ? lift : lifts[0]?.key ?? null;
  const cardioNow = cardio && cardios.some((c) => c.key === cardio) ? cardio : cardios[0]?.key ?? null;

  const setSchedule = async (key: WeighInEvery | null) => {
    const { error } = await supabase.from("clients").update({ weigh_in_every: key, weigh_in_reminded_on: null }).eq("id", clientId);
    if (error) Alert.alert("Couldn't save it", error.message);
    else setEvery(key);
  };

  if (!logs) return <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginVertical: 12 }} />;

  let points: Point[] = [];
  let unit = "";
  let better: Better = "up";
  if (page === "strength" && liftNow) {
    const s = liftSeries(logs, liftNow);
    points = s.points;
    unit = s.unit;
  } else if (page === "cardio" && cardioNow) {
    points = cardioSeries(tests, cardioNow, measure);
    unit = measure === "distance" ? "m" : "cal";
  } else if (page === "body") {
    points = bodySeries(stats, body);
    unit = BODY_MEASURES.find((m) => m.key === body)!.unit;
    better = null;
  }
  points = sinceMonths(points, range, today);
  const cmp = compare(points, better);
  const lastWeight = [...stats].reverse().find((s) => s.weight_kg != null)?.measured_on ?? null;
  const dueIn = weighInDueIn(every, lastWeight, today);

  return (
    <View>
      <View style={styles.tabs}>
        {(
          [
            ["strength", "💪 Strength"],
            ["cardio", "🚴 Cardio"],
            ["body", "⚖️ Body"],
          ] as const
        ).map(([k, label]) => (
          <Pressable key={k} style={[styles.tab, page === k && styles.tabOn]} onPress={() => setPage(k)}>
            <Text style={[styles.tabText, page === k && styles.tabTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {page === "strength" && (
        <Chips
          items={lifts.map((l) => ({ key: l.key, label: l.label }))}
          on={liftNow}
          onPick={setLift}
          empty="No sets logged yet. Squats, leg press, pull-ups and bench show here once they're logged."
        />
      )}

      {page === "cardio" && (
        <>
          <Chips items={cardios} on={cardioNow} onPick={setCardio} empty="No cardio tests yet. Log one to start the graph, e.g. Assault bike for 10 minutes." />
          {cardioNow && (
            <View style={[styles.chips, { marginTop: 6 }]}>
              {(["distance", "calories"] as const).map((m) => (
                <Pressable key={m} style={[styles.smallChip, measure === m && styles.chipOn]} onPress={() => setMeasure(m)}>
                  <Text style={[styles.chipText, measure === m && styles.chipTextOn]}>{m === "distance" ? "Distance" : "Calories"}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}

      {page === "body" && (
        <>
          {role === "trainer" ? (
            <View>
              <Text style={styles.label}>Weigh-in</Text>
              <View style={styles.chips}>
                {WEIGH_IN_OPTIONS.map((o) => (
                  <Pressable key={o.key} style={[styles.smallChip, every === o.key && styles.chipOn]} onPress={() => setSchedule(every === o.key ? null : o.key)}>
                    <Text style={[styles.chipText, every === o.key && styles.chipTextOn]}>{o.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          {dueIn !== null && (
            <Text style={[styles.due, dueIn <= 0 && { color: themeText(BRAND_GOLD) }]}>
              {role === "client" ? `Your coach asks for a weigh-in ${WEIGH_IN_OPTIONS.find((o) => o.key === every)!.label.toLowerCase()}. ` : ""}
              {dueIn <= 0 ? "Weigh-in due now." : `Next weigh-in in ${dueIn} day${dueIn === 1 ? "" : "s"}.`}
            </Text>
          )}
          <View style={[styles.chips, { marginTop: 8 }]}>
            {BODY_MEASURES.filter((m) => m.key === "weight_kg" || stats.some((s) => s[m.key] != null)).map((m) => (
              <Pressable key={m.key} style={[styles.smallChip, body === m.key && styles.chipOn]} onPress={() => setBody(m.key)}>
                <Text style={[styles.chipText, body === m.key && styles.chipTextOn]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {(page !== "strength" || liftNow) && (page !== "cardio" || cardioNow) && (
        <View style={{ marginTop: 12 }}>
          <ProgressChart points={points} unit={unit} color={cmp?.trend === "worse" ? "#EF4444" : cmp?.trend === "better" ? "#22C55E" : BRAND_GOLD} />
          {cmp && points.length > 1 && (
            <>
              <View style={styles.compare}>
                <Box label="Start" value={`${fmt(cmp.start.value)} ${unit}`} date={cmp.start.date} />
                <Box label="Best" value={`${fmt(cmp.best.value)} ${unit}`} date={cmp.best.date} />
                <Box label="Latest" value={`${fmt(cmp.latest.value)} ${unit}`} date={cmp.latest.date} />
              </View>
              <Text style={[styles.change, cmp.trend === "better" && styles.up, cmp.trend === "worse" && styles.down]}>
                {cmp.change > 0 ? "▲" : cmp.change < 0 ? "▼" : "="} {cmp.change > 0 ? "+" : ""}
                {fmt(cmp.change)} {unit}
                {cmp.pct !== null && cmp.change !== 0 ? ` (${cmp.pct > 0 ? "+" : ""}${fmt(cmp.pct)}%)` : ""} since {cmp.start.date}
              </Text>
            </>
          )}
          <View style={[styles.chips, { marginTop: 10 }]}>
            {RANGES.map((r) => (
              <Pressable key={r.label} style={[styles.smallChip, range === r.months && styles.chipOn]} onPress={() => setRange(r.months)}>
                <Text style={[styles.chipText, range === r.months && styles.chipTextOn]}>{r.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {page === "cardio" && (
        <Pressable style={styles.button} onPress={() => setAdding("cardio")}>
          <Text style={styles.buttonText}>+ Log a cardio test</Text>
        </Pressable>
      )}
      {page === "body" && (
        <Pressable style={styles.button} onPress={() => setAdding("body")}>
          <Text style={styles.buttonText}>+ Add weight and measurements</Text>
        </Pressable>
      )}

      {adding === "cardio" && (
        <CardioTestModal
          clientId={clientId}
          onClose={() => setAdding(null)}
          onSaved={(key) => {
            setAdding(null);
            setCardio(key);
            load();
          }}
        />
      )}
      {adding === "body" && (
        <BodyStatModal
          clientId={clientId}
          onClose={() => setAdding(null)}
          onSaved={() => {
            setAdding(null);
            load();
          }}
        />
      )}
    </View>
  );
}

function Chips({ items, on, onPick, empty }: { items: { key: string; label: string }[]; on: string | null; onPick: (k: string) => void; empty: string }) {
  if (!items.length) return <Text style={styles.empty}>{empty}</Text>;
  return (
    <View style={[styles.chips, { marginTop: 10 }]}>
      {items.map((i) => (
        <Pressable key={i.key} style={[styles.chip, on === i.key && styles.chipOn]} onPress={() => onPick(i.key)}>
          <Text style={[styles.chipText, on === i.key && styles.chipTextOn]}>{i.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Box({ label, value, date }: { label: string; value: string; date: string }) {
  return (
    <View style={styles.box}>
      <Text style={styles.boxLabel}>{label}</Text>
      <Text style={styles.boxValue}>{value}</Text>
      <Text style={styles.boxDate}>{date}</Text>
    </View>
  );
}

function DayChips({ day, setDay }: { day: string; setDay: (d: string) => void }) {
  const today = todayIso();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
  return (
    <View style={styles.chips}>
      {days.map((d, i) => (
        <Pressable key={d} style={[styles.smallChip, day === d && styles.chipOn]} onPress={() => setDay(d)}>
          <Text style={[styles.chipText, day === d && styles.chipTextOn]}>{i === 0 ? "Today" : i === 1 ? "Yesterday" : d.slice(5)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const num = (s: string): number | null => {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : NaN;
};

function CardioTestModal({ clientId, onClose, onSaved }: { clientId: string; onClose: () => void; onSaved: (key: string) => void }) {
  const [machine, setMachine] = useState(CARDIO_MACHINES[0]);
  const [other, setOther] = useState("");
  const [day, setDay] = useState(todayIso());
  const [time, setTime] = useState("");
  const [distance, setDistance] = useState("");
  const [calories, setCalories] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const name = machine === "Other" ? other.trim() : machine;
    const seconds = parseTime(time);
    const d = num(distance);
    const c = num(calories);
    if (!name) return Alert.alert("Check this", "Type the machine or exercise.");
    if (!seconds) return Alert.alert("Check this", "Type the time, e.g. 10 for 10 minutes or 2:30.");
    if (Number.isNaN(d) || Number.isNaN(c)) return Alert.alert("Check this", "Distance and calories must be numbers.");
    if (d === null && c === null) return Alert.alert("Check this", "Add the distance, the calories, or both.");
    setSaving(true);
    const { error } = await supabase.from("client_cardio_tests").insert({ client_id: clientId, test_date: day, machine: name, seconds, distance_m: d, calories: c });
    setSaving(false);
    if (error) return Alert.alert("Couldn't save it", error.message);
    onSaved(`${name.toLowerCase()}|${seconds}`);
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardSafe>
        <View style={styles.backdrop}>
          <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetTitle}>Log a cardio test</Text>
            <Text style={styles.helper}>Do the same machine for the same time each test, so the graph compares like with like.</Text>
            <Text style={styles.label}>Machine</Text>
            <View style={styles.chips}>
              {[...CARDIO_MACHINES, "Other"].map((m) => (
                <Pressable key={m} style={[styles.smallChip, machine === m && styles.chipOn]} onPress={() => setMachine(m)}>
                  <Text style={[styles.chipText, machine === m && styles.chipTextOn]}>{m}</Text>
                </Pressable>
              ))}
            </View>
            {machine === "Other" && (
              <TextInput style={styles.input} value={other} onChangeText={setOther} placeholder="Which machine or exercise?" placeholderTextColor="#64748B" maxLength={60} />
            )}
            <Text style={styles.label}>When?</Text>
            <DayChips day={day} setDay={setDay} />
            <Text style={styles.label}>Time (minutes, or min:sec)</Text>
            <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="e.g. 10 or 2:30" placeholderTextColor="#64748B" keyboardType="numbers-and-punctuation" />
            <Text style={styles.label}>Distance covered (metres)</Text>
            <TextInput style={styles.input} value={distance} onChangeText={setDistance} placeholder="e.g. 3200" placeholderTextColor="#64748B" keyboardType="decimal-pad" />
            <Text style={styles.label}>Calories burned</Text>
            <TextInput style={styles.input} value={calories} onChangeText={setCalories} placeholder="e.g. 150" placeholderTextColor="#64748B" keyboardType="decimal-pad" />
            <Pressable style={[styles.button, saving && { opacity: 0.5 }]} onPress={save} disabled={saving}>
              <Text style={styles.buttonText}>Save</Text>
            </Pressable>
            <Pressable style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardSafe>
    </Modal>
  );
}

function BodyStatModal({ clientId, onClose, onSaved }: { clientId: string; onClose: () => void; onSaved: () => void }) {
  const [day, setDay] = useState(todayIso());
  const [values, setValues] = useState<Partial<Record<BodyMeasureKey, string>>>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const row: Record<string, number> = {};
    for (const m of BODY_MEASURES) {
      const n = num(values[m.key] ?? "");
      if (Number.isNaN(n)) return Alert.alert("Check this", `${m.label} must be a number.`);
      if (n !== null) row[m.key] = n;
    }
    if (!Object.keys(row).length) return Alert.alert("Check this", "Add your weight or at least one measurement.");
    setSaving(true);
    const { error } = await supabase.from("client_body_stats").insert({ client_id: clientId, measured_on: day, ...row });
    setSaving(false);
    if (error) return Alert.alert("Couldn't save it", error.message);
    onSaved();
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardSafe>
        <View style={styles.backdrop}>
          <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetTitle}>Weight and measurements</Text>
            <Text style={styles.helper}>Weigh in the same way each time: first thing in the morning, after the toilet, before eating. Leave out anything you didn't measure.</Text>
            <Text style={styles.label}>When?</Text>
            <DayChips day={day} setDay={setDay} />
            <View style={styles.grid}>
              {BODY_MEASURES.map((m) => (
                <View key={m.key} style={styles.gridCell}>
                  <Text style={styles.label}>
                    {m.label} ({m.unit})
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={values[m.key] ?? ""}
                    onChangeText={(t) => setValues((v) => ({ ...v, [m.key]: t }))}
                    keyboardType="decimal-pad"
                    placeholderTextColor="#64748B"
                  />
                </View>
              ))}
            </View>
            <Pressable style={[styles.button, saving && { opacity: 0.5 }]} onPress={save} disabled={saving}>
              <Text style={styles.buttonText}>Save</Text>
            </Pressable>
            <Pressable style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardSafe>
    </Modal>
  );
}

const styles = themedStyles({
  tabs: { flexDirection: "row", gap: 6 },
  tab: { flex: 1, borderWidth: 1, borderColor: "#334155", borderRadius: 10, paddingVertical: 9, alignItems: "center" },
  tabOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  tabText: { color: "#E2E8F0", fontWeight: "700", fontSize: 13 },
  tabTextOn: { color: "#0B1426" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#334155", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  smallChip: { borderWidth: 1, borderColor: "#334155", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipText: { color: "#E2E8F0", fontSize: 13 },
  chipTextOn: { color: "#0B1426", fontWeight: "700" },
  empty: { color: "#94A3B8", fontSize: 13, marginTop: 12 },
  label: { color: "#CBD5E1", fontSize: 13, fontWeight: "600", marginTop: 12, marginBottom: 6 },
  due: { color: "#94A3B8", fontSize: 13, marginTop: 8 },
  compare: { flexDirection: "row", gap: 6, marginTop: 12 },
  box: { flex: 1, backgroundColor: "#0F172A", borderRadius: 8, padding: 8, alignItems: "center" },
  boxLabel: { color: "#94A3B8", fontSize: 11 },
  boxValue: { color: "#fff", fontWeight: "800", fontSize: 15, marginTop: 2 },
  boxDate: { color: "#64748B", fontSize: 10, marginTop: 2 },
  change: { color: "#CBD5E1", fontWeight: "700", marginTop: 8 },
  up: { color: "#22C55E" },
  down: { color: "#EF4444" },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 12 },
  buttonText: { color: "#0B1426", fontWeight: "700", fontSize: 15 },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { flexGrow: 0, maxHeight: "92%", backgroundColor: "#1E293B", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  sheetTitle: { color: "#fff", fontWeight: "700", fontSize: 18 },
  helper: { color: "#94A3B8", fontSize: 12, marginTop: 4 },
  input: { backgroundColor: "#0F172A", color: "#fff", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridCell: { width: "47%" },
  cancel: { alignItems: "center", paddingVertical: 12 },
  cancelText: { color: "#94A3B8", fontSize: 15 },
});

