import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, Pressable, RefreshControl, Switch, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { TrainerStackParamList } from "@/navigation/types";
import { ScrollView } from "@/components/ScrollView";
import TextInput from "@/components/TextInput";
import ScreenTabBar, { type ScreenTab } from "@/components/ScreenTabBar";
import FoldSection from "@/components/FoldSection";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import {
  AWARD_FACES_BUCKET,
  AWARD_NAME,
  AWARD_PROOFS_BUCKET,
  AWARD_SETTING_FIELDS,
  AWARD_SETTING_GROUPS,
  PROOF_KIND_LABEL,
  PROOF_STATUS_LABEL,
  formatPrizeTiers,
  longDate,
  parseAwardSetting,
  placeWord,
  type AwardPrizeTier,
  weightsWarning,
  type AwardProofKind,
  type AwardProofStatus,
} from "@/lib/award";
import { awardFileUrl } from "@/lib/awardUploads";
import TrainerCounter from "@/components/award/TrainerCounter";
import { themeText, themedStyles } from "@/lib/theme";

type Tab = "scores" | "flags" | "proofs" | "winners" | "settings";
const TABS: ScreenTab<Tab>[] = [
  { key: "scores", label: "Scores", icon: "podium" },
  { key: "flags", label: "Flags", icon: "flag" },
  { key: "proofs", label: "Proofs", icon: "videocam" },
  { key: "winners", label: "Winners", icon: "trophy" },
  { key: "settings", label: "Settings", icon: "settings" },
];

interface ScoreRow {
  trainer_id: string;
  trainer_name: string;
  score_date: string;
  kind: string;
  total: number;
  signups: number;
  signup_score: number;
  retention: number;
  progress: number;
  verified_clients: number;
  eligible: boolean;
  in_cooldown: boolean;
  rank: number;
  flagged: boolean;
}
interface FlagList {
  clients: { id: string; name: string; trainer: string; reason: string; flagged_at: string; face_photo_path: string | null }[];
  trainers: { id: string; name: string; reason: string; flagged_at: string }[];
}
interface ProofRow {
  id: string;
  client: string;
  trainer: string;
  kind: AwardProofKind;
  detail: string;
  status: AwardProofStatus;
  flagged_on: string;
  due_on: string;
  video_path: string | null;
  face_photo_path: string | null;
}
interface PeriodRow {
  id: string;
  starts_on: string;
  ends_on: string;
  prize_text: string | null;
  winner: string | null;
  winner_score: number | null;
  closed_at: string | null;
  revealed_at: string | null;
  winners: { place: number; name: string; score: number | null; prize: number | null; prize_paid: string | null }[];
}

// The owner's Trainer of the Half-Year page (0194-0196): the switch and
// every setting, the full leaderboard, flagged clients and trainers, the
// proof-video queue and winner history with the live reveal. Works while
// the award is off, so it can be set up and tested first.
export default function AwardAdminScreen() {
  const [tab, setTab] = useState<Tab>("scores");
  return (
    <View style={styles.container}>
      <ScreenTabBar tabs={TABS} current={tab} onChange={setTab} position="top" />
      {tab === "scores" && <Scores />}
      {tab === "flags" && <Flags />}
      {tab === "proofs" && <Proofs />}
      {tab === "winners" && <Winners />}
      {tab === "settings" && <Settings />}
    </View>
  );
}

function useLoad<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try {
      setData(await fn());
    } catch (e) {
      Alert.alert("Couldn't load", e instanceof Error ? e.message : "Check your internet and try again.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const refresh = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
      tintColor={themeText(BRAND_GOLD)}
    />
  );
  return { data, load, refresh };
}

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  // Loosely typed so one helper serves every owner call (all listed in types/database.ts).
  const { data, error } = await (supabase.rpc as unknown as (n: string, a?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>)(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

function Scores() {
  const navigation = useNavigation<NativeStackNavigationProp<TrainerStackParamList>>();
  const { data, load, refresh } = useLoad(() => rpc<ScoreRow[]>("award_leaderboard", { p_period: null }));
  const [running, setRunning] = useState(false);
  const runNow = async () => {
    setRunning(true);
    try {
      const msg = await rpc<string>("award_run_now");
      Alert.alert(AWARD_NAME, msg);
      await load();
    } catch (e) {
      Alert.alert("Couldn't work out the scores", e instanceof Error ? e.message : "");
    } finally {
      setRunning(false);
    }
  };
  if (!data) return <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginTop: 24 }} />;
  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={refresh}>
      <TrainerCounter />
      <Pressable style={styles.previewButton} onPress={() => navigation.navigate("Award", { preview: true })} accessibilityRole="button">
        <Text style={styles.previewText}>Preview what trainers see</Text>
      </Pressable>
      <Text style={styles.hint}>
        {data[0] ? `Scores from ${longDate(data[0].score_date)}. ` : "No scores yet. "}
        Worked out every night. Only you see this; trainers only hear "top 25%" or "not yet".
      </Text>
      {data.map((r) => (
        <View key={r.trainer_id} style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.title}>
              {r.rank}. {r.trainer_name}
            </Text>
            <Text style={styles.score}>{Math.round(r.total)}</Text>
          </View>
          <Text style={styles.text}>
            Sign-ups that stayed {r.signups} ({Math.round(r.signup_score)}) · Retention {Math.round(r.retention)}% · Progress {Math.round(r.progress)}
          </Text>
          <Text style={[styles.hint, { color: r.eligible ? "#22C55E" : "#F59E0B" }]}>
            {r.verified_clients} verified clients ·{" "}
            {r.in_cooldown ? "Sitting out (won recently)" : r.eligible ? "Can win" : "Can't win this period (needs more verified clients, or joined part-way through)"}
            {r.flagged ? " · Under review" : ""}
          </Text>
        </View>
      ))}
      <Pressable style={styles.secondary} onPress={runNow} disabled={running}>
        {running ? <ActivityIndicator color={themeText(BRAND_GOLD)} /> : <Text style={styles.secondaryText}>Work out the scores now</Text>}
      </Pressable>
    </ScrollView>
  );
}

