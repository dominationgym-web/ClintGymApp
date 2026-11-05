import React, { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import FoldSection from "@/components/FoldSection";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { agreementCurrent, feeText, fillAgreement } from "@/lib/liveSessions";
import type { SessionAgreement, SessionPlan, SessionSettings } from "@/types/database";
import { themeText, themedStyles } from "@/lib/theme";

const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// The session contract a client signed with their trainer, always one tap
// away on that client's page (GRIZZ, 2026-11-05: "keep the trainers contract
// accessible in the clients section on each client"). Shows the exact words
// they signed, their typed name and the date; earlier signed copies stay
// readable underneath. Not signed yet: the wording they'll be asked to sign.
// `always` shows the heading even when there's nothing yet (1 on 1 clients);
// otherwise it hides for clients with no sessions set up and nothing signed.
export default function ClientContractFold({
  clientId,
  clientName,
  open,
  onToggle,
  always = false,
  refreshKey,
}: {
  clientId: string;
  clientName: string;
  open: boolean;
  onToggle: () => void;
  always?: boolean;
  /** Change it to reload, e.g. after their session terms are saved. */
  refreshKey?: unknown;
}) {
  const { trainer } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [settings, setSettings] = useState<SessionSettings | null>(null);
  const [signed, setSigned] = useState<SessionAgreement[]>([]);
  const [reading, setReading] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, a, s] = await Promise.all([
      supabase.from("session_plans").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("session_agreements").select("*").eq("client_id", clientId).order("signed_at", { ascending: false }),
      trainer ? supabase.from("session_settings").select("*").eq("trainer_id", trainer.id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setPlan(p.data ?? null);
    setSigned(a.data ?? []);
    setSettings((s.data as SessionSettings | null) ?? null);
    setLoaded(true);
  }, [clientId, trainer]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (!loaded) return null;
  if (!always && !plan && signed.length === 0) return null;

  const first = clientName.trim().split(/\s+/)[0] || "They";
  const latest = signed[0] ?? null;
  const current = !!plan && agreementCurrent(latest, plan);
  const cleared = !!plan && !current && agreementCurrent(plan.agreement_cleared, plan);
  const hint = current
    ? `Signed ${longDate(latest!.signed_at)}`
    : latest
      ? plan
        ? `Not signed for their new terms · last signed ${longDate(latest.signed_at)}`
        : `Signed ${longDate(latest.signed_at)}`
      : cleared
        ? "No signature needed"
        : plan
          ? "Not signed yet"
          : "No contract yet";

  // What they'd be asked to sign for their current terms.
  const draft = plan
    ? fillAgreement(settings?.agreement_text, {
        coach: trainer?.business_name?.trim() || trainer?.name || "Your coach",
        client: clientName,
        fee: feeText(plan, settings?.currency ?? "ZAR"),
        policy: plan.policy,
        billing: plan.billing,
        minutes: plan.minutes,
        regular: plan.regular,
        contact: trainer?.phone ?? null,
      })
    : null;

  return (
    <FoldSection icon="📄" title="Contract" hint={hint} open={open} onToggle={onToggle}>
      {current && latest ? (
        <Signed a={latest} />
      ) : (
        <>
          {plan ? (
            <Text style={[styles.status, { color: themeText(cleared ? "#94A3B8" : "#F59E0B") }]}>
              {cleared
                ? `You cleared ${first} for their current terms, so no signature is needed.`
                : `${first} hasn't signed for their current terms yet. Send it from 1 on 1 › Today › Not signed yet.`}
            </Text>
          ) : (
            <Text style={styles.helper}>
              {latest ? `${first}'s sessions are stopped. Their last signed contract is below.` : `No contract yet. Set up ${first}'s sessions and they'll be asked to sign one.`}
            </Text>
          )}
          {draft ? (
            <>
              <Pressable onPress={() => setReading(reading === "draft" ? null : "draft")} hitSlop={6}>
                <Text style={styles.link}>{reading === "draft" ? "▴" : "▾"} Read what they'll sign</Text>
              </Pressable>
              {reading === "draft" ? <Text style={styles.text}>{draft}</Text> : null}
            </>
          ) : null}
          {latest && !plan ? <Signed a={latest} /> : null}
        </>
      )}
      {/* Earlier signed copies, kept as proof. */}
      {signed.slice(current || (latest && !plan) ? 1 : 0).length ? (
        <>
          <Text style={styles.label}>Earlier signed copies</Text>
          {signed.slice(current || (latest && !plan) ? 1 : 0).map((a) => (
            <View key={a.id}>
              <Pressable onPress={() => setReading(reading === a.id ? null : a.id)} hitSlop={6}>
                <Text style={styles.link}>
                  {reading === a.id ? "▴" : "▾"} Signed {longDate(a.signed_at)} by {a.signed_name}
                </Text>
              </Pressable>
              {reading === a.id ? <Text style={styles.text}>{a.agreement}</Text> : null}
            </View>
          ))}
        </>
      ) : null}
    </FoldSection>
  );
}

function Signed({ a }: { a: SessionAgreement }) {
  return (
    <>
      <Text style={[styles.status, { color: themeText("#22C55E") }]}>
        Signed by {a.signed_name} on {longDate(a.signed_at)} at{" "}
        {new Date(a.signed_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
      </Text>
      <Text style={styles.text}>{a.agreement}</Text>
      <Text style={styles.sign}>Signed: {a.signed_name}</Text>
    </>
  );
}

const styles = themedStyles({
  status: { fontSize: 13, fontWeight: "700", marginBottom: 8 },
  helper: { color: "#94A3B8", fontSize: 13, marginBottom: 8 },
  label: { color: "#fff", fontWeight: "700", fontSize: 14, marginTop: 12, marginBottom: 6 },
  text: { color: "#CBD5E1", fontSize: 13, lineHeight: 19, backgroundColor: "#1E293B", borderRadius: 10, padding: 12 },
  sign: { color: "#fff", fontSize: 13, fontStyle: "italic", marginTop: 6 },
  link: { color: BRAND_GOLD, fontSize: 13, fontWeight: "700", paddingVertical: 6 },
});
