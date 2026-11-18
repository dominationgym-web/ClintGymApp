import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import KeyboardSafe from "@/components/KeyboardSafe";
import TextInput from "@/components/TextInput";
import SafeBottom from "@/components/SafeBottom";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { sessionMoney } from "@/lib/liveSessions";
import { diaryKey } from "@/lib/calendarRegular";
import { firstName, pairPayer, pairSides, pairTitle, personKey, suggestPairs, type PairPerson } from "@/lib/sessionPairs";
import type { BillingCurrency, LiveSession, SessionPair } from "@/types/database";
import { themeText, themedStyles } from "@/lib/theme";
import { useStepBack } from "@/hooks/useStepBack";

// Pairs, set up once (GRIZZ, 2026-11-18: "Let's do 1"): both people, what
// they pay together and what one pays alone, and one invoice or two. Both
// people get the same prices, so a partner can't be priced differently.
export default function PairsSection({
  pairs,
  sessions,
  clients,
  currency,
  onChanged,
}: {
  pairs: SessionPair[];
  sessions: LiveSession[];
  clients: { id: string; name: string }[];
  currency: BillingCurrency;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<{ pair: SessionPair | null; a?: PairPerson; b?: PairPerson } | null>(null);
  const nameOf = useMemo(() => {
    const m = new Map(clients.map((c) => [c.id, c.name]));
    return (id: string) => m.get(id);
  }, [clients]);
  const active = pairs.filter((p) => !p.ended_at);
  const suggested = useMemo(() => suggestPairs(sessions, nameOf, active), [sessions, nameOf, active]);
  // Everyone who could be in a pair: app clients and calendar names.
  const people = useMemo(() => {
    const byKey = new Map<string, PairPerson>();
    for (const c of clients) byKey.set(c.id, { clientId: c.id, name: c.name });
    for (const s of sessions) {
      if (s.client_id || !s.guest_name || s.status === "removed") continue;
      const k = diaryKey(s.guest_name);
      if (!k || k.includes("???") || !/\p{L}/u.test(k)) continue;
      const p = { clientId: null, name: s.guest_name.trim() };
      if (!byKey.has(personKey(p))) byKey.set(personKey(p), p);
    }
    return [...byKey.values()].sort((x, y) => x.name.localeCompare(y.name));
  }, [clients, sessions]);

  return (
    <View style={{ marginTop: 18 }}>
      <Text style={styles.title}>👥 Pairs</Text>
      <Text style={styles.meta}>People who train together. Set them up once: their prices match, and they get one invoice unless you split it.</Text>
      {active.map((p) => (
        <Pressable key={p.id} style={styles.row} onPress={() => setEditing({ pair: p })}>
          <Text style={styles.name}>{pairTitle(p)}</Text>
          <Text style={styles.body}>
            {sessionMoney(Number(p.together), currency)} together · {sessionMoney(Number(p.alone), currency)} when one trains alone
          </Text>
          <Text style={styles.meta}>{p.one_invoice ? `One invoice, ${firstName(pairPayer(p).name)} pays` : "Separate invoices"}</Text>
        </Pressable>
      ))}
      {suggested.slice(0, 3).map((s) => (
        <Pressable key={`${personKey(s.a)}|${personKey(s.b)}`} style={[styles.row, styles.suggest]} onPress={() => setEditing({ pair: null, a: s.a, b: s.b })}>
          <Text style={styles.name}>
            {firstName(s.a.name)} & {firstName(s.b.name)}?
          </Text>
          <Text style={styles.meta}>They trained together {s.n} times. Tap to set them up as a pair.</Text>
        </Pressable>
      ))}
      <Pressable style={styles.outline} onPress={() => setEditing({ pair: null })}>
        <Text style={styles.outlineText}>＋ Set up a pair</Text>
      </Pressable>
      <PairModal
        visible={!!editing}
        pair={editing?.pair ?? null}
        startA={editing?.a}
        startB={editing?.b}
        people={people}
        currency={currency}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          onChanged();
        }}
      />
    </View>
  );
}

