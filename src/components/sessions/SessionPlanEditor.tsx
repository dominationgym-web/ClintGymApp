import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Switch, Text, View } from "react-native";
import TextInput from "@/components/TextInput";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { money } from "@/lib/billing";
import {
  BILLINGS,
  POLICIES,
  SESSION_LENGTHS,
  WEEK_ORDER,
  agreementCurrent,
  cleanTime,
  LONG_DAYS,
  regularLabel,
} from "@/lib/liveSessions";
import type { RegularTime, SessionAgreement, SessionPlan, SessionSettings } from "@/types/database";
import { themeBg, themeText, themedStyles } from "@/lib/theme";

// One client's session deal (0168): their fee (starts at the trainer's
// normal fee), sessions a week, cancellation rule, billing and regular times.
// Saving fills the calendar with the regular times to the end of next month.
export default function SessionPlanEditor({
  clientId,
  clientName,
  plan,
  settings,
  signed,
  onSaved,
}: {
  clientId: string;
  clientName: string;
  plan: SessionPlan | null;
  settings: SessionSettings | null;
  signed: SessionAgreement | null;
  onSaved: () => void;
}) {
  const [fee, setFee] = useState("");
  const [perWeek, setPerWeek] = useState(3);
  const [policy, setPolicy] = useState<SessionPlan["policy"]>("24h");
  const [billing, setBilling] = useState<SessionPlan["billing"]>("arrears");
  const [minutes, setMinutes] = useState(60);
  // Days ticked, and the time typed for each (GRIZZ, 2026-10-31: "days to be
  // selected by ticking. And time slots to be typed in by the trainer").
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const [typed, setTyped] = useState<Record<number, string>>({});
  const [active, setActive] = useState(true);
  // Shared sessions: how many people, and whether one total fee is split.
  const [groupSize, setGroupSize] = useState(1);
  const [split, setSplit] = useState(true);
  const [total, setTotal] = useState("");
  const [solo, setSolo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFee(String(plan?.fee ?? settings?.fee ?? ""));
    setPerWeek(plan?.per_week ?? 3);
    setPolicy(plan?.policy ?? settings?.policy ?? "24h");
    setBilling(plan?.billing ?? settings?.billing ?? "arrears");
    setMinutes(plan?.minutes ?? settings?.minutes ?? 60);
    setTicked(new Set((plan?.regular ?? []).map((r) => r.weekday)));
    setTyped(Object.fromEntries((plan?.regular ?? []).map((r) => [r.weekday, r.time])));
    setActive(plan?.active ?? true);
    setGroupSize(plan?.group_size ?? 1);
    setSplit(plan ? plan.group_total != null : true);
    setTotal(plan?.group_total != null ? String(plan.group_total) : "");
    setSolo(plan?.solo_fee != null ? String(plan.solo_fee) : "");
  }, [plan, settings, clientId]);

  const first = clientName.split(" ")[0];
  const regular: RegularTime[] = WEEK_ORDER.filter((d) => ticked.has(d) && cleanTime(typed[d])).map((d) => ({ weekday: d, time: cleanTime(typed[d]) as string }));
  const missing = WEEK_ORDER.filter((d) => ticked.has(d) && !cleanTime(typed[d]));
  const tick = (d: number) => {
    const next = new Set(ticked);
    if (next.has(d)) next.delete(d);
    else {
      next.add(d);
      // Same time as the last day ticked, to save typing.
      const last = WEEK_ORDER.find((x) => ticked.has(x) && cleanTime(typed[x]));
      if (!typed[d] && last !== undefined) setTyped({ ...typed, [d]: cleanTime(typed[last]) as string });
    }
    setTicked(next);
  };

  const num = (v: string) => Number(v.replace(",", ".").replace(/[^\d.]/g, ""));
  const splitting = groupSize > 1 && split;
  const share = splitting && total.trim() ? Math.round((num(total) / groupSize) * 100) / 100 : null;

  const save = async () => {
    const amount = splitting ? share : num(fee);
    if (amount === null || (!splitting && !fee.trim()) || Number.isNaN(amount)) {
      Alert.alert("Add the fee", splitting ? "Type the total fee for the shared session, like 1200." : `What ${first} pays per session, like 350.`);
      return;
    }
    if (missing.length) {
      Alert.alert("Add the time", `Type the session time for ${missing.map((d) => LONG_DAYS[d]).join(" and ")}, like 05:50.`);
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("save_session_plan", {
      p_client: clientId,
      p_fee: amount,
      p_per_week: perWeek,
      p_billing: billing,
      p_policy: policy,
      p_minutes: minutes,
      p_regular: regular,
      p_active: active,
      p_group_size: groupSize,
      p_group_total: splitting ? num(total) : null,
      p_solo_fee: groupSize > 1 && solo.trim() ? num(solo) : null,
    });
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't save", error.message);
      return;
    }
    onSaved();
    Alert.alert(
      "Saved ✅",
      regular.length && active
        ? `${regularLabel(regular)} is filled in to the end of next month. ${plan ? "" : `${first} has been asked to sign the agreement.`}`
        : "Add one-off sessions by tapping a day on the Calendar tab."
    );
  };

  const changedTerms =
    !!plan &&
    !agreementCurrent({ fee: splitting ? share ?? 0 : num(fee), per_week: perWeek, group_size: groupSize, policy, billing, regular }, plan);

  return (
    <View>
      {plan ? (
        <Text style={[styles.status, { color: themeText(signed ? "#22C55E" : "#F59E0B") }]}>
          {signed
            ? `✍️ Agreement signed by ${signed.signed_name} on ${new Date(signed.signed_at).toLocaleDateString()}`
            : `✍️ ${first} hasn't signed the agreement for these terms yet`}
        </Text>
      ) : null}

      <Text style={styles.label}>Who trains in the session?</Text>
      <View style={styles.chips}>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <Chip key={n} label={n === 1 ? `Just ${first}` : `${n} people`} on={groupSize === n} onPress={() => setGroupSize(n)} />
        ))}
      </View>
      {groupSize > 1 ? (
        <>
          <View style={styles.chips}>
            <Chip label="Split one fee" on={split} onPress={() => setSplit(true)} />
            <Chip label="Each pays their own fee" on={!split} onPress={() => setSplit(false)} />
          </View>
          <Text style={styles.meta}>Set up each person in the group the same way, at the same days and times. After the session you tick who came.</Text>
        </>
      ) : null}

      {splitting ? (
        <>
          <Text style={styles.label}>Total fee for the session {settings?.currency === "USD" ? "($)" : "(R)"}</Text>
          <TextInput style={styles.input} value={total} onChangeText={setTotal} keyboardType="decimal-pad" placeholder="1200" placeholderTextColor="#64748B" />
          {share !== null && !Number.isNaN(share) ? (
            <Text style={styles.share}>
              {first} pays {money(share, settings?.currency)} a session (split {groupSize} ways)
            </Text>
          ) : null}
        </>
      ) : (
        <>
          <Text style={styles.label}>
            {groupSize > 1 ? `${first}'s fee per session` : "Fee per session"} {settings?.currency === "USD" ? "($)" : "(R)"}
          </Text>
          <TextInput style={styles.input} value={fee} onChangeText={setFee} keyboardType="decimal-pad" placeholder="350" placeholderTextColor="#64748B" />
          {settings?.fee != null ? <Text style={styles.meta}>Your normal fee is {money(Number(settings.fee), settings.currency)}.</Text> : null}
        </>
      )}

      {groupSize > 1 ? (
        <>
          <Text style={styles.label}>Special rate if {first} trains alone (optional)</Text>
          <TextInput style={styles.input} value={solo} onChangeText={setSolo} keyboardType="decimal-pad" placeholder="700" placeholderTextColor="#64748B" />
          <Text style={styles.meta}>
            When only {first} comes and you credit the others, {first} pays this instead. If the others forfeit, everyone pays their normal share.
          </Text>
        </>
      ) : null}

      <Text style={styles.label}>Sessions a week</Text>
      <View style={styles.chips}>
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <Chip key={n} label={String(n)} on={perWeek === n} onPress={() => setPerWeek(n)} />
        ))}
      </View>

      <Text style={styles.label}>Cancellation rule</Text>
      <View style={styles.chips}>
        {POLICIES.map((p) => (
          <Chip key={p.key} label={p.label} on={policy === p.key} onPress={() => setPolicy(p.key)} />
        ))}
      </View>

      <Text style={styles.label}>Billing</Text>
      <View style={styles.chips}>
        {BILLINGS.map((b) => (
          <Chip key={b.key} label={b.label} on={billing === b.key} onPress={() => setBilling(b.key)} />
        ))}
      </View>
      <Text style={styles.meta}>{BILLINGS.find((b) => b.key === billing)?.detail}</Text>

      <Text style={styles.label}>Session length</Text>
      <View style={styles.chips}>
        {[...new Set([...SESSION_LENGTHS, settings?.minutes ?? 60, minutes])].sort((a, b) => a - b).map((m) => (
          <Chip key={m} label={`${m} min`} on={minutes === m} onPress={() => setMinutes(m)} />
        ))}
      </View>

      <Text style={styles.label}>Their days and times</Text>
      <Text style={styles.meta}>Tick their days and type the time for each. Leave all empty if their times change every week.</Text>
      {WEEK_ORDER.map((d) => {
        const on = ticked.has(d);
        return (
          <View key={d} style={styles.dayRow}>
            <Pressable style={styles.tickRow} onPress={() => tick(d)} hitSlop={6}>
              <View style={[styles.tick, on && styles.tickOn]}>{on ? <Text style={styles.tickMark}>✓</Text> : null}</View>
              <Text style={[styles.dayName, on && styles.dayNameOn]}>{LONG_DAYS[d]}</Text>
            </Pressable>
            {on ? (
              <TextInput
                style={[styles.timeInput, !cleanTime(typed[d]) && styles.timeInputBad]}
                value={typed[d] ?? ""}
                onChangeText={(v) => setTyped({ ...typed, [d]: v })}
                placeholder="05:50"
                placeholderTextColor="#64748B"
                maxLength={5}
                keyboardType="numbers-and-punctuation"
              />
            ) : null}
          </View>
        );
      })}
      {regular.length ? (
        <Text style={styles.meta}>
          {regularLabel(regular, true)}
          {regular.length !== perWeek ? ` · that's ${regular.length} a week, the plan says ${perWeek}.` : ""}
        </Text>
      ) : null}

      {plan ? (
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchText}>Sessions running</Text>
            <Text style={styles.meta}>Switch off to stop. Future regular sessions come off the calendar.</Text>
          </View>
          <Switch value={active} onValueChange={setActive} trackColor={{ true: themeBg(BRAND_GOLD), false: themeBg("#334155") }} thumbColor="#fff" />
        </View>
      ) : null}

      {changedTerms ? <Text style={styles.warn}>Changing the fee, sessions a week, rule, billing or days and times asks {first} to sign again.</Text> : null}

      <Pressable style={styles.button} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.buttonText}>{plan ? "Save" : `Start sessions with ${first}`}</Text>}
      </Pressable>
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = themedStyles({
  status: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  share: { color: "#22C55E", fontSize: 14, fontWeight: "700", marginTop: 6 },
  label: { color: BRAND_GOLD, fontSize: 13, fontWeight: "700", marginTop: 16, marginBottom: 4 },
  meta: { color: "#94A3B8", fontSize: 12, marginTop: 4, lineHeight: 17 },
  warn: { color: "#FDE68A", fontSize: 13, marginTop: 14 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 10, padding: 12, fontSize: 15, borderWidth: 1, borderColor: "#334155" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: { backgroundColor: "#1E293B", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "#334155" },
  chipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "600", fontSize: 14 },
  chipTextOn: { color: "#0F172A" },
  dayRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 46, borderBottomWidth: 1, borderBottomColor: "#1E293B" },
  tickRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, paddingVertical: 8 },
  tick: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: BRAND_GOLD, alignItems: "center", justifyContent: "center" },
  tickOn: { backgroundColor: BRAND_GOLD },
  tickMark: { color: "#0F172A", fontWeight: "900" },
  dayName: { color: "#94A3B8", fontSize: 15 },
  dayNameOn: { color: "#fff", fontWeight: "700" },
  timeInput: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, width: 90, textAlign: "center", borderWidth: 1, borderColor: "#334155" },
  timeInputBad: { borderColor: "#F59E0B" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 20 },
  switchText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 20 },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
});
