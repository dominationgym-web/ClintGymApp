import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { todayIso } from "@/lib/dates";
import { addDays } from "@/lib/programSchedule";
import { mondayOf, weekDates } from "@/lib/trainingCalendar";
import { bodySeries, sinceMonths } from "@/lib/progress";
import { exercisesByDay, exercisesLabel, grouped, liftedKg, newBests, pctChange } from "@/lib/clientDashboard";
import { dayTotals } from "@/lib/dietPlan";
import { eatenOn, tickedSource } from "@/lib/mealTicks";
import { useMealTicks } from "@/hooks/useMealTicks";
import { planDay, useBodyStats, useFoodPlan, useWorkoutLogs } from "@/hooks/useClientDashboardData";
import ProgressChart, { fmt } from "@/components/ProgressChart";
import { Card, CardTitle, DashPage, Muted, Pill, Row, Stat, Table, dash, Bar } from "@/components/DashboardParts";
import type { ClientTabParamList } from "@/navigation/types";
import { themeText, themedStyles } from "@/lib/theme";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// My week (GRIZZ, 2026-10-27): the client's laptop home page. Their weight,
// training, check-ins and food for this week on one screen.
export default function MyWeekScreen() {
  const { client } = useAuth();
  const navigation = useNavigation<BottomTabNavigationProp<ClientTabParamList>>();
  const clientId = client?.id;
  const today = todayIso();
  const monday = mondayOf(today);
  const days = weekDates(monday);
  const logs = useWorkoutLogs(clientId);
  const stats = useBodyStats(clientId);
  const food = useFoodPlan(clientId);
  const { ticks } = useMealTicks(clientId, today);
  const [checkins, setCheckins] = useState<string[]>([]);
  const [steps, setSteps] = useState<Record<string, number>>({});
  const [note, setNote] = useState<{ body: string; created_at: string } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!clientId) return;
      Promise.all([
        supabase.from("checkins").select("checkin_date").eq("client_id", clientId).gte("checkin_date", monday),
        supabase.from("client_steps").select("step_date, steps").eq("client_id", clientId).gte("step_date", monday),
        supabase.from("coach_messages").select("body, created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1),
      ]).then(([c, s, m]) => {
        setCheckins(((c.data as { checkin_date: string }[] | null) ?? []).map((r) => r.checkin_date));
        setSteps(Object.fromEntries(((s.data as { step_date: string; steps: number }[] | null) ?? []).map((r) => [r.step_date, r.steps])));
        setNote(((m.data as { body: string; created_at: string }[] | null) ?? [])[0] ?? null);
      });
    }, [clientId, monday]),
  );

  const week = useMemo(() => {
    if (!logs) return null;
    const byDay = exercisesByDay(logs, days);
    const lastMonday = addDays(monday, -7);
    const lifted = liftedKg(logs, monday, days[6]);
    const liftedBefore = liftedKg(logs, lastMonday, addDays(monday, -1));
    return {
      byDay,
      trained: days.filter((d) => (byDay.get(d) ?? []).length > 0).length,
      lifted,
      change: pctChange(lifted, liftedBefore),
      bests: newBests(logs, monday),
    };
    // days is rebuilt each render from monday.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, monday]);

  if (!client || !week || !stats || !food) return <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginTop: 40 }} />;

  const weights = bodySeries(stats, "weight_kg");
  const latest = weights[weights.length - 1];
  const sinceStart = latest && weights.length > 1 ? Math.round((latest.value - weights[0].value) * 10) / 10 : null;
  const recent = sinceMonths(weights, 3, today);
  const checkinCount = days.filter((d) => checkins.includes(d)).length;
  const daysSoFar = days.filter((d) => d <= today).length;

  const source = tickedSource(ticks, today);
  const kind = source === "rest" || (source == null && food.kind === "own" && !food.plan.settings.training) ? "rest" : "training";
  const todayPlan = planDay(food, new Date(), kind);
  const planned = todayPlan ? dayTotals(todayPlan.day) : null;
  const eaten = eatenOn(ticks, today);
  const best = week.bests[0];

  return (
    <DashPage
      title={`Hi ${client.name.split(" ")[0]} 👋`}
      subtitle="Your week at a glance"
      right={
        <Pressable style={styles.start} onPress={() => navigation.navigate("Exercises")} accessibilityRole="button">
          <Text style={styles.startText}>▶ Today's workout</Text>
        </Pressable>
      }
    >
      <Row>
        <Stat
          label="Body weight"
          value={latest ? fmt(latest.value) : "–"}
          unit={latest ? "kg" : undefined}
          note={sinceStart != null ? `${sinceStart > 0 ? "▲" : sinceStart < 0 ? "▼" : "="} ${fmt(Math.abs(sinceStart))} kg since you started` : "Add a weigh-in on Body & weight"}
        />
        <Stat label="Days trained this week" value={String(week.trained)} unit={week.trained === 1 ? "day" : "days"} bar={week.trained / 7} barColor="#22C55E" />
        <Stat label="Check-ins this week" value={`${checkinCount} / ${daysSoFar}`} note={checkinCount < daysSoFar ? "A quick check-in each day helps your coach" : "Every day so far. Great!"} />
        <Stat
          label="Total lifted this week"
          value={grouped(week.lifted)}
          unit="kg"
          note={week.change != null ? `${week.change >= 0 ? "▲" : "▼"} ${Math.abs(week.change)}% on last week` : "Weight × reps of every working set"}
          noteColor={week.change != null && week.change >= 0 ? dash.green : undefined}
        />
      </Row>

      <Row>
        <Card style={{ flex: 1.5 }}>
          <CardTitle right={sinceStart != null && sinceStart !== 0 ? <Pill text={`${sinceStart > 0 ? "+" : ""}${fmt(sinceStart)} kg since you started`} tone="gold" /> : undefined}>
            Body weight
          </CardTitle>
          <Muted>Last 3 months</Muted>
          {recent.length ? <ProgressChart points={recent} unit="kg" height={300} /> : <Muted style={{ marginTop: 12 }}>No weigh-ins yet. Add one on Body & weight.</Muted>}
        </Card>
        <Card>
          <CardTitle>This week</CardTitle>
          <Muted>What you've done each day</Muted>
          <Table
            widths={[0.6, 2.2, 1.2]}
            rows={days.map((d, i) => {
              const done = week.byDay.get(d) ?? [];
              const isToday = d === today;
              const future = d > today;
              return [
                <Text key="d" style={[styles.td, isToday && styles.today]}>{DAY_NAMES[i]}</Text>,
                <Text key="w" style={[styles.td, isToday && styles.bold]} numberOfLines={1}>
                  {done.length ? exercisesLabel(done) : future ? "" : isToday ? "Not trained yet" : "Rest day"}
                </Text>,
                <View key="c">
                  <Text style={[styles.small, checkins.includes(d) && { color: themeText(dash.green) }]}>{checkins.includes(d) ? "✓ Check-in" : future ? "" : "No check-in"}</Text>
                  {steps[d] != null ? <Text style={styles.small}>👟 {grouped(steps[d])} steps</Text> : null}
                </View>,
              ];
            })}
          />
        </Card>
      </Row>

      <Row>
        <Card onPress={() => navigation.navigate("Lifts")}>
          <CardTitle>🏆 New best this week</CardTitle>
          {best ? (
            <Text style={styles.td}>
              {best.name} <Text style={styles.gold}>{fmt(best.kg)} kg × {best.reps}</Text> (was {fmt(best.was.kg)} kg × {best.was.reps})
            </Text>
          ) : (
            <Muted>No new best yet this week. Every set counts!</Muted>
          )}
        </Card>
        <Card onPress={() => navigation.navigate("Food")}>
          <CardTitle>🍽️ Today's food</CardTitle>
          {planned ? (
            <>
              <Text style={styles.td}>
                {grouped(eaten.kcal)} / {grouped(planned.kcal)} kcal · Protein {Math.round(eaten.protein)} / {planned.protein} g
              </Text>
              <Bar fraction={planned.kcal ? eaten.kcal / planned.kcal : 0} />
            </>
          ) : (
            <Muted>No meal plan yet. Make one under Nutrition & diet.</Muted>
          )}
        </Card>
        <Card>
          <CardTitle>💬 Your coach's last note</CardTitle>
          {note ? (
            <>
              <Text style={styles.noteText} numberOfLines={3}>"{note.body}"</Text>
              <Text style={styles.small}>{new Date(note.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}</Text>
            </>
          ) : (
            <Muted>No notes yet.</Muted>
          )}
        </Card>
      </Row>
    </DashPage>
  );
}

const styles = themedStyles({
  start: { backgroundColor: "#22C55E", borderRadius: 10, paddingVertical: 11, paddingHorizontal: 18 },
  startText: { color: "#06210F", fontWeight: "800", fontSize: 14 },
  td: { color: dash.text, fontSize: 14 },
  today: { color: BRAND_GOLD, fontWeight: "800" },
  bold: { fontWeight: "700" },
  small: { color: dash.muted, fontSize: 12 },
  gold: { color: BRAND_GOLD, fontWeight: "800" },
  noteText: { color: "#CBD5E1", fontSize: 13, fontStyle: "italic", lineHeight: 19 },
});