function PairModal({
  visible,
  pair,
  startA,
  startB,
  people,
  currency,
  onClose,
  onSaved,
}: {
  visible: boolean;
  pair: SessionPair | null;
  startA?: PairPerson;
  startB?: PairPerson;
  people: PairPerson[];
  currency: BillingCurrency;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [a, setA] = useState<PairPerson | null>(null);
  const [b, setB] = useState<PairPerson | null>(null);
  const [picking, setPicking] = useState<"a" | "b" | null>(null);
  const [find, setFind] = useState("");
  const [together, setTogether] = useState("");
  const [alone, setAlone] = useState("");
  // null = separate invoices; 'a' / 'b' = one invoice, that one pays.
  const [payer, setPayer] = useState<"a" | "b" | null>("a");
  const [busy, setBusy] = useState(false);
  useStepBack(visible && picking !== null, () => setPicking(null));

  useEffect(() => {
    if (!visible) return;
    const sides = pair ? pairSides(pair) : null;
    setA(sides?.[0] ?? startA ?? null);
    setB(sides?.[1] ?? startB ?? null);
    setTogether(pair ? String(Number(pair.together)) : "");
    setAlone(pair ? String(Number(pair.alone)) : "");
    setPayer(pair ? (pair.one_invoice ? pair.payer : null) : "a");
    setPicking(null);
    setFind("");
  }, [visible, pair, startA, startB]);

  const num = (v: string) => Number(v.replace(",", ".").replace(/[^\d.]/g, ""));
  const t = num(together);
  const al = num(alone);
  const share = together.trim() && t > 0 ? Math.round((t / 2) * 100) / 100 : null;
  const balance = share !== null && alone.trim() ? Math.max(0, t - al) : null;

  const save = async () => {
    if (!a || !b) return Alert.alert("Pick both people", "Tap each name box and pick who trains together.");
    if (personKey(a) === personKey(b)) return Alert.alert("Pick two different people", "");
    if (!share) return Alert.alert("What do they pay together?", "For one session together, like 1000.");
    if (!alone.trim() || !Number.isFinite(al)) return Alert.alert("Price when one trains alone", "Like 750.");
    setBusy(true);
    const { error } = await supabase.rpc("set_session_pair", {
      p_id: pair?.id ?? null,
      p_a_client: a.clientId,
      p_a_name: a.clientId ? null : a.name,
      p_b_client: b.clientId,
      p_b_name: b.clientId ? null : b.name,
      p_together: t,
      p_alone: al,
      p_one_invoice: payer !== null,
      p_payer: payer ?? "a",
    });
    setBusy(false);
    if (error) return Alert.alert("Couldn't save", error.message);
    onSaved();
    Alert.alert(
      "Saved ✅",
      `${firstName(a.name)} and ${firstName(b.name)} pay ${sessionMoney(share, currency)} each together. Training alone is ${sessionMoney(al, currency)}, and the one who missed pays ${sessionMoney(balance ?? 0, currency)}. This month's draft invoices are updated.`
    );
  };

  const end = () =>
    pair &&
    Alert.alert("Not a pair any more?", "They each get their own invoice again. Their prices stay as they are; change them on each person's page.", [
      { text: "Back", style: "cancel" },
      {
        text: "Yes, end it",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          const { error } = await supabase.rpc("end_session_pair", { p_id: pair.id });
          setBusy(false);
          if (error) return Alert.alert("Couldn't save", error.message);
          onSaved();
        },
      },
    ]);

  const q = diaryKey(find) ?? "";
  const matches = people.filter((p) => !q || p.name.toLowerCase().includes(q)).slice(0, 12);
  const pick = (p: PairPerson) => {
    if (picking === "a") setA(p);
    else setB(p);
    setPicking(null);
    setFind("");
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => (picking ? setPicking(null) : onClose())}>
      <KeyboardSafe>
        <View style={styles.backdrop}>
          <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetTitle}>{pair ? `👥 ${pairTitle(pair)}` : "👥 Set up a pair"}</Text>
            {picking ? (
              <>
                <Text style={styles.label}>Who is it?</Text>
                <TextInput style={styles.input} value={find} onChangeText={setFind} placeholder="Type a few letters" placeholderTextColor="#64748B" autoFocus />
                <View style={[styles.chips, { marginTop: 10 }]}>
                  {matches.map((p) => (
                    <Pressable key={personKey(p)} style={styles.chip} onPress={() => pick(p)}>
                      <Text style={styles.chipText}>
                        {p.name}
                        {p.clientId ? "" : " · not in the app"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {!matches.length ? <Text style={styles.meta}>No one by that name. Add them on the Clients tab first.</Text> : null}
                <Pressable style={styles.closeRow} onPress={() => setPicking(null)}>
                  <Text style={styles.closeText}>‹ Back</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.label}>Who trains together?</Text>
                <View style={styles.pickRow}>
                  <Pressable style={styles.pickBox} onPress={() => setPicking("a")}>
                    <Text style={[styles.pickText, !a && styles.pickEmpty]}>{a ? a.name : "Tap to pick"}</Text>
                  </Pressable>
                  <Text style={styles.amp}>&</Text>
                  <Pressable style={styles.pickBox} onPress={() => setPicking("b")}>
                    <Text style={[styles.pickText, !b && styles.pickEmpty]}>{b ? b.name : "Tap to pick"}</Text>
                  </Pressable>
                </View>

                <Text style={styles.label}>What they pay together for one session</Text>
                <TextInput style={styles.input} value={together} onChangeText={setTogether} keyboardType="decimal-pad" placeholder="1000" placeholderTextColor="#64748B" />
                {share !== null ? <Text style={styles.meta}>{sessionMoney(share, currency)} each.</Text> : null}

                <Text style={styles.label}>What one pays training alone</Text>
                <TextInput style={styles.input} value={alone} onChangeText={setAlone} keyboardType="decimal-pad" placeholder="750" placeholderTextColor="#64748B" />
                {balance !== null ? (
                  <Text style={styles.meta}>
                    If one misses (late or in time), they pay the {sessionMoney(balance, currency)} balance. A catch-up trained alone is {sessionMoney(al, currency)}. You cancelling: nobody pays.
                  </Text>
                ) : null}

                <Text style={styles.label}>Invoices</Text>
                <View style={styles.chips}>
                  {a ? (
                    <Pressable style={[styles.chip, payer === "a" && styles.chipOn]} onPress={() => setPayer("a")}>
                      <Text style={[styles.chipText, payer === "a" && styles.chipTextOn]}>One invoice, {firstName(a.name)} pays</Text>
                    </Pressable>
                  ) : null}
                  {b ? (
                    <Pressable style={[styles.chip, payer === "b" && styles.chipOn]} onPress={() => setPayer("b")}>
                      <Text style={[styles.chipText, payer === "b" && styles.chipTextOn]}>One invoice, {firstName(b.name)} pays</Text>
                    </Pressable>
                  ) : null}
                  <Pressable style={[styles.chip, payer === null && styles.chipOn]} onPress={() => setPayer(null)}>
                    <Text style={[styles.chipText, payer === null && styles.chipTextOn]}>Separate invoices</Text>
                  </Pressable>
                </View>
                <Text style={styles.meta}>
                  {payer === null
                    ? "Each gets their own invoice."
                    : "Both people's sessions on one invoice, each listed with its own price. You can still split it on the invoice before sending."}
                </Text>

                <Pressable style={styles.button} onPress={save} disabled={busy}>
                  {busy ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.buttonText}>Save the pair</Text>}
                </Pressable>
                {pair ? (
                  <Pressable style={styles.stop} onPress={end} disabled={busy}>
                    <Text style={styles.stopText}>Not a pair any more</Text>
                  </Pressable>
                ) : null}
                <Pressable style={styles.closeRow} onPress={onClose}>
                  <Text style={styles.closeText}>Close</Text>
                </Pressable>
              </>
            )}
            <SafeBottom />
          </ScrollView>
        </View>
      </KeyboardSafe>
    </Modal>
  );
}

