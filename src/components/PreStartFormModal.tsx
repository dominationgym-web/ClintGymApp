import React, { useEffect, useState } from "react";
import { Alert, Modal, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import ModalSafeArea from "./ModalSafeArea";
import TextInput from "@/components/TextInput";
import KeyboardSafe from "@/components/KeyboardSafe";
import { BRAND_GOLD } from "@/lib/brand";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import {
  BLANK_PRE_START,
  CONDITIONS,
  JOINT_REPLACEMENTS,
  MEDICATIONS,
  PAIN_SPOTS,
  preStartOutcome,
  preStartRisks,
  SYMPTOMS,
  type PreStartAnswers,
} from "@/lib/preStart";
import PreStartRiskList from "@/components/PreStartRiskList";
import { themedStyles } from "@/lib/theme";

// The pre-start health and safety form (src/lib/preStart.ts), one page at a
// time (GRIZZ doesn't like long scrolling), ending on the app's risk check.
// A re-test starts from the last form, so only what changed needs typing.
const PAGES = [
  "Health conditions",
  "Symptoms",
  "Medication",
  "Falls, bones and joints",
  "Activity and mobility",
  "Pain",
  "Blood pressure and clearance",
  "Strength and walking tests",
  "Balance, shoulders and posture",
  "Risk check",
] as const;

export default function PreStartFormModal({
  visible,
  clientId,
  clientName,
  start,
  onSaved,
  onClose,
}: {
  visible: boolean;
  clientId: string;
  clientName: string;
  /** The last form, for a re-test; null for the first one. */
  start: PreStartAnswers | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const [a, setA] = useState<PreStartAnswers>(BLANK_PRE_START);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (visible) {
      setPage(0);
      setA({ ...BLANK_PRE_START, ...(start ?? {}) });
    }
  }, [visible, start]);

  const set = <K extends keyof PreStartAnswers>(key: K, value: PreStartAnswers[K]) => setA((prev) => ({ ...prev, [key]: value }));
  const toggle = (key: "conditions" | "symptoms" | "medications" | "jointReplacements" | "painAreas", item: string) =>
    setA((prev) => ({ ...prev, [key]: prev[key].includes(item) ? prev[key].filter((x) => x !== item) : [...prev[key], item] }));

  const save = async () => {
    setSaving(true);
    const outcome = preStartOutcome(a);
    const { error } = await supabase.from("client_prestart_forms").insert({
      client_id: clientId,
      filled_on: todayIso(),
      answers: a as unknown as Record<string, unknown>,
      risk_level: outcome.level,
    });
    setSaving(false);
    if (error) return Alert.alert("Couldn't save the form", error.message);
    onSaved();
  };

  const chips = (key: "conditions" | "symptoms" | "medications" | "jointReplacements" | "painAreas", items: string[]) => (
    <View style={styles.chips}>
      {items.map((item) => {
        const on = a[key].includes(item);
        return (
          <Pressable key={item} style={[styles.chip, on && styles.chipOn]} onPress={() => toggle(key, item)} accessibilityState={{ selected: on }}>
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{item}</Text>
          </Pressable>
        );
      })}
    </View>
  );
  const pick = <K extends keyof PreStartAnswers>(key: K, options: { value: PreStartAnswers[K]; label: string }[]) => (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = a[key] === o.value;
        return (
          <Pressable key={o.label} style={[styles.chip, on && styles.chipOn]} onPress={() => set(key, on ? (null as PreStartAnswers[K]) : o.value)}>
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
  const yesNo = (key: keyof PreStartAnswers) =>
    pick(key, [
      { value: true as never, label: "Yes" },
      { value: false as never, label: "No" },
    ]);
  const box = (key: keyof PreStartAnswers, placeholder: string, numeric = false) => (
    <TextInput
      style={[styles.input, numeric && styles.inputShort]}
      value={String(a[key] ?? "")}
      onChangeText={(v) => set(key, v as never)}
      placeholder={placeholder}
      keyboardType={numeric ? "decimal-pad" : "default"}
      multiline={!numeric}
    />
  );
  const q = (text: string) => <Text style={styles.q}>{text}</Text>;
  const hint = (text: string) => <Text style={styles.hint}>{text}</Text>;

  const body = () => {
    switch (page) {
      case 0:
        return (
          <>
            {q("Tick any they have")}
            {chips("conditions", CONDITIONS)}
            {box("conditionNotes", "Anything else, or details")}
            {q("Is any condition new, getting worse or not under control?")}
            {yesNo("unstable")}
          </>
        );
      case 1:
        return (
          <>
            {q("In the last 3 months, have they had any of these, at rest or with effort?")}
            {chips("symptoms", SYMPTOMS)}
            {hint("Leave all unticked if none.")}
          </>
        );
      case 2:
        return (
          <>
            {q("Do they take medicine for any of these?")}
            {chips("medications", MEDICATIONS)}
            {box("medicationNotes", "Medicine names, if they know them")}
          </>
        );
      case 3:
        return (
          <>
            {q("Falls in the last 12 months")}
            {pick("falls", [
              { value: "0", label: "None" },
              { value: "1", label: "1" },
              { value: "2+", label: "2 or more" },
            ])}
            {q("Were they hurt in a fall?")}
            {yesNo("fallInjury")}
            {q("Are they afraid of falling?")}
            {yesNo("fearOfFalling")}
            {q("Broken a bone since turning 50, or from a minor fall?")}
            {yesNo("fracture")}
            {q("Joint replacements")}
            {chips("jointReplacements", JOINT_REPLACEMENTS)}
            {q("Surgery or a hospital stay in the last 6 months?")}
            {yesNo("recentSurgery")}
          </>
        );
      case 4:
        return (
          <>
            {q("How active are they now?")}
            {pick("activity", [
              { value: "none", label: "Not active" },
              { value: "light", label: "Light (some walking)" },
              { value: "regular", label: "Exercises 3+ times a week" },
            ])}
            {q("Walking aid")}
            {pick("walkingAid", [
              { value: "none", label: "None" },
              { value: "stick", label: "Walking stick" },
              { value: "walker", label: "Walker" },
            ])}
            {q("Stairs")}
            {pick("stairs", [
              { value: "easy", label: "Easy" },
              { value: "rail", label: "Needs the rail" },
              { value: "hard", label: "Struggles" },
            ])}
          </>
        );
      case 5:
        return (
          <>
            {q("Pain today, 0 (none) to 10 (worst)")}
            <View style={styles.chips}>
              {Array.from({ length: 11 }, (_, n) => (
                <Pressable key={n} style={[styles.num, a.painLevel === n && styles.chipOn]} onPress={() => set("painLevel", a.painLevel === n ? null : n)}>
                  <Text style={[styles.chipText, a.painLevel === n && styles.chipTextOn]}>{n}</Text>
                </Pressable>
              ))}
            </View>
            {q("Where?")}
            {chips("painAreas", PAIN_SPOTS)}
            {box("painNotes", "Which movements hurt, swelling, stiffness...")}
          </>
        );
      case 6:
        return (
          <>
            {q("Resting blood pressure (if you measure it)")}
            <View style={styles.row}>
              {box("bpSystolic", "Top", true)}
              <Text style={styles.slash}>/</Text>
              {box("bpDiastolic", "Bottom", true)}
            </View>
            {q("Resting heart rate (beats a minute)")}
            {box("restingHr", "e.g. 72", true)}
            {q("Medical clearance")}
            {pick("clearance", [
              { value: "not_needed", label: "Not needed" },
              { value: "requested", label: "Asked for" },
              { value: "received", label: "Received" },
            ])}
            {box("clearanceNotes", "Doctor or physio, and what they said")}
          </>
        );
      case 7:
        return (
          <>
            {q("Five-times sit-to-stand: seconds to stand up 5 times from a chair, arms crossed")}
            {box("sitToStand", "Seconds", true)}
            <Pressable style={[styles.chip, a.sitToStandUnsafe && styles.chipOn, { alignSelf: "flex-start" }]} onPress={() => set("sitToStandUnsafe", !a.sitToStandUnsafe)}>
              <Text style={[styles.chipText, a.sitToStandUnsafe && styles.chipTextOn]}>Not safe to do yet</Text>
            </Pressable>
            {q("Comfortable walk test (e.g. 6 minutes)")}
            <View style={styles.row}>
              {box("walkMinutes", "Minutes", true)}
              {box("walkMetres", "Metres", true)}
            </View>
          </>
        );
      case 8:
        return (
          <>
            {q("Tandem stance (one foot in front of the other), seconds, with a support near")}
            {box("tandemSeconds", "Seconds", true)}
            {q("Supported single-leg stance, seconds")}
            <View style={styles.row}>
              {box("singleLegLeft", "Left", true)}
              {box("singleLegRight", "Right", true)}
            </View>
            {q("Shoulder movement (arms up in front and to the side)")}
            {pick("shoulder", [
              { value: "full", label: "Full and comfortable" },
              { value: "limited", label: "Limited" },
              { value: "painful", label: "Painful" },
            ])}
            {q("Standing posture and walking")}
            {box("postureNotes", "e.g. rounded upper back, short steps, shuffles")}
          </>
        );
      default: {
        const risks = preStartRisks(a);
        const outcome = preStartOutcome(a, risks);
        return <PreStartRiskList outcome={outcome} risks={risks} />;
      }
    }
  };

  const last = page === PAGES.length - 1;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardSafe>
        <ModalSafeArea style={styles.container}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>
                Pre-start form · {clientName} · {page + 1} of {PAGES.length}
              </Text>
              <Text style={styles.title}>{PAGES[page]}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
            {body()}
          </ScrollView>
          <View style={styles.nav}>
            <Pressable style={[styles.navBtn, page === 0 && { opacity: 0.4 }]} disabled={page === 0} onPress={() => setPage((p) => p - 1)}>
              <Text style={styles.navText}>‹ Back</Text>
            </Pressable>
            {last ? (
              <Pressable style={[styles.navBtn, styles.saveBtn]} disabled={saving} onPress={save}>
                <Text style={styles.saveText}>{saving ? "Saving..." : "Save form"}</Text>
              </Pressable>
            ) : (
              <Pressable style={[styles.navBtn, styles.saveBtn]} onPress={() => setPage((p) => p + 1)}>
                <Text style={styles.saveText}>Next ›</Text>
              </Pressable>
            )}
          </View>
        </ModalSafeArea>
      </KeyboardSafe>
    </Modal>
  );
}

const styles = themedStyles({
  container: { flex: 1, backgroundColor: "#0F172A" },
  header: { flexDirection: "row", alignItems: "flex-start", padding: 20, gap: 12 },
  kicker: { color: "#94A3B8", fontSize: 12, fontWeight: "700" },
  title: { color: "#fff", fontSize: 20, fontWeight: "800", marginTop: 4 },
  close: { color: "#22C55E", fontWeight: "600", fontSize: 15 },
  q: { color: BRAND_GOLD, fontWeight: "800", fontSize: 14, marginTop: 14, marginBottom: 8 },
  hint: { color: "#94A3B8", fontSize: 12, marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#334155", borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  num: { borderWidth: 1, borderColor: "#334155", borderRadius: 8, width: 40, paddingVertical: 8, alignItems: "center" },
  chipOn: { borderColor: BRAND_GOLD, backgroundColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "700" },
  chipTextOn: { color: "#0F172A" },
  input: { backgroundColor: "#F8FAFC", borderRadius: 8, padding: 12, fontSize: 15, marginTop: 8 },
  inputShort: { width: 110 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  slash: { color: "#fff", fontSize: 20, marginTop: 8 },
  nav: { flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8 },
  navBtn: { flex: 1, borderWidth: 1, borderColor: "#475569", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  navText: { color: "#CBD5E1", fontWeight: "800", fontSize: 15 },
  saveBtn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  saveText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
});
