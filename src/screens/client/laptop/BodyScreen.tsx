import React, { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { parseIsoDate, todayIso } from "@/lib/dates";
import { BODY_MEASURES, WEIGH_IN_OPTIONS, bodySeries, compare, weighInDueIn, type BodyMeasureKey, type WeighInEvery } from "@/lib/progress";
import { perWeek } from "@/lib/clientDashboard";
import { addDays } from "@/lib/programSchedule";
import { useBodyStats } from "@/hooks/useClientDashboardData";
import ProgressChart, { fmt } from "@/components/ProgressChart";
import ProgressPhotosSection from "@/components/ProgressPhotosSection";
import { Card, CardTitle, DashChips, DashPage, DashTabs, Muted, Pill, Row, Stat, Table, dash } from "@/components/DashboardParts";
import type { ClientTabParamList } from "@/navigation/types";
import { themeText, themedStyles } from "@/lib/theme";

type Tab = "weight" | "measurements" | "photos";
const dateLabel = (iso: string) => parseIsoDate(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt(Math.abs(n))}`;

// Body & weight (GRIZZ, 2026-10-27): weight since they started, every
// measurement from start to now, and their progress photos.
export default function BodyScreen() {
  const { client } = useAuth();
  const navigation = useNavigation<BottomTabNavigationProp<ClientTabParamList>>();
  const stats = useBodyStats(client?.id);
  const [tab, setTab] = useState<Tab>("weight");
  const [measure, setMeasure] = useState<BodyMeasureKey>("waist_cm");
  const today = todayIso();

  if (!client || !stats) return <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginTop: 40 }} />;

  const weights = bodySeries(stats, "weight_kg");
  const w = compare(weights, null);
  const lowest = weights.length ? weights.reduce((a, p) => (p.value < a.value ? p : a)) : null;
  const pace = perWeek(weights);
  const every = (client as { weigh_in_every?: WeighInEvery | null }).weigh_in_every ?? null;
  const dueIn = weighInDueIn(every, weights[weights.length - 1]?.date ?? null, today);
  const schedule = WEIGH_IN_OPTIONS.find((o) => o.key === every)?.label;
  const nextLine =
    dueIn == null ? "Weigh in whenever you like" : dueIn <= 0 ? `${schedule} · due now` : `${schedule} · next one ${dateLabel(addDays(today, dueIn))}`;

  const measures = BODY_MEASURES.filter((m) => m.key !== "weight_kg").map((m) => ({ ...m, points: bodySeries(stats, m.key) }));
  const withData = measures.filter((m) => m.points.length > 0);
  const shownMeasure = withData.find((m) => m.key === measure) ?? withData[0];

  const addWeighIn = (
    <Pressable style={styles.add} onPress={() => navigation.navigate("Profile", { open: "progress" })} accessibilityRole="button">
      <Text style={styles.addText}>＋ Add a weigh-in</Text>
    </Pressable>
  );

  const tabs = (
    <View style={styles.topRight}>
      <DashTabs<Tab>
        tabs={[
          { key: "weight", label: "Weight" },
          { key: "measurements", label: "Measurements" },
          { key: "photos", label: "Progress photos" },
        ]}
        on={tab}
        onPick={setTab}
      />
      {addWeighIn}
    </View>
  );

  if (tab === "photos") {
    return (
      <DashPage title="Body & weight" subtitle="Your progress photos, private unless you share them with your coach" right={tabs}>
        <Card style={styles.photos}>
          <ProgressPhotosSection bare />
        </Card>
      </DashPage>
    );
  }

  if (tab === "measurements") {
    return (
      <DashPage title="Body & weight" subtitle="Each measurement over time" right={tabs}>
        {shownMeasure ? (
          <>
            <DashChips items={withData.map((m) => ({ key: m.key, label: m.label }))} on={shownMeasure.key} onPick={setMeasure} />
            <Card>
              <CardTitle>{shownMeasure.label}</CardTitle>
              <ProgressChart points={shownMeasure.points} unit={shownMeasure.unit} height={380} />
            </Card>
          </>
        ) : (
          <Card>
            <Muted>No measurements yet. Add your waist, hips, chest, arm or thigh with your next weigh-in.</Muted>
          </Card>
        )}
      </DashPage>
    );
  }

  return (
    <DashPage title="Body & weight" subtitle={nextLine} right={tabs}>
      <Row>
        <Stat label="Start" value={w ? fmt(w.start.value) : "–"} unit={w ? "kg" : undefined} note={w ? dateLabel(w.start.date) : undefined} />
        <Stat label="Now" value={w ? fmt(w.latest.value) : "–"} unit={w ? "kg" : undefined} note={w ? dateLabel(w.latest.date) : undefined} valueColor={BRAND_GOLD} />
        <Stat label="Change" value={w && weights.length > 1 ? signed(w.change) : "–"} unit={w && weights.length > 1 ? "kg" : undefined} note={pace != null ? `About ${fmt(Math.abs(pace))} kg a week` : undefined} />
        <Stat label="Lowest" value={lowest ? fmt(lowest.value) : "–"} unit={lowest ? "kg" : undefined} note={lowest ? dateLabel(lowest.date) : undefined} />
      </Row>
      <Row>
        <Card style={{ flex: 1.7 }}>
          <CardTitle right={weights.length ? <Pill text={`${weights.length} weigh-in${weights.length === 1 ? "" : "s"}`} tone="grey" /> : undefined}>
            Weight since you started
          </CardTitle>
          {weights.length ? (
            <ProgressChart points={weights} unit="kg" height={360} />
          ) : (
            <Muted style={{ marginTop: 12 }}>No weigh-ins yet. Tap ＋ Add a weigh-in to start your graph.</Muted>
          )}
        </Card>
        <Card>
          <CardTitle>Measurements</CardTitle>
          <Muted>Start → now</Muted>
          {withData.length ? (
            <Table
              widths={[1, 1.6, 0.8]}
              rows={withData.map((m) => {
                const c = compare(m.points, null)!;
                return [
                  <Pressable key="n" onPress={() => { setMeasure(m.key); setTab("measurements"); }}>
                    <Text style={styles.link}>{m.label}</Text>
                  </Pressable>,
                  m.points.length > 1 ? `${fmt(c.start.value)} → ${fmt(c.latest.value)} ${m.unit}` : `${fmt(c.latest.value)} ${m.unit}`,
                  <Text key="c" style={[styles.change, c.change !== 0 && { color: themeText(BRAND_GOLD) }]}>{m.points.length > 1 ? signed(c.change) : ""}</Text>,
                ];
              })}
            />
          ) : (
            <Muted style={{ marginTop: 8 }}>None yet. A tape measure each weigh-in shows changes the scale can miss.</Muted>
          )}
        </Card>
      </Row>
    </DashPage>
  );
}

const styles = themedStyles({
  topRight: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  add: { backgroundColor: "#22C55E", borderRadius: 9, paddingVertical: 9, paddingHorizontal: 14 },
  addText: { color: "#06210F", fontWeight: "800", fontSize: 14 },
  photos: { maxWidth: 720, width: "100%", alignSelf: "center" },
  link: { color: BRAND_GOLD, fontSize: 14, fontWeight: "600" },
  change: { color: dash.muted, fontSize: 14, fontWeight: "700" },
});
