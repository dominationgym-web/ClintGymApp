import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import TextInput from "@/components/TextInput";
import { BRAND_GOLD } from "@/lib/brand";
import {
  AWAY_WEEK_OPTIONS,
  BILLINGS,
  DEPOSIT_OPTIONS,
  NOTICE_OPTIONS,
  type ContractChoices,
  type ContractPoint,
} from "@/lib/liveSessions";
import type { SessionBilling, SessionPolicy } from "@/types/database";
import { themedStyles } from "@/lib/theme";

// The session contract as the trainer sets it up (GRIZZ, 2026-11-19): the
// wording is written out in full, and only the parts the trainer fills in or
// changes are in bold gold. Under each point are tap buttons for those parts,
// and "Leave this point out" for the optional ones. Parts filled in for each
// client (fee, length, slot) are in bold grey with a note saying so.

type Piece = string | { pick: string } | { auto: string };

export default function ContractEditor({
  choices,
  onChange,
  billing,
  onBilling,
  policy,
  onPolicy,
  phone,
}: {
  choices: ContractChoices;
  onChange: (c: ContractChoices) => void;
  billing: SessionBilling;
  onBilling: (b: SessionBilling) => void;
  policy: SessionPolicy;
  onPolicy: (p: SessionPolicy) => void;
  phone?: string | null;
}) {
  const [ownDraft, setOwnDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [otherWeeks, setOtherWeeks] = useState(AWAY_WEEK_OPTIONS.includes(choices.awayWeeks) ? "" : String(choices.awayWeeks));
  const [otherDeposit, setOtherDeposit] = useState(DEPOSIT_OPTIONS.includes(choices.deposit) ? "" : String(choices.deposit));
  const set = (patch: Partial<ContractChoices>) => onChange({ ...choices, ...patch });
  const on = (p: ContractPoint) => !choices.off.includes(p);
  const toggle = (p: ContractPoint) => set({ off: on(p) ? [...choices.off, p] : choices.off.filter((x) => x !== p) });

  const notice = NOTICE_OPTIONS.find((n) => n.key === choices.notice) ?? NOTICE_OPTIONS[3];
  const hours = policy === "12h" ? "12" : "24";
  const weeks = `${choices.awayWeeks} week${choices.awayWeeks === 1 ? "" : "s"}`;

  // Numbers 1, 2, 3 follow whichever of the first three points are kept.
  let n = 0;
  const num = () => `${++n}. `;

  const sentence = (pieces: Piece[], dim = false) => (
    <Text style={[styles.sentence, dim && styles.dim]}>
      {pieces.map((p, i) =>
        typeof p === "string" ? (
          p
        ) : "pick" in p ? (
          <Text key={i} style={dim ? styles.pickDim : styles.pick}>
            {p.pick}
          </Text>
        ) : (
          <Text key={i} style={styles.auto}>
            {p.auto}
          </Text>
        ),
      )}
    </Text>
  );

  const chips = <T,>(opts: { key: T; label: string }[], value: T, pick: (v: T) => void) => (
    <View style={styles.chips}>
      {opts.map((o) => (
        <Pressable key={String(o.key)} style={[styles.chip, value === o.key && styles.chipOn]} onPress={() => pick(o.key)}>
          <Text style={[styles.chipText, value === o.key && styles.chipTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );

  const leaveOut = (p: ContractPoint) => (
    <Pressable onPress={() => toggle(p)} hitSlop={8}>
      <Text style={on(p) ? styles.leave : styles.putBack}>{on(p) ? "Leave this point out" : "＋ Put this point back in"}</Text>
    </Pressable>
  );

  const card = (title: string, body: React.ReactNode, point?: ContractPoint) => (
    <View style={[styles.card, point && !on(point) && styles.cardOff]}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{title}</Text>
        {point && !on(point) ? <Text style={styles.offTag}>Left out</Text> : null}
      </View>
      {body}
      {point ? leaveOut(point) : null}
    </View>
  );

  const ask = (q: string) => <Text style={styles.ask}>{q}</Text>;
  const autoNote = (t: string) => <Text style={styles.autoNote}>{t}</Text>;

  const numberBox = (value: string, setValue: (v: string) => void, apply: (n: number) => void, placeholder: string, max: number) => (
    <TextInput
      style={styles.other}
      value={value}
      onChangeText={(v) => {
        const clean = v.replace(/[^\d]/g, "");
        setValue(clean);
        const x = Number(clean);
        if (x >= 1 && x <= max) apply(x);
      }}
      keyboardType="number-pad"
      placeholder={placeholder}
      placeholderTextColor="#64748B"
      maxLength={3}
    />
  );

  return (
    <View>
      <View style={styles.key}>
        <Text style={styles.keyText}>
          <Text style={styles.pick}>Bold gold</Text> = you choose it with the buttons under each point.{"\n"}
          <Text style={styles.auto}>Bold grey</Text> = filled in by the app for each client.{"\n"}
          Everything else is the contract's wording, already written for you.
        </Text>
      </View>

      {card(
        "Payment",
        <>
          {sentence([num(), "Please note, all sessions are paid for ", { pick: billing === "advance" ? "in advance" : "in arrears (at the end of each month)" }, ". This secures your time slots."])}
          {ask("When do clients pay?")}
          {chips<SessionBilling>(
            [
              { key: "advance", label: "In advance" },
              { key: "arrears", label: "In arrears" },
            ],
            billing,
            onBilling,
          )}
          <Text style={styles.autoNote}>{BILLINGS.find((b) => b.key === billing)?.detail} Your invoices follow this.</Text>
        </>,
      )}

      {card(
        "Cancelling a session",
        <>
          {sentence(
            [on("cancel") ? num() : "", "We have a ", { pick: hours }, " hour cancellation policy. This allows the trainer to find an alternate to fill the slot. Late cancellations will be forfeited."],
            !on("cancel"),
          )}
          {ask("How many hours' notice to cancel?")}
          {chips<SessionPolicy>(
            [
              { key: "24h", label: "24 hours" },
              { key: "12h", label: "12 hours" },
              { key: "trainer", label: "I decide each time" },
            ],
            policy,
            onPolicy,
          )}
          {policy === "trainer" ? autoNote("The contract says 24 hours; you decide each time whether a late cancellation is charged.") : autoNote("Late cancellations under this are charged on invoices.")}
        </>,
        "cancel",
      )}

      {card(
        "Stopping training",
        <>
          {sentence(
            [on("notice") ? num() : "", "All trainers need to be given ", { pick: notice.words }, " notice before cancelling (vacating) your training slot. This is to allow them time to fill your slot on completion of training."],
            !on("notice"),
          )}
          {ask("How much notice before a client stops?")}
          {chips(
            NOTICE_OPTIONS.map((o) => ({ key: o.key, label: o.label })),
            choices.notice,
            (k) => set({ notice: k }),
          )}
        </>,
        "notice",
      )}

      {card(
        "Going away: holiday deposit",
        <>
          {sentence(
            [
              "• Please also note that to secure your time slot when going on holiday or business for more than ",
              { pick: weeks },
              ", a ",
              { pick: `${choices.deposit}%` },
              " deposit will be required. This is not compulsory but at the client's discretion if they want to keep that time slot.",
            ],
            !on("holiday"),
          )}
          {ask("Away for more than how many weeks?")}
          {chips(
            AWAY_WEEK_OPTIONS.map((w) => ({ key: w, label: `${w} week${w === 1 ? "" : "s"}` })),
            otherWeeks ? -1 : choices.awayWeeks,
            (w) => {
              setOtherWeeks("");
              set({ awayWeeks: w });
            },
          )}
          {numberBox(otherWeeks, setOtherWeeks, (x) => set({ awayWeeks: x }), "Other number of weeks", 52)}
          {ask("How big is the deposit?")}
          {chips(
            DEPOSIT_OPTIONS.map((d) => ({ key: d, label: `${d}%` })),
            otherDeposit ? -1 : choices.deposit,
            (d) => {
              setOtherDeposit("");
              set({ deposit: d });
            },
          )}
          {numberBox(otherDeposit, setOtherDeposit, (x) => set({ deposit: x }), "Other %, e.g. 30", 100)}
        </>,
        "holiday",
      )}

      {card(
        "Going away: your income",
        sentence(["• Once again, please do understand that if you go away the trainers do not earn an income and cannot keep slots indefinitely."], !on("away")),
        "away",
      )}

      {card(
        "Your time and contact",
        <>
          {sentence(
            [
              "Please be considerate of the fact that all trainers sell time, and their time is limited.\nIf you have any complaints or queries feel free to contact me on ",
              { auto: phone?.trim() || "WhatsApp" },
              ".",
            ],
            !on("contact"),
          )}
          {autoNote(phone?.trim() ? "Your phone number from your profile." : "Add your phone number to your profile and it shows here.")}
        </>,
        "contact",
      )}

      {choices.own.map((t, i) => (
        <View key={i} style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Your own point</Text>
          </View>
          {sentence([`• ${t}`])}
          <Pressable onPress={() => set({ own: choices.own.filter((_, j) => j !== i) })} hitSlop={8}>
            <Text style={styles.leave}>Remove this point</Text>
          </Pressable>
        </View>
      ))}
      {adding ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your own point</Text>
          <TextInput
            style={[styles.other, { minHeight: 70, textAlignVertical: "top" }]}
            value={ownDraft}
            onChangeText={setOwnDraft}
            multiline
            maxLength={600}
            placeholder="e.g. Please bring a towel and water to every session."
            placeholderTextColor="#64748B"
          />
          <View style={styles.row}>
            <Pressable
              style={[styles.chip, styles.chipOn]}
              onPress={() => {
                if (ownDraft.trim()) set({ own: [...choices.own, ownDraft.trim()] });
                setOwnDraft("");
                setAdding(false);
              }}
            >
              <Text style={[styles.chipText, styles.chipTextOn]}>Add it</Text>
            </Pressable>
            <Pressable
              style={styles.chip}
              onPress={() => {
                setOwnDraft("");
                setAdding(false);
              }}
            >
              <Text style={styles.chipText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setAdding(true)} hitSlop={8}>
          <Text style={styles.putBack}>＋ Add a point of my own</Text>
        </Pressable>
      )}

      {card(
        "Their fee and slot",
        <>
          {sentence(["• This is to confirm that I accept the rate of ", { auto: "their fee" }, " for a ", { auto: "their length" }, " min session."])}
          {sentence(["• My confirmed slot is ", { auto: "their days and times" }, "."])}
          {autoNote("Filled in for each client from their own deal on the Clients tab.")}
        </>,
      )}
      <Text style={[styles.sentence, { marginTop: 4 }]}>Please acknowledge that you understand all of the above and sign if you agree.</Text>
    </View>
  );
}

const styles = themedStyles({
  key: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginTop: 8, borderLeftWidth: 4, borderLeftColor: BRAND_GOLD },
  keyText: { color: "#CBD5E1", fontSize: 13, lineHeight: 20 },
  card: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginTop: 10, borderWidth: 1, borderColor: "#334155" },
  cardOff: { opacity: 0.6 },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  cardTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  offTag: { color: "#F87171", fontSize: 12, fontWeight: "700" },
  sentence: { color: "#E2E8F0", fontSize: 14, lineHeight: 21 },
  dim: { color: "#64748B", textDecorationLine: "line-through" },
  pick: { color: BRAND_GOLD, fontWeight: "800" },
  pickDim: { color: "#64748B", fontWeight: "800" },
  auto: { color: "#94A3B8", fontWeight: "800" },
  ask: { color: BRAND_GOLD, fontSize: 13, fontWeight: "700", marginTop: 10 },
  autoNote: { color: "#94A3B8", fontSize: 12, lineHeight: 17, marginTop: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  chip: { backgroundColor: "#0F172A", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "#334155" },
  chipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "600", fontSize: 14 },
  chipTextOn: { color: "#0F172A" },
  other: { backgroundColor: "#0F172A", color: "#fff", borderRadius: 10, padding: 10, fontSize: 14, marginTop: 8, borderWidth: 1, borderColor: "#334155" },
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
  leave: { color: "#F87171", fontSize: 13, fontWeight: "700", marginTop: 10 },
  putBack: { color: BRAND_GOLD, fontSize: 14, fontWeight: "700", marginTop: 12 },
});
