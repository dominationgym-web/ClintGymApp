import { BRAND_GOLD } from "@/lib/brand";
import { themedStyles } from "@/lib/theme";

// The look of Understanding Insulin (gold hook box, emoji steps, side-by-side
// tiles, right/wrong boxes, a closing line), shared by every menu breakdown
// so they all read at a glance (GRIZZ, 2026-10-14).
export const breakdownStyles = themedStyles({
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, marginBottom: 12 },
  title: { color: BRAND_GOLD, fontSize: 26, fontWeight: "800" },
  subtitle: { color: "#94A3B8", fontSize: 14, marginTop: 2, marginBottom: 14 },
  hook: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, marginBottom: 12 },
  hookText: { color: "#0F172A", fontSize: 19, fontWeight: "800", lineHeight: 25 },
  body: { color: "#E2E8F0", fontSize: 15, lineHeight: 22, marginBottom: 8 },
  small: { color: "#CBD5E1", fontSize: 13, lineHeight: 19 },
  sectionLabel: { color: BRAND_GOLD, fontSize: 12, fontWeight: "800", letterSpacing: 1.2, marginTop: 16, marginBottom: 8 },
  step: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#0F172A", borderRadius: 10, padding: 12 },
  stepIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#334155", alignItems: "center", justifyContent: "center" },
  stepEmoji: { fontSize: 22 },
  stepTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 2 },
  arrow: { color: BRAND_GOLD, fontSize: 18, fontWeight: "800", textAlign: "center", marginVertical: 2 },
  callout: { borderLeftWidth: 4, borderLeftColor: "#F97316", backgroundColor: "#2A1F14", borderRadius: 8, padding: 12, marginTop: 16 },
  calloutTitle: { color: "#FDBA74", fontSize: 17, fontWeight: "800", marginBottom: 6 },
  pair: { flexDirection: "row", gap: 10 },
  tile: { flex: 1, backgroundColor: "#0F172A", borderRadius: 10, padding: 12 },
  tileEmoji: { fontSize: 26, marginBottom: 6 },
  tileTitle: { color: "#fff", fontSize: 14, fontWeight: "700", marginBottom: 4 },
  orderBox: { borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1 },
  wrong: { backgroundColor: "#2A1416", borderColor: "#7F1D1D" },
  right: { backgroundColor: "#13261B", borderColor: "#166534" },
  orderLabel: { fontSize: 15, fontWeight: "800", marginBottom: 4 },
  note: { color: "#94A3B8", fontSize: 13, fontStyle: "italic", marginBottom: 4 },
  goals: { flexDirection: "row", gap: 8, marginBottom: 10 },
  goal: { flex: 1, alignItems: "center", backgroundColor: "#0F172A", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 6 },
  goalEmoji: { fontSize: 24, marginBottom: 4 },
  goalText: { color: "#fff", fontSize: 12, fontWeight: "700", textAlign: "center" },
  closing: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: BRAND_GOLD, paddingVertical: 14, marginTop: 8 },
  closingText: { color: "#fff", fontSize: 18, fontWeight: "800", textAlign: "center", lineHeight: 25 },
});