function FacePhoto({ path, size = 64 }: { path: string | null; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    awardFileUrl(AWARD_FACES_BUCKET, path).then(setUrl);
  }, [path]);
  if (!url) return <View style={[styles.face, { width: size, height: size }]} />;
  return <Image source={{ uri: url }} style={[styles.face, { width: size, height: size }]} />;
}

function Flags() {
  const { data, load, refresh } = useLoad(() => rpc<FlagList>("award_flag_list"));
  const review = (id: string, approve: boolean) =>
    rpc("award_review_client", { p_client: id, p_approve: approve })
      .then(load)
      .catch((e) => Alert.alert("Couldn't save", e.message));
  const clear = (id: string) =>
    rpc("award_clear_trainer", { p_trainer: id })
      .then(load)
      .catch((e) => Alert.alert("Couldn't save", e.message));
  if (!data) return <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginTop: 24 }} />;
  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={refresh}>
      <Text style={styles.heading}>Clients ({data.clients.length})</Text>
      {data.clients.length === 0 && <Text style={styles.hint}>No suspicious clients. Flagged clients don't count until you approve them.</Text>}
      {data.clients.map((c) => (
        <View key={c.id} style={styles.card}>
          <View style={styles.rowGap}>
            <FacePhoto path={c.face_photo_path} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{c.name}</Text>
              <Text style={styles.hint}>Trainer: {c.trainer}</Text>
              <Text style={styles.text}>This account {c.reason}.</Text>
            </View>
          </View>
          <View style={styles.buttons}>
            <Pressable style={styles.approve} onPress={() => review(c.id, true)}>
              <Text style={styles.approveText}>Real, count them</Text>
            </Pressable>
            <Pressable style={styles.reject} onPress={() => review(c.id, false)}>
              <Text style={styles.rejectText}>Fake, don't count</Text>
            </Pressable>
          </View>
        </View>
      ))}
      <Text style={styles.heading}>Trainers to review ({data.trainers.length})</Text>
      {data.trainers.length === 0 && <Text style={styles.hint}>None. A trainer is listed here when their clients keep failing proof videos.</Text>}
      {data.trainers.map((t) => (
        <View key={t.id} style={styles.card}>
          <Text style={styles.title}>{t.name}</Text>
          <Text style={styles.text}>{t.reason}. Check their client list on the Trainers tab.</Text>
          <Pressable style={[styles.approve, { marginTop: 10 }]} onPress={() => clear(t.id)}>
            <Text style={styles.approveText}>Checked, all fine</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

function Proofs() {
  const { data, load, refresh } = useLoad(() => rpc<ProofRow[]>("award_proof_queue"));
  const watch = async (path: string | null) => {
    const url = await awardFileUrl(AWARD_PROOFS_BUCKET, path);
    if (url) Linking.openURL(url);
    else Alert.alert("Couldn't open the video");
  };
  const review = (id: string, approve: boolean) =>
    rpc("award_review_proof", { p_proof: id, p_approve: approve })
      .then(load)
      .catch((e) => Alert.alert("Couldn't save", e.message));
  if (!data) return <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginTop: 24 }} />;
  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={refresh}>
      <Text style={styles.hint}>
        Compare the face in the video with the profile photo by eye, and check the lift or weigh-in. Approved: the progress counts. Turned down,
        or no video in time: that entry is left out.
      </Text>
      {data.length === 0 && <Text style={styles.text}>Nothing flagged in the last 60 days.</Text>}
      {data.map((p) => (
        <View key={p.id} style={styles.card}>
          <View style={styles.rowGap}>
            <FacePhoto path={p.face_photo_path} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{p.client}</Text>
              <Text style={styles.hint}>
                Trainer: {p.trainer} · {PROOF_KIND_LABEL[p.kind]}
              </Text>
              <Text style={styles.text}>{p.detail}</Text>
              <Text style={styles.hint}>
                {PROOF_STATUS_LABEL[p.status]}
                {p.status === "requested" ? ` · due ${longDate(p.due_on)}` : ""}
              </Text>
            </View>
          </View>
          {p.video_path && (
            <Pressable style={[styles.secondary, { marginTop: 10 }]} onPress={() => watch(p.video_path)}>
              <Text style={styles.secondaryText}>Watch the video</Text>
            </Pressable>
          )}
          {(p.status === "uploaded" || p.status === "expired" || p.status === "requested") && (
            <View style={styles.buttons}>
              <Pressable style={styles.approve} onPress={() => review(p.id, true)}>
                <Text style={styles.approveText}>Approve</Text>
              </Pressable>
              <Pressable style={styles.reject} onPress={() => review(p.id, false)}>
                <Text style={styles.rejectText}>Turn down</Text>
              </Pressable>
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

function Winners() {
  const { data, load, refresh } = useLoad(() => rpc<PeriodRow[]>("award_periods_list"));
  const reveal = (p: PeriodRow) =>
    Alert.alert("Reveal the winners?", `Every trainer gets a notification and sees ${p.winners.map((w) => `${placeWord(w.place)} ${w.name}`).join(", ")} in their app. Do this when the live stream starts.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reveal now",
        onPress: () =>
          rpc("award_reveal", { p_period: p.id })
            .then(load)
            .catch((e) => Alert.alert("Couldn't reveal", e.message)),
      },
    ]);
  if (!data) return <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginTop: 24 }} />;
  return (
    <ScrollView contentContainerStyle={styles.page} refreshControl={refresh}>
      {data.length === 0 && <Text style={styles.hint}>No periods yet. While switched on, the first one starts by itself once enough trainers are on the app (or on the start date you set under Settings).</Text>}
      {data.map((p) => (
        <View key={p.id} style={styles.card}>
          <Text style={styles.title}>
            {longDate(p.starts_on)} to {longDate(p.ends_on)}
          </Text>
          <Text style={styles.text}>
            {!p.closed_at
              ? "Running now."
              : p.winners.length
                ? p.winners.map((w) => `${placeWord(w.place)}: ${w.name} (${Math.round(w.score ?? 0)})${w.prize_paid ? `, pay ${w.prize_paid}` : ""}`).join("\n")
                : "No trainer qualified."}
          </Text>
          {p.prize_text ? <Text style={styles.hint}>Prize: {p.prize_text}</Text> : null}
          {p.closed_at && p.winner && !p.revealed_at && (
            <Pressable style={[styles.primary, { marginTop: 10 }]} onPress={() => reveal(p)}>
              <Text style={styles.primaryText}>Reveal the winners live</Text>
            </Pressable>
          )}
          {p.revealed_at ? <Text style={styles.hint}>Revealed {longDate(p.revealed_at.slice(0, 10))}</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}

function Settings() {
  const [values, setValues] = useState<Record<string, unknown> | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("award_settings").select("*").eq("id", 1).single();
    if (error) return Alert.alert("Couldn't load settings", error.message);
    setValues(data);
    const d: Record<string, string> = {};
    for (const f of AWARD_SETTING_FIELDS) {
      if (f.kind === "switch") continue;
      const v = data[f.key];
      d[f.key] =
        f.kind === "tiers" ? formatPrizeTiers(v as AwardPrizeTier[]) : f.kind === "goals" ? ((v as number[]) ?? []).join(", ") : v == null ? "" : String(v);
    }
    setDraft(d);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const update = async (patch: Record<string, unknown>) => {
    setSaving(true);
    const { error } = await supabase.from("award_settings").update(patch).eq("id", 1);
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't save", error.message);
      return false;
    }
    await load();
    return true;
  };

  const save = async () => {
    const patch: Record<string, unknown> = {};
    for (const f of AWARD_SETTING_FIELDS) {
      if (f.kind === "switch") continue;
      const parsed = parseAwardSetting(f, draft[f.key] ?? "");
      if (!parsed.ok) return Alert.alert("Check this", parsed.error);
      patch[f.key] = parsed.value;
    }
    const warn = weightsWarning(patch);
    if (await update(patch)) Alert.alert("Saved ✅", warn ? `${warn} They still work, scaled to 100.` : "Settings saved.");
  };

  const toggle = (on: boolean) => {
    if (!on) {
      update({ enabled: false });
      return;
    }
    Alert.alert(
      `Switch on ${AWARD_NAME}?`,
      `${values?.first_period_start ? `It starts on ${longDate(String(values.first_period_start))}.` : `It starts by itself once ${values?.start_at_trainers} trainers are on the app.`} Trainers see the award and the rules, new clients are asked for a face photo and goal at sign-up, existing clients are asked on their Today tab, and the nightly scoring and red flags start. Have the rules and the privacy wording checked by an attorney first.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Switch on", onPress: () => update({ enabled: true }) },
      ]
    );
  };

  if (!values) return <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginTop: 24 }} />;
  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={[styles.card, styles.rowBetween]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{values.enabled ? "Switched on" : "Switched off"}</Text>
          <Text style={styles.hint}>{values.enabled ? "Trainers and clients see the award." : "Nobody but you sees anything."}</Text>
        </View>
        <Switch value={!!values.enabled} onValueChange={toggle} disabled={saving} trackColor={{ true: BRAND_GOLD }} />
      </View>
      {AWARD_SETTING_GROUPS.map((g) => (
        <FoldSection key={g.key} icon="⚙️" title={g.title} open={open === g.key} onToggle={() => setOpen(open === g.key ? null : g.key)}>
          {AWARD_SETTING_FIELDS.filter((f) => f.group === g.key).map((f) =>
            f.kind === "switch" ? (
              <View key={f.key} style={[styles.rowBetween, { marginBottom: 12 }]}>
                <Text style={[styles.text, { flex: 1 }]}>{f.label}</Text>
                <Switch value={!!values[f.key]} onValueChange={(v) => {
                    update({ [f.key]: v });
                  }} trackColor={{ true: BRAND_GOLD }} />
              </View>
            ) : (
              <View key={f.key} style={{ marginBottom: 12 }}>
                <Text style={styles.label}>{f.label}</Text>
                <TextInput
                  style={[styles.input, (f.kind === "longtext" || f.kind === "tiers") && styles.longInput]}
                  value={draft[f.key] ?? ""}
                  onChangeText={(t) => setDraft((d) => ({ ...d, [f.key]: t }))}
                  keyboardType={f.kind === "number" ? "decimal-pad" : "default"}
                  multiline={f.kind === "longtext" || f.kind === "tiers"}
                  placeholder={f.hint}
                  placeholderTextColor="#94A3B8"
                  autoCapitalize={f.kind === "text" || f.kind === "longtext" ? "sentences" : "none"}
                  autoCorrect={f.kind === "text" || f.kind === "longtext"}
                />
                {f.hint && f.kind !== "text" ? <Text style={styles.hint}>{f.hint}</Text> : null}
              </View>
            )
          )}
        </FoldSection>
      ))}
      <Pressable style={styles.primary} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.primaryText}>Save settings</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = themedStyles({
  container: { flex: 1, backgroundColor: "#0F172A" },
  page: { padding: 16, paddingBottom: 40 },
  previewButton: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 10, alignItems: "center", marginBottom: 12 },
  previewText: { color: BRAND_GOLD, fontWeight: "700" },
  card: { backgroundColor: "#1E293B", borderRadius: 10, padding: 14, marginBottom: 12, gap: 4 },
  heading: { color: "#94A3B8", fontWeight: "700", marginTop: 8, marginBottom: 8 },
  title: { color: "#fff", fontWeight: "700", fontSize: 15 },
  text: { color: "#E2E8F0", lineHeight: 20 },
  hint: { color: "#94A3B8", fontSize: 13, lineHeight: 18, marginBottom: 6 },
  label: { color: "#CBD5E1", fontWeight: "600", marginBottom: 6 },
  score: { color: BRAND_GOLD, fontWeight: "800", fontSize: 22 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  rowGap: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  face: { borderRadius: 8, backgroundColor: "#334155" },
  buttons: { flexDirection: "row", gap: 10, marginTop: 10 },
  approve: { flex: 1, backgroundColor: "#14532D", borderRadius: 8, padding: 10, alignItems: "center" },
  approveText: { color: "#BBF7D0", fontWeight: "700" },
  reject: { flex: 1, backgroundColor: "#450A0A", borderRadius: 8, padding: 10, alignItems: "center" },
  rejectText: { color: "#FECACA", fontWeight: "700" },
  primary: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 8 },
  primaryText: { color: "#0F172A", fontWeight: "700", fontSize: 16 },
  secondary: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 10, padding: 12, alignItems: "center", marginTop: 8 },
  secondaryText: { color: BRAND_GOLD, fontWeight: "700" },
  input: { backgroundColor: "#0F172A", color: "#fff", borderRadius: 8, padding: 12 },
  longInput: { minHeight: 130, textAlignVertical: "top" },
});
