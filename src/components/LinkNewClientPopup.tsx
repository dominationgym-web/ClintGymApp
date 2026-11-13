import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, Modal, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { clientsToAsk, rankNames, type LinkClient, type LinkName } from "@/lib/clientLinks";
import { friendlyAlert } from "@/lib/network";
import { onPopupChange, popupOpen, setPopupOpen } from "@/lib/popupGate";
import { themeText, themedStyles } from "@/lib/theme";
import { renewedPlanDates } from "@/lib/planRenewal";
import { trainingTypeFields, type TrainingType } from "@/components/TrainingTypePicker";
import type { Client } from "@/types/database";

type Step =
  | { kind: "ask" }
  | { kind: "others" }
  | { kind: "confirm"; name: LinkName }
  // `waiting`: the client's app isn't switched on yet, so they sit on the payment page.
  | { kind: "done"; name: string; moved: number; waiting: PlanFields | null }
  | { kind: "on"; type: TrainingType };

type PlanFields = Pick<Client, "access_status" | "plan_type" | "plan_started_at" | "plan_expires_at">;

// When a client joins the app with the trainer's code, the trainer's app asks
// straight away whether they're one of the names on the 1 on 1 calendar that
// aren't in the app yet (GRIZZ, 2026-11-10: "a pop-up comes up when the client
// joins, that the trainer can link him to the app"). One tap on the name, one
// on Yes, and every session, weekly time, away date and price under that name
// moves to the client's account. "A new client" stops the question;
// "Ask me later" asks again the next time the app is opened.
export default function LinkNewClientPopup() {
  const { trainer } = useAuth();
  const [queue, setQueue] = useState<LinkClient[]>([]);
  const [names, setNames] = useState<LinkName[]>([]);
  const [step, setStep] = useState<Step>({ kind: "ask" });
  const [busy, setBusy] = useState(false);
  // "Ask me later" for this run of the app.
  const later = useRef(new Set<string>());
  const loading = useRef(false);

  const trainerId = trainer?.id;
  const approved = trainer?.approved;

  const check = useCallback(async () => {
    if (!trainerId || !approved || loading.current) return;
    loading.current = true;
    try {
      const { data, error } = await supabase.rpc("clients_to_link");
      if (error || !data) return;
      const ask = clientsToAsk(data.clients ?? [], data.names ?? []).filter((c) => !later.current.has(c.id));
      setNames(data.names ?? []);
      setQueue((q) => (q.length ? q : ask));
    } finally {
      loading.current = false;
    }
  }, [trainerId, approved]);

  useEffect(() => {
    if (!trainerId || !approved) return;
    check();
    const sub = AppState.addEventListener("change", (state) => state === "active" && check());
    return () => sub.remove();
  }, [trainerId, approved, check]);

  // Waits while another pop-up (the referral one) is showing.
  const [blocked, setBlocked] = useState(() => popupOpen("link"));
  useEffect(() => onPopupChange(() => setBlocked(popupOpen("link"))), []);

  const client = queue[0];
  const visible = !!client && !blocked;
  useEffect(() => {
    setPopupOpen("link", visible);
    return () => setPopupOpen("link", false);
  }, [visible]);

  const ranked = useMemo(() => (client ? rankNames(names, client.name) : []), [names, client]);
  const likely = ranked.filter((n) => n.match > 0).slice(0, 3);

  if (!visible) return null;

  const first = client.name.trim().split(/\s+/)[0] || "They";
  const next = () => {
    setStep({ kind: "ask" });
    // No names left on the calendar: nothing more to ask.
    setQueue((q) => (names.length ? q.slice(1) : []));
  };
  const askLater = () => {
    later.current.add(client.id);
    next();
  };
  const newClient = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("skip_client_link", { p_client: client.id });
    setBusy(false);
    if (error) return Alert.alert(...friendlyAlert("Couldn't save that", error));
    next();
  };
  const link = async (n: LinkName) => {
    setBusy(true);
    const { data, error } = await supabase.rpc("link_diary_name", { p_client: client.id, p_name: n.name });
    setBusy(false);
    if (error) return Alert.alert(...friendlyAlert("Couldn't link them", error));
    setNames((all) => all.filter((x) => x.key !== n.key));
    // Not switched on yet? A 1 on 1 client pays per session on invoices, so
    // the trainer can switch their app on right here instead of the client
    // waiting on the payment page (GRIZZ, 2026-11-13).
    const { data: row } = await supabase
      .from("clients")
      .select("access_status, plan_type, plan_started_at, plan_expires_at")
      .eq("id", client.id)
      .maybeSingle();
    const waiting = row && row.access_status === "expired" ? (row as PlanFields) : null;
    setStep({ kind: "done", name: n.name, moved: data?.moved ?? 0, waiting });
  };
  const switchOn = async (plan: PlanFields, type: TrainingType) => {
    const dates = renewedPlanDates({ ...plan, plan_type: plan.plan_type ?? "intro_1mo" }, new Date());
    if (!dates) return;
    setBusy(true);
    const { error } = await supabase
      .from("clients")
      .update({ ...dates, ...trainingTypeFields(type) })
      .eq("id", client.id);
    setBusy(false);
    if (error) return Alert.alert(...friendlyAlert("Couldn't switch them on", error));
    setStep({ kind: "on", type });
  };

  const nameButton = (n: LinkName & { match?: number }, big: boolean) => (
    <Pressable key={n.key} style={big ? styles.button : styles.chip} onPress={() => setStep({ kind: "confirm", name: n })} disabled={busy}>
      <Text style={big ? styles.buttonText : styles.chipText}>{big ? `Yes, it's ${n.name}` : n.name}</Text>
      {big && n.coming ? <Text style={styles.buttonSub}>{n.coming} coming up on your calendar</Text> : null}
    </Pressable>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={step.kind === "ask" ? askLater : step.kind === "done" || step.kind === "on" ? next : () => setStep({ kind: "ask" })}>
      <View style={styles.backdrop}>
        <View style={styles.popup}>
          <Text style={styles.kicker}>NEW CLIENT ON THE APP</Text>

          {step.kind === "ask" ? (
            <>
              <Text style={styles.title}>{client.name} joined</Text>
              <Text style={styles.body}>
                Is {first} on your 1 on 1 calendar already? Tap their name to link them, and their sessions move onto {first}'s app account.
              </Text>
              {likely.map((n) => nameButton(n, true))}
              {ranked.length > likely.length ? (
                <Pressable style={styles.outline} onPress={() => setStep({ kind: "others" })}>
                  <Text style={styles.outlineText}>{likely.length ? "Someone else on my calendar" : "Pick their name on my calendar"}</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.outline} onPress={newClient} disabled={busy}>
                {busy ? <ActivityIndicator color={BRAND_GOLD} /> : <Text style={styles.outlineText}>No, a new client</Text>}
              </Pressable>
              <Pressable style={styles.secondary} onPress={askLater}>
                <Text style={styles.secondaryText}>Ask me later</Text>
              </Pressable>
            </>
          ) : null}

          {step.kind === "others" ? (
            <>
              <Text style={styles.title}>Which one is {first}?</Text>
              <Text style={styles.body}>The names on your calendar that aren't in the app yet.</Text>
              <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={styles.chips}>
                {ranked.map((n) => nameButton(n, false))}
              </ScrollView>
              <Pressable style={styles.secondary} onPress={() => setStep({ kind: "ask" })}>
                <Text style={styles.secondaryText}>Back</Text>
              </Pressable>
            </>
          ) : null}

          {step.kind === "confirm" ? (
            <>
              <Text style={styles.title}>
                Link {step.name.name} to {client.name}?
              </Text>
              <Text style={styles.body}>
                Everything under "{step.name.name}" moves to {first}: sessions, weekly times, away dates and their price. {first} gets a
                notification for the sessions coming up.
              </Text>
              <Pressable style={styles.button} onPress={() => link(step.name)} disabled={busy}>
                {busy ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.buttonText}>Yes, link them</Text>}
              </Pressable>
              <Pressable style={styles.secondary} onPress={() => setStep({ kind: "ask" })} disabled={busy}>
                <Text style={styles.secondaryText}>Back</Text>
              </Pressable>
            </>
          ) : null}

          {step.kind === "done" ? (
            <>
              <Text style={styles.title}>✓ Linked</Text>
              <Text style={styles.body}>
                {step.moved === 1 ? "1 session" : `${step.moved} sessions`} moved from "{step.name}" to {client.name}. New calendar imports with
                that name go to {first} too.
              </Text>
              {step.waiting ? (
                <>
                  <Text style={[styles.body, styles.waiting]}>
                    {first}'s app isn't switched on yet, so they're waiting on the payment page. Switch it on now?
                  </Text>
                  <Pressable style={styles.button} onPress={() => switchOn(step.waiting!, "one")} disabled={busy}>
                    {busy ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.buttonText}>Switch on: 1 on 1</Text>}
                  </Pressable>
                  <Pressable style={styles.outline} onPress={() => switchOn(step.waiting!, "both")} disabled={busy}>
                    <Text style={styles.outlineText}>Switch on: 1 on 1 + Evolution</Text>
                  </Pressable>
                  <Pressable style={styles.secondary} onPress={next} disabled={busy}>
                    <Text style={styles.secondaryText}>Not yet</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable style={styles.button} onPress={next}>
                  <Text style={styles.buttonText}>{queue.length > 1 ? "Next new client" : "Done"}</Text>
                </Pressable>
              )}
            </>
          ) : null}

          {step.kind === "on" ? (
            <>
              <Text style={styles.title}>✓ {first}'s app is on</Text>
              <Text style={styles.body}>
                {first} is in as {step.type === "one" ? "a 1 on 1 client" : "a 1 on 1 + Evolution client"}. Their app opens by itself.
              </Text>
              <Pressable style={styles.button} onPress={next}>
                <Text style={styles.buttonText}>{queue.length > 1 ? "Next new client" : "Done"}</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = themedStyles({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", padding: 20 },
  popup: { backgroundColor: "#0F172A", borderRadius: 16, padding: 20, borderWidth: 1.5, borderColor: BRAND_GOLD, maxWidth: 460, width: "100%", alignSelf: "center" },
  kicker: { color: BRAND_GOLD, fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginBottom: 6 },
  title: { color: "#fff", fontSize: 21, fontWeight: "800", marginBottom: 8 },
  body: { color: "#CBD5E1", fontSize: 14, lineHeight: 20, marginBottom: 6 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 10 },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
  buttonSub: { color: "#0F172A", fontSize: 12, marginTop: 2 },
  outline: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 10, padding: 13, alignItems: "center", marginTop: 10 },
  outlineText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 15 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 6 },
  chip: { backgroundColor: "#1E293B", borderRadius: 20, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: "#334155" },
  chipText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondary: { alignItems: "center", padding: 12, marginTop: 4 },
  secondaryText: { color: "#94A3B8", fontWeight: "700", fontSize: 15 },
  waiting: { color: "#F8E7A1", marginTop: 8 },
});
