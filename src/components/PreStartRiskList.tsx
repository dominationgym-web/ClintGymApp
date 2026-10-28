import React from "react";
import { Text, View } from "react-native";
import type { PreStartOutcome, PreStartRisk } from "@/lib/preStart";
import { themeBorder, themeText, themedStyles } from "@/lib/theme";

const COLOURS = { green: "#22C55E", amber: "#F59E0B", red: "#EF4444" };

// The app's read of a pre-start form: the overall sign, which program fits,
// and each risk in red or amber.
export default function PreStartRiskList({ outcome, risks, limit }: { outcome: PreStartOutcome; risks: PreStartRisk[]; limit?: number }) {
  const shown = limit ? risks.slice(0, limit) : risks;
  return (
    <View>
      <View style={[styles.sign, { borderColor: themeBorder(COLOURS[outcome.level]) }]}>
        <Text style={[styles.headline, { color: themeText(COLOURS[outcome.level]) }]}>
          {outcome.level === "green" ? "✅" : outcome.level === "amber" ? "⚠️" : "⛔"} {outcome.headline}
        </Text>
        <Text style={styles.program}>Suggested start: {outcome.program}</Text>
      </View>
      {shown.map((r, i) => (
        <View key={i} style={[styles.risk, { borderLeftColor: themeBorder(COLOURS[r.level]) }]}>
          <Text style={[styles.title, { color: themeText(COLOURS[r.level]) }]}>{r.title}</Text>
          <Text style={styles.detail}>{r.detail}</Text>
        </View>
      ))}
      {limit && risks.length > limit ? <Text style={styles.more}>and {risks.length - limit} more</Text> : null}
      <Text style={styles.small}>A screening prompt, not a clinical assessment. Use your own judgement and refer when unsure.</Text>
    </View>
  );
}

const styles = themedStyles({
  sign: { borderWidth: 2, borderRadius: 12, padding: 12, marginTop: 8 },
  headline: { fontWeight: "800", fontSize: 15 },
  program: { color: "#CBD5E1", fontSize: 13, marginTop: 6 },
  risk: { backgroundColor: "#1E293B", borderLeftWidth: 4, borderRadius: 8, padding: 10, marginTop: 8 },
  title: { fontWeight: "800", fontSize: 14 },
  detail: { color: "#CBD5E1", fontSize: 13, marginTop: 2 },
  more: { color: "#94A3B8", fontSize: 13, marginTop: 6 },
  small: { color: "#64748B", fontSize: 12, marginTop: 10 },
});
