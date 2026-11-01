import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Modal, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { ScrollView } from "@/components/ScrollView";
import TextInput from "@/components/TextInput";
import KeyboardSafe from "@/components/KeyboardSafe";
import SessionMonthCalendar from "@/components/sessions/SessionMonthCalendar";
import SessionProofModal from "@/components/sessions/SessionProofModal";
import SessionTimeChips from "@/components/sessions/SessionTimeChips";
import { supabase } from "@/lib/supabase";
import { shrinkPhoto } from "@/lib/shrinkPhoto";
import { markClientContact } from "@/lib/checkinNudges";
import { whatsappLink } from "@/lib/videoCheckins";
import { BRAND_GOLD } from "@/lib/brand";
import {
  KIND_STYLE,
  STORAGE_BUCKET,
  atTime,
  autoCharge,
  clockLabel,
  dayKey,
  dayLabel,
  kindDetail,
  monthStart,
  noticeHours,
  noticeText,
  policyHours,
  proofPath,
  sessionKind,
} from "@/lib/liveSessions";
import type { LiveSession, SessionPolicy, SessionSettings } from "@/types/database";
import { themeBg, themeText, themedStyles } from "@/lib/theme";

type Step = "menu" | "cancel" | "move" | "who";

// Everything a trainer does to one session (0168): mark it done or a no-show,
// log a cancellation (with the WhatsApp screenshot), charge or credit it,
// move it, or take it off. One sheet, one step at a time.
export default function SessionActionsModal({
  session,
  clientName,
  clientPhone,
  policy,
  settings,
  sessions,
  clients,
  partners = [],
  nameOf,
  onSwitch,
  onClose,
  onChanged,
}: {
  session: LiveSession | null;
  clientName: string;
  /** The others booked in the same slot: a joint session (GRIZZ 2026-11-01). */
  partners?: LiveSession[];
  nameOf?: (s: LiveSession) => string;
  /** Opens a partner's session instead (their cancellation, no-show, etc.). */
  onSwitch?: (s: LiveSession) => void;
  clientPhone: string | null;
  policy: SessionPolicy;
  settings: SessionSettings | null;
  /** The trainer's sessions, shown on the calendar when moving one. */
  sessions: LiveSession[];
  /** The trainer's clients, to change who a session is for. */
  clients: { id: string; name: string }[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [step, setStep] = useState<Step>("menu");
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState<string | null>(null);

  useEffect(() => {
    setStep("menu");
  }, [session?.id]);

  if (!session) return null;
  const now = new Date();
  const kind = sessionKind(session, now);
  const style = KIND_STYLE[kind];
  const started = new Date(session.starts_at).getTime() <= now.getTime() + 3600000;
  const first = clientName.split(" ")[0];

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, after?: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) {
      Alert.alert("Couldn't save", error.message);
      return;
    }
    onChanged();
    if (after) Alert.alert("Saved ✅", after);
    onClose();
  };

  const outcome = (o: "done" | "no_show" | "booked") =>
    run(
      () => supabase.rpc("set_session_outcome", { p_id: session.id, p_outcome: o }),
      o === "done" ? `${first} gets a notification to confirm with one tap.` : o === "no_show" ? "Marked as a no-show. It's charged." : undefined
    );

  const charge = (c: "charge" | "credit" | "makeup") =>
    run(
      () => supabase.rpc("set_session_charge", { p_id: session.id, p_charge: c }),
      c === "makeup" ? `No credit: ${first} gets a catch-up session instead. Book it under To do › Catch-ups. You'll be reminded on Mondays and Wednesdays.` : undefined
    );

  // A weekly session (0175) asks whether a change is for this day only or
  // for every week after (GRIZZ, 2026-11-01: "a change just for today or
  // going forward long term").
  const weekly = !!session.repeat_id;

  // A joint session moves and comes off together, unless the trainer says
  // just this person (e.g. one of them stops coming).
  const joint = session.status === "booked" ? partners.filter((p) => p.status === "booked") : [];
  const jointNames = [first, ...joint.map((p) => (nameOf ? nameOf(p) : "").split(" ")[0])].join(" & ");
  const withPartners = (onlyMe: boolean, go: (who: LiveSession[]) => void) => () => go(onlyMe ? [session] : [session, ...joint]);
  const forWho = (verb: string, go: (who: LiveSession[]) => void) =>
    joint.length
      ? Alert.alert(`${verb} the joint session?`, `${jointNames} train together at this time.`, [
          { text: "Back", style: "cancel" },
          { text: `Just ${first}`, onPress: withPartners(true, go) },
          { text: joint.length === 1 ? "Both" : "All of them", onPress: withPartners(false, go) },
        ])
      : go([session]);
  const each = (who: LiveSession[], rpc: (s: LiveSession) => PromiseLike<{ error: { message: string } | null }>) => async () => {
    for (const s of who) {
      const res = await rpc(s);
      if (res.error) return res;
    }
    return { error: null };
  };
  const label = (who: LiveSession[]) => (who.length > 1 ? jointNames : first);

  const remove = () => forWho("Take off", removeFor);
  const removeFor = (who: LiveSession[]) =>
    weekly
      ? Alert.alert("Take off just this one, or every week?", "To record a cancellation, use Log a cancellation instead.", [
          { text: "Back", style: "cancel" },
          { text: "Just this one", onPress: () => run(each(who, (s) => supabase.rpc("remove_live_session", { p_id: s.id }))) },
          {
            text: "This and every week after",
            style: "destructive",
            onPress: () =>
              run(
                each(who, (s) => (s.repeat_id ? supabase.rpc("stop_live_repeat", { p_id: s.id }) : supabase.rpc("remove_live_session", { p_id: s.id }))),
                `${label(who)}'s weekly session stops from ${dayLabel(session.starts_at)}.`
              ),
          },
        ])
      : Alert.alert("Take this session off the calendar?", "Use this for a session booked by mistake. To record a cancellation, use Log a cancellation instead.", [
          { text: "Back", style: "cancel" },
          { text: "Take it off", style: "destructive", onPress: () => run(each(who, (s) => supabase.rpc("remove_live_session", { p_id: s.id }))) },
        ]);

  const moveOne = (who: LiveSession[], at: string) =>
    run(each(who, (s) => supabase.rpc("move_live_session", { p_id: s.id, p_starts_at: at })), who.some((s) => s.client_id) ? `${label(who)} has been told.` : undefined);
  const move = (at: string) => forWho("Move", (who) => moveFor(who, at));
  const moveFor = (who: LiveSession[], at: string) =>
    weekly
      ? Alert.alert("Move just this one, or every week?", `${dayLabel(at)} at ${clockLabel(at)}.`, [
          { text: "Back", style: "cancel" },
          { text: "Just this one", onPress: () => moveOne(who, at) },
          {
            text: "This and every week after",
            onPress: () =>
              run(
                each(who, (s) =>
                  s.repeat_id ? supabase.rpc("move_live_repeat", { p_id: s.id, p_starts_at: at }) : supabase.rpc("move_live_session", { p_id: s.id, p_starts_at: at })
                ),
                `From ${dayLabel(at)}, every week at ${clockLabel(at)}.${who.some((s) => s.client_id) ? ` ${label(who)} has been told.` : ""}`
              ),
          },
        ])
      : moveOne(who, at);

  const makeWeekly = () => {
    const who = [session, ...joint.filter((p) => !p.repeat_id)];
    run(
      each(who, (s) => supabase.rpc("repeat_live_session", { p_id: s.id })),
      `${label(who)} ${who.length > 1 ? "are" : "is"} now booked every week at this day and time. Change or take one off any time.`
    );
  };

  const link = whatsappLink(clientPhone);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardSafe>
        <View style={styles.backdrop}>
          <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>{clientName}</Text>
            <Text style={styles.when}>
              {dayLabel(session.starts_at)} · {clockLabel(session.starts_at)} · {session.minutes} min
            </Text>
            <Text style={[styles.kind, { color: themeText(style.colour) }]}>
              {style.icon} {kindDetail(kind, session.cancelled_at ? noticeHours(session.starts_at, session.cancelled_at) : null, {
                clientOk: !!session.client_confirmed_at,
                disputed: !!session.client_disputed_at,
                catchUp: !!session.makeup_for,
                catchUpBooked: !!session.makeup_session_id,
              })}
            </Text>
            {session.status === "done" && !session.client_confirmed_at && !session.client_disputed_at ? (
              <Text style={styles.meta}>Waiting for {first} to confirm.</Text>
            ) : null}
            {weekly ? <Text style={styles.meta}>🔁 Every week at this time</Text> : null}
            {joint.length ? (
              <View style={{ marginTop: 6 }}>
                <Text style={styles.meta}>👥 Joint session with {joint.map((p) => (nameOf ? nameOf(p) : "")).join(" & ")}. Moving or taking it off asks if it's for both. For a cancellation or no-show, tap the person:</Text>
                {onSwitch ? (
                  <View style={styles.chips}>
                    <Chip label={first} on onPress={() => {}} />
                    {joint.map((p) => (
                      <Chip key={p.id} label={(nameOf ? nameOf(p) : "").split(" ")[0]} on={false} onPress={() => onSwitch(p)} />
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
            {session.note ? <Text style={styles.meta}>"{session.note}"</Text> : null}
            {session.proof_path ? (
              <Pressable onPress={() => setProof(session.proof_path)}>
                <Text style={styles.link}>📸 See the cancellation message</Text>
              </Pressable>
            ) : null}

            {step === "menu" && (
              <View style={{ marginTop: 12, gap: 8 }}>
                {(session.status === "booked" || session.status === "no_show" || session.status === "cancelled") && started ? (
                  <Big label="✓ Done, we trained" onPress={() => outcome("done")} busy={busy} />
                ) : null}
                {session.status !== "no_show" && session.status !== "removed" && started ? (
                  <Outline label="No-show (charged)" onPress={() => outcome("no_show")} />
                ) : null}
                {session.status !== "removed" ? <Outline label="Log a cancellation" onPress={() => setStep("cancel")} /> : null}
                {(session.status === "cancelled" || session.status === "no_show") && !session.makeup_session_id ? (
                  <View style={styles.chips}>
                    <Chip label="🔴 Charge" on={session.charge === "charge"} onPress={() => charge("charge")} />
                    <Chip label="🟢 Credit" on={session.charge === "credit"} onPress={() => charge("credit")} />
                    <Chip label="🔁 Catch-up" on={session.charge === "makeup"} onPress={() => charge("makeup")} />
                  </View>
                ) : null}
                {session.status === "booked" ? <Outline label="Move to another time" onPress={() => setStep("move")} /> : null}
                {session.status === "booked" && !weekly && !session.makeup_for ? <Outline label="🔁 Repeat every week" onPress={makeWeekly} /> : null}
                {!session.invoice_id && session.status !== "removed" ? (
                  <Outline label={session.client_id ? "👤 Change who" : "👤 Link to their app account"} onPress={() => setStep("who")} />
                ) : null}
                {!session.client_id ? <Text style={styles.meta}>In your diary by name only: no notifications or invoice until you link them to their app account.</Text> : null}
                {session.status !== "booked" && session.status !== "removed" && new Date(session.starts_at) > now ? (
                  <Outline label="Undo: back to booked" onPress={() => outcome("booked")} />
                ) : null}
                {session.status === "done" ? <Outline label="Undo: not marked yet" onPress={() => outcome("booked")} /> : null}
                {link ? (
                  <Outline
                    label="💬 WhatsApp"
                    onPress={() => {
                      if (session.client_id) markClientContact(session.client_id);
                      Linking.openURL(link);
                    }}
                  />
                ) : null}
                {session.status === "booked" ? <Outline label="Take off the calendar" onPress={remove} danger /> : null}
              </View>
            )}

            {step === "cancel" && <CancelForm session={session} policy={policy} first={first} onDone={() => (onChanged(), onClose())} onBack={() => setStep("menu")} />}

            {step === "move" && <MoveForm session={session} sessions={sessions} settings={settings} onSave={move} onBack={() => setStep("menu")} />}

            {step === "who" && (
              <WhoForm
                session={session}
                clients={clients}
                onSave={(client, name, all) =>
                  run(
                    () => supabase.rpc("set_live_session_person", { p_id: session.id, p_client: client, p_name: name, p_all: all }),
                    client ? `${clients.find((c) => c.id === client)?.name.split(" ")[0] ?? "They"} gets a notification for the sessions coming up.` : undefined
                  )
                }
                onBack={() => setStep("menu")}
              />
            )}

            <Pressable style={styles.close} onPress={onClose}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardSafe>
      <SessionProofModal path={proof} onClose={() => setProof(null)} />
    </Modal>
  );
}

// Who a session is for: one of the trainer's app clients, or a name only.
// Linking a name to a client can take all that name's sessions with it.
function WhoForm({
  session,
  clients,
  onSave,
  onBack,
}: {
  session: LiveSession;
  clients: { id: string; name: string }[];
  onSave: (client: string | null, name: string | null, all: boolean) => void;
  onBack: () => void;
}) {
  const [client, setClient] = useState<string | null>(session.client_id);
  const [name, setName] = useState(session.client_id ? "" : session.guest_name ?? "");
  const [all, setAll] = useState(!session.client_id);
  const guest = session.guest_name ?? null;
  const changed = client ? client !== session.client_id : !!name.trim() && name.trim() !== (session.guest_name ?? "");
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.label}>Who is it?</Text>
      <View style={styles.chips}>
        {clients.map((c) => (
          <Chip key={c.id} label={c.name} on={client === c.id} onPress={() => setClient(client === c.id ? null : c.id)} />
        ))}
      </View>
      <Text style={styles.label}>Or someone not in the app yet</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={(t) => {
          setName(t);
          if (t.trim()) setClient(null);
        }}
        placeholder="Name"
        placeholderTextColor="#64748B"
        maxLength={60}
      />
      {guest && client ? (
        <Pressable style={styles.tickRow} onPress={() => setAll(!all)}>
          <Text style={styles.tickBox}>{all ? "☑" : "☐"}</Text>
          <Text style={styles.meta}>All of "{guest}"'s sessions not invoiced yet, and match "{guest}" to them in future imports</Text>
        </Pressable>
      ) : null}
      <Pressable style={[styles.button, !changed && { opacity: 0.5 }]} disabled={!changed} onPress={() => onSave(client, client ? null : name.trim(), !!(guest && client && all))}>
        <Text style={styles.buttonText}>Save</Text>
      </Pressable>
      <Pressable style={styles.close} onPress={onBack}>
        <Text style={styles.closeText}>Back</Text>
      </Pressable>
    </View>
  );
}

// "When did they tell you?": a day before the session and a time, the
// WhatsApp screenshot, and the charge or credit that follows from the rule.
function CancelForm({
  session,
  policy,
  first,
  onDone,
  onBack,
}: {
  session: LiveSession;
  policy: SessionPolicy;
  first: string;
  onDone: () => void;
  onBack: () => void;
}) {
  const now = new Date();
  const sessionDay = dayKey(session.starts_at);
  const days: string[] = [];
  for (let i = 0; i <= 3; i++) {
    const d = new Date(session.starts_at);
    d.setDate(d.getDate() - i);
    if (dayKey(d) <= dayKey(now)) days.push(dayKey(d));
  }
  if (!days.includes(dayKey(now)) && dayKey(now) < sessionDay) days.unshift(dayKey(now));
  const [by, setBy] = useState<"client" | "trainer">("client");
  const [day, setDay] = useState(days.includes(dayKey(now)) ? dayKey(now) : days[0] ?? sessionDay);
  const [time, setTime] = useState(clockLabel(now));
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [override, setOverride] = useState<"charge" | "credit" | "makeup" | null>(null);
  const [saving, setSaving] = useState(false);

  const validTime = /^([01]?\d|2[0-3]):[0-5]\d$/.test(time.trim());
  const told = validTime ? atTime(day, time.trim().padStart(5, "0")) : null;
  const hours = told ? noticeHours(session.starts_at, told) : null;
  const auto = told ? autoCharge(policy, by, session.starts_at, told) : null;
  const decided: "charge" | "credit" | "makeup" | null = override ?? auto;

  const pick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photos to pick the WhatsApp screenshot.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0]);
  };

  const save = async () => {
    if (!told) {
      Alert.alert("Check the time", "Type the time they told you, like 17:45.");
      return;
    }
    if (!decided) {
      Alert.alert("Charge or credit?", `Pick whether ${first} pays for this session.`);
      return;
    }
    setSaving(true);
    try {
      let path: string | null = null;
      if (photo && session.client_id) {
        path = proofPath(session.client_id, session.id);
        const small = await shrinkPhoto(photo.uri, photo.width, photo.height);
        const body = await new File(small.uri).arrayBuffer();
        const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, body, { contentType: "image/jpeg" });
        if (error) throw error;
      }
      const { error } = await supabase.rpc("log_session_cancellation", {
        p_id: session.id,
        p_by: by,
        p_cancelled_at: told,
        p_proof_path: path,
        p_note: note.trim() || null,
        p_charge: override,
      });
      if (error) throw error;
      Alert.alert(
        "Cancellation logged ✅",
        decided === "charge"
          ? "It's charged on their invoice, marked red."
          : decided === "makeup"
            ? `No credit: ${first} gets a catch-up instead. Book it under To do › Catch-ups.`
            : "It's credited on their invoice, marked green."
      );
      onDone();
    } catch (err) {
      Alert.alert("Couldn't save", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.label}>Who cancelled?</Text>
      <View style={styles.chips}>
        <Chip label={first} on={by === "client"} onPress={() => setBy("client")} />
        <Chip label="Me (coach)" on={by === "trainer"} onPress={() => setBy("trainer")} />
      </View>

      <Text style={styles.label}>When did they tell you?</Text>
      <View style={styles.chips}>
        {days.map((d) => (
          <Chip key={d} label={d === dayKey(now) ? "Today" : dayLabel(d)} on={day === d} onPress={() => setDay(d)} />
        ))}
      </View>
      <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="17:45" placeholderTextColor="#64748B" maxLength={5} keyboardType="numbers-and-punctuation" />
      <Text style={styles.meta}>The time on their WhatsApp message.</Text>

      {/* A diary-only name has no app account to keep the screenshot under. */}
      {by === "client" && session.client_id ? (
        <>
          <Text style={styles.label}>Screenshot of the message</Text>
          <Pressable style={styles.outline} onPress={pick}>
            <Text style={styles.outlineText}>{photo ? "✓ Screenshot added · change" : "📸 Add the WhatsApp screenshot"}</Text>
          </Pressable>
          <Text style={styles.meta}>Saved as proof. {first} can see it on their invoice.</Text>
        </>
      ) : null}

      <Text style={styles.label}>Note (optional)</Text>
      <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="Sick, work, travelling..." placeholderTextColor="#64748B" maxLength={200} />

      {hours !== null ? (
        <View style={[styles.result, { borderColor: themeBg(decided === "charge" ? "#EF4444" : decided === "credit" ? "#22C55E" : "#F59E0B") }]}>
          <Text style={styles.resultText}>
            {by === "trainer"
              ? "You cancelled, so it's credited."
              : `${noticeText(hours)[0].toUpperCase()}${noticeText(hours).slice(1)}. ${
                  policyHours(policy) === null
                    ? "Your rule: you decide."
                    : auto === "charge"
                      ? `Less than ${policyHours(policy)} hours, so it's charged.`
                      : `${policyHours(policy)} hours or more, so it's credited.`
                }`}
          </Text>
          <View style={styles.chips}>
            <Chip label="🔴 Charge" on={decided === "charge"} onPress={() => setOverride("charge")} />
            <Chip label="🟢 Credit" on={decided === "credit"} onPress={() => setOverride("credit")} />
            {by === "client" ? <Chip label="🔁 Catch-up" on={decided === "makeup"} onPress={() => setOverride("makeup")} /> : null}
          </View>
          {by === "client" && auto !== "charge" ? <Text style={styles.meta}>In time: give a credit, or a catch-up session instead.</Text> : null}
        </View>
      ) : null}

      <Big label="Save cancellation" onPress={save} busy={saving} />
      <Outline label="Back" onPress={onBack} />
    </View>
  );
}

function MoveForm({
  session,
  sessions,
  settings,
  onSave,
  onBack,
}: {
  session: LiveSession;
  sessions: LiveSession[];
  settings: SessionSettings | null;
  onSave: (at: string) => void;
  onBack: () => void;
}) {
  const [month, setMonth] = useState(monthStart(new Date(session.starts_at)));
  const [day, setDay] = useState<string | null>(dayKey(session.starts_at));
  const [time, setTime] = useState<string | null>(null);
  const booked = sessions
    .filter((s) => s.id !== session.id && (s.status === "booked" || s.status === "done") && day && dayKey(s.starts_at) === day)
    .map((s) => ({ time: clockLabel(s.starts_at), minutes: s.minutes }));
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.label}>Pick the new day</Text>
      <SessionMonthCalendar month={month} onMonth={setMonth} sessions={sessions} selected={day} onSelect={setDay} />
      {day ? (
        <>
          <Text style={styles.label}>New time on {dayLabel(day)}</Text>
          <SessionTimeChips
            dayStart={settings?.day_start ?? "05:00"}
            dayEnd={settings?.day_end ?? "20:00"}
            minutes={session.minutes}
            booked={booked}
            selected={time ? [time] : []}
            onPick={setTime}
          />
        </>
      ) : null}
      <Big label={day && time ? `Move to ${dayLabel(day)} ${time}` : "Pick a day and time"} onPress={() => day && time && onSave(atTime(day, time))} />
      <Outline label="Back" onPress={onBack} />
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

function Big({ label, onPress, busy }: { label: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable style={styles.button} onPress={onPress} disabled={busy}>
      {busy ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.buttonText}>{label}</Text>}
    </Pressable>
  );
}

function Outline({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable style={[styles.outline, danger && styles.danger]} onPress={onPress}>
      <Text style={[styles.outlineText, danger && styles.dangerText]}>{label}</Text>
    </Pressable>
  );
}

const styles = themedStyles({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0F172A", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: "92%" },
  title: { color: "#fff", fontSize: 20, fontWeight: "800" },
  when: { color: "#CBD5E1", fontSize: 15, marginTop: 4 },
  kind: { fontSize: 14, fontWeight: "700", marginTop: 6 },
  meta: { color: "#94A3B8", fontSize: 12, marginTop: 4 },
  link: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14, marginTop: 8 },
  label: { color: BRAND_GOLD, fontSize: 13, fontWeight: "700", marginTop: 14, marginBottom: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  chip: { backgroundColor: "#1E293B", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "#334155" },
  chipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "600", fontSize: 14 },
  chipTextOn: { color: "#0F172A" },
  tickRow: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: 12 },
  tickBox: { color: BRAND_GOLD, fontSize: 18 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 10, padding: 12, fontSize: 15, marginTop: 6, borderWidth: 1, borderColor: "#334155" },
  result: { borderWidth: 2, borderRadius: 10, padding: 12, marginTop: 14 },
  resultText: { color: "#fff", fontSize: 14, lineHeight: 20 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 14 },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
  outline: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 10, padding: 12, alignItems: "center", marginTop: 8 },
  outlineText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14 },
  danger: { borderColor: "#EF4444" },
  dangerText: { color: "#EF4444" },
  close: { padding: 12, alignItems: "center", marginTop: 8 },
  closeText: { color: "#94A3B8", fontWeight: "700", fontSize: 15 },
});
