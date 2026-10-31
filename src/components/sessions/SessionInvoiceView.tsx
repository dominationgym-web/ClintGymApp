import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BRAND_GOLD } from "@/lib/brand";
import { KIND_STYLE, billingLabel, clockLabel, dayLabel, kindDetail, monthLabel, sessionMoney } from "@/lib/liveSessions";
import type { InvoiceLine, SessionInvoice } from "@/types/database";
import SessionProofModal from "@/components/sessions/SessionProofModal";
import { themeBg, themeText, themedStyles } from "@/lib/theme";

// One month's invoice as a diary (GRIZZ, 2026-10-31: "a diary log of each
// last minute cancellation in red. 24 hour notice cancellation in green").
// Every session in order with its colour; tap 📸 to see the proof.
export default function SessionInvoiceView({ invoice, who }: { invoice: SessionInvoice; who: "trainer" | "client" }) {
  const [proof, setProof] = useState<InvoiceLine | null>(null);
  const lines = [...invoice.lines].sort((a, b) => a.at.localeCompare(b.at));
  const status =
    invoice.status === "paid" ? "✅ Paid" : invoice.status === "sent" ? (who === "client" ? "Not paid yet" : "Sent · not paid yet") : "Draft · not sent yet";

  return (
    <View>
      <Text style={styles.title}>🧾 {monthLabel(invoice.month)}</Text>
      <Text style={styles.meta}>
        {billingLabel(invoice.billing)} · {status}
      </Text>
      {who === "trainer" && invoice.status === "draft" && (invoice.unconfirmed > 0 || invoice.undecided > 0) ? (
        <View style={styles.warn}>
          {invoice.unconfirmed > 0 ? (
            <Text style={styles.warnText}>
              {invoice.unconfirmed} past session{invoice.unconfirmed === 1 ? " isn't" : "s aren't"} marked yet, so {invoice.unconfirmed === 1 ? "it's" : "they're"} charged as done.
            </Text>
          ) : null}
          {invoice.undecided > 0 ? (
            <Text style={styles.warnText}>
              {invoice.undecided} cancellation{invoice.undecided === 1 ? " needs" : "s need"} charge or credit, so {invoice.undecided === 1 ? "it isn't" : "they aren't"} on yet.
            </Text>
          ) : null}
        </View>
      ) : null}

      {lines.length === 0 ? <Text style={styles.meta}>No sessions this month.</Text> : null}
      {lines.map((l) => {
        const style = KIND_STYLE[l.kind];
        const colour = themeText(style.colour);
        return (
          <View key={`${l.id}-${l.role}`} style={[styles.line, { borderLeftColor: themeBg(style.colour) }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.when}>
                {dayLabel(l.at)} · {clockLabel(l.at)}
              </Text>
              <Text style={[styles.kind, { color: colour }]}>
                {style.icon} {kindDetail(l.kind, l.notice_hours, { clientOk: l.client_ok, disputed: l.disputed, catchUp: l.catch_up, catchUpBooked: l.catch_up_booked })}
                {l.role === "credit" ? " · credit for an earlier invoice" : ""}
              </Text>
              {l.cancelled_at ? (
                <Text style={styles.small}>
                  Cancelled {dayLabel(l.cancelled_at)} at {clockLabel(l.cancelled_at)}
                  {l.by === "trainer" ? " by the coach" : ""}
                </Text>
              ) : null}
              {l.note ? <Text style={styles.small}>"{l.note}"</Text> : null}
              {l.proof ? (
                <Pressable onPress={() => setProof(l)} hitSlop={8}>
                  <Text style={styles.proof}>📸 See the message</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={[styles.amount, l.role === "diary" && styles.amountNone]}>
              {l.role === "diary" ? (l.kind === "booked" ? "" : "–") : sessionMoney(l.amount, invoice.currency)}
            </Text>
          </View>
        );
      })}

      <View style={styles.totals}>
        <Row label="Sessions" value={sessionMoney(invoice.charged, invoice.currency)} />
        {invoice.credited ? <Row label="Credits" value={`-${sessionMoney(invoice.credited, invoice.currency)}`} /> : null}
        <Row label="Total" value={sessionMoney(invoice.total, invoice.currency)} strong />
      </View>
      <Text style={styles.key}>🔴 late cancellation or no-show (charged) · 🟢 cancelled in time (credited) · 🔁 catch-up instead of credit · 🔵 cancelled by coach</Text>

      <SessionProofModal
        path={proof?.proof ?? null}
        caption={proof ? `${dayLabel(proof.at)} ${clockLabel(proof.at)} session` : undefined}
        onClose={() => setProof(null)}
      />
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, strong && styles.strong]}>{label}</Text>
      <Text style={[styles.totalValue, strong && styles.strong]}>{value}</Text>
    </View>
  );
}

const styles = themedStyles({
  title: { color: "#fff", fontSize: 20, fontWeight: "800" },
  meta: { color: "#94A3B8", fontSize: 13, marginTop: 4, marginBottom: 10 },
  warn: { backgroundColor: "#3B2F0B", borderRadius: 10, padding: 10, marginBottom: 10, gap: 4 },
  warnText: { color: "#FDE68A", fontSize: 13, lineHeight: 18 },
  line: { flexDirection: "row", gap: 10, backgroundColor: "#1E293B", borderRadius: 8, padding: 10, marginBottom: 6, borderLeftWidth: 4 },
  when: { color: "#fff", fontSize: 14, fontWeight: "700" },
  kind: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  small: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  proof: { color: BRAND_GOLD, fontSize: 13, fontWeight: "700", marginTop: 4 },
  amount: { color: "#fff", fontSize: 14, fontWeight: "700", minWidth: 64, textAlign: "right" },
  amountNone: { color: "#64748B" },
  totals: { borderTopWidth: 1, borderTopColor: "#334155", marginTop: 8, paddingTop: 8 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalLabel: { color: "#CBD5E1", fontSize: 14 },
  totalValue: { color: "#CBD5E1", fontSize: 14 },
  strong: { color: BRAND_GOLD, fontSize: 17, fontWeight: "800" },
  key: { color: "#64748B", fontSize: 12, marginTop: 10, lineHeight: 17 },
});
