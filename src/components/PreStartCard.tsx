import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { BRAND_GOLD } from "@/lib/brand";
import {
  BLANK_PRE_START,
  compareTest,
  isOlderAdultProgram,
  preStartOutcome,
  preStartRisks,
  reassessDue,
  type PreStartAnswers,
} from "@/lib/preStart";
import PreStartFormModal from "@/components/PreStartFormModal";
import PreStartRiskList from "@/components/PreStartRiskList";
import type { ClientPrestartForm } from "@/types/database";

const COLOURS = { green: "#22C55E", amber: "#F59E0B", red: "#EF4444" };

const answersOf = (f: ClientPrestartForm): PreStartAnswers => ({ ...BLANK_PRE_START, ...(f.answers as Partial<PreStartAnswers>) });

const shortDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${y}`;
};

// Pre-start health and safety form (0131), on the client's Training tab for
// anyone 50 or over, on a Longevity program, or with a form already. Shows
// the app's risk check from the latest form, the re-test date (every 8
// weeks) and the tests against the first one. Picking a Longevity program
// for a client without a form puts up a sign asking for it first.
export default function PreStartCard({
  clientId,
  clientName,
  age,
  refreshKey,
  onShow,
}: {
  clientId: string;
  clientName: string;
  age: number | null;
  /** Whether it has something to show, for the Things to check line. */
  onShow?: (shown: boolean) => void;
  /** Bumped after any program pick. */
  refreshKey: number;
}) {
  const [forms, setForms] = useState<ClientPrestartForm[]>([]);
  const [onProgram, setOnProgram] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [filling, setFilling] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [sign, setSign] = useState(false);
  const seenKey = useRef(refreshKey);

  const load = useCallback(async () => {
    const [{ data: saved }, { data: main }, { data: days }] = await Promise.all([
      supabase.from("client_prestart_forms").select("*").eq("client_id", clientId).order("filled_on").order("created_at"),
      supabase.from("client_programs").select("program_id").eq("client_id", clientId).maybeSingle(),
      supabase.from("client_calendar_workouts").select("program_id").eq("client_id", clientId).gte("workout_date", todayIso()),
    ]);
    const ids = [...new Set([main?.program_id, ...(days ?? []).map((d) => d.program_id)].filter((id): id is string => !!id))];
    const { data: programs } = ids.length ? await supabase.from("programs").select("name").in("id", ids) : { data: [] };
    const older = (programs ?? []).some((p) => isOlderAdultProgram(p.name));
    setForms(saved ?? []);
    setOnProgram(older);
    setLoaded(true);
    return { older, count: (saved ?? []).length };
  }, [clientId]);

  useEffect(() => {
    load().then(({ older, count }) => {
      // A Longevity program was just picked for a client without a form.
      if (refreshKey !== seenKey.current && older && count === 0) setSign(true);
      seenKey.current = refreshKey;
    });
  }, [load, refreshKey]);

  const shown = loaded && (forms.length > 0 || onProgram || (age != null && age >= 50));
  useEffect(() => onShow?.(shown), [shown, onShow]);
  if (!shown) return null;

  const latest = forms[forms.length - 1] ?? null;
  const first = forms[0] ?? null;
  const modal = (
    <PreStartFormModal
      visible={filling}
      clientId={clientId}
      clientName={clientName}
      start={latest ? answersOf(latest) : null}
      onClose={() => setFilling(false)}
      onSaved={() => {
        setFilling(false);
        load();
      }}
    />
  );
  const signModal = (
    <Modal visible={sign} transparent animationType="fade" onRequestClose={() => setSign(false)}>
      <View style={styles.backdrop}>
        <View style={styles.signBox}>
          <Text style={styles.signIcon}>🌳</Text>
          <Text style={styles.signTitle}>Pre-start form first</Text>
          <Text style={styles.signText}>
            Fill in the health and safety form with {clientName} before they start. The app checks it for risks like falls, blood pressure
            and medication.
          </Text>
          <Pressable
            style={styles.button}
            onPress={() => {
              setSign(false);
              setFilling(true);
            }}
          >
            <Text style={styles.buttonText}>Fill it in now</Text>
          </Pressable>
          <Pressable style={styles.later} onPress={() => setSign(false)}>
            <Text style={styles.laterText}>Later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );

  if (!latest)
    return (
      <View style={[styles.card, { borderColor: BRAND_GOLD }]}>
        {modal}
        {signModal}
        <Text style={styles.title}>🌳 Pre-start health & safety form</Text>
        <Text style={styles.text}>
          {onProgram ? `${clientName} is on a Longevity program but has no form yet.` : `${clientName} is ${age}.`} Fill it in with them before
          they start: health, medication, falls, pain, blood pressure and 5 quick movement tests. The app checks it for risks.
        </Text>
        <Pressable style={styles.button} onPress={() => setFilling(true)}>
          <Text style={styles.buttonText}>Fill in the form</Text>
        </Pressable>
      </View>
    );

  const answers = answersOf(latest);
  const risks = preStartRisks(answers);
  const outcome = preStartOutcome(answers, risks);
  const due = reassessDue(latest.filled_on);
  const overdue = due <= todayIso();
  const base = first && first.id !== latest.id ? answersOf(first) : undefined;
  const tests = [
    ["Sit-to-stand x5", compareTest(answers.sitToStand, base?.sitToStand, "s")],
    ["Walk", compareTest(answers.walkMinutes, base?.walkMinutes, "min")],
    ["Tandem stance", compareTest(answers.tandemSeconds, base?.tandemSeconds, "s")],
    ["Single leg L / R", answers.singleLegLeft || answers.singleLegRight ? `${answers.singleLegLeft || "-"} / ${answers.singleLegRight || "-"} s` : ""],
  ].filter(([, v]) => v);

  return (
    <View style={[styles.card, { borderColor: COLOURS[outcome.level] }]}>
      {modal}
      {signModal}
      <Text style={styles.title}>🌳 Pre-start form · {shortDay(latest.filled_on)}</Text>
      <PreStartRiskList outcome={outcome} risks={risks} limit={showAll ? undefined : 3} />
      {risks.length > 3 && (
        <Pressable onPress={() => setShowAll((v) => !v)} hitSlop={6}>
          <Text style={styles.more}>{showAll ? "Show fewer ▴" : `Show all ${risks.length} ▾`}</Text>
        </Pressable>
      )}
      {tests.length > 0 && (
        <View style={{ marginTop: 10 }}>
          {tests.map(([label, value]) => (
            <Text key={label} style={styles.test}>
              {label}: <Text style={{ color: "#fff", fontWeight: "700" }}>{value}</Text>
            </Text>
          ))}
        </View>
      )}
      <Text style={[styles.due, overdue && { color: COLOURS.amber }]}>
        {overdue ? `Re-test was due ${shortDay(due)}` : `Re-test due ${shortDay(due)}`} (every 8 weeks)
      </Text>
      <Pressable style={styles.button} onPress={() => setFilling(true)}>
        <Text style={styles.buttonText}>Re-test or update</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 1.5 },
  title: { color: "#fff", fontSize: 15, fontWeight: "800" },
  text: { color: "#CBD5E1", fontSize: 13, marginTop: 6 },
  test: { color: "#94A3B8", fontSize: 13, marginTop: 2 },
  due: { color: "#94A3B8", fontSize: 12, marginTop: 10 },
  more: { color: "#94A3B8", fontWeight: "700", marginTop: 8 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 12 },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
  backdrop: { flex: 1, backgroundColor: "rgba(2,6,23,0.85)", justifyContent: "center", padding: 20 },
  signBox: { backgroundColor: "#0F172A", borderRadius: 18, padding: 20, borderWidth: 2, borderColor: BRAND_GOLD },
  signIcon: { fontSize: 40, textAlign: "center" },
  signTitle: { color: BRAND_GOLD, fontSize: 22, fontWeight: "900", textAlign: "center", marginTop: 6 },
  signText: { color: "#CBD5E1", fontSize: 14, textAlign: "center", marginTop: 8 },
  later: { alignItems: "center", paddingVertical: 12 },
  laterText: { color: "#94A3B8", fontWeight: "700" },
});