const styles = themedStyles({
  title: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 4 },
  meta: { color: "#94A3B8", fontSize: 12, marginTop: 4, lineHeight: 17 },
  body: { color: "#CBD5E1", fontSize: 13, marginTop: 3 },
  row: { backgroundColor: "#1E293B", borderRadius: 12, padding: 12, marginTop: 8 },
  suggest: { borderWidth: 1, borderColor: BRAND_GOLD, borderStyle: "dashed" },
  name: { color: "#fff", fontSize: 15, fontWeight: "700" },
  outline: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 10, padding: 10, alignItems: "center", marginTop: 10 },
  outlineText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0F172A", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: "92%" },
  sheetTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  label: { color: BRAND_GOLD, fontSize: 13, fontWeight: "700", marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: "#F8FAFC", color: "#0F172A", borderRadius: 10, padding: 10, fontSize: 15 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#334155", borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12 },
  chipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontSize: 13, fontWeight: "600" },
  chipTextOn: { color: "#0F172A" },
  pickRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pickBox: { flex: 1, borderWidth: 1, borderColor: "#334155", borderRadius: 10, padding: 12, backgroundColor: "#1E293B" },
  pickText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  pickEmpty: { color: "#64748B", fontWeight: "600" },
  amp: { color: "#94A3B8", fontSize: 16, fontWeight: "700" },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 13, alignItems: "center", marginTop: 18 },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
  stop: { borderWidth: 1, borderColor: "#EF4444", borderRadius: 10, padding: 10, alignItems: "center", marginTop: 10 },
  stopText: { color: "#EF4444", fontWeight: "700", fontSize: 14 },
  closeRow: { alignItems: "center", paddingVertical: 14 },
  closeText: { color: "#94A3B8", fontSize: 15, fontWeight: "600" },
});
