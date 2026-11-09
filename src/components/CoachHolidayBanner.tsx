import React from "react";
import { Text, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useCoachHolidays } from "@/hooks/useCoachHolidays";
import { holidaySpan, upcomingHolidays, type Holiday } from "@/lib/holidays";
import { todayIso } from "@/lib/dates";
import { themedStyles } from "@/lib/theme";

export const HOLIDAY_BLUE = "#38BDF8";

// "🌴 Your coach is away from Mon 14 Dec to Sun 20 Dec" on the client's app
// (GRIZZ, 2026-11-09: "so that clients don't forget"). Shows from the day the
// coach adds it until the last day away.
export default function CoachHolidayBanner({ holidays: given }: { holidays?: Holiday[] }) {
  const { client } = useAuth();
  const loaded = useCoachHolidays(given ? null : client?.trainer_id).holidays;
  const today = todayIso();
  const list = upcomingHolidays(given ?? loaded, today).slice(0, 2);
  if (!list.length) return null;
  return (
    <>
      {list.map((h) => (
        <View key={h.id} style={styles.card}>
          <Text style={styles.title}>🌴 Your coach is away {holidaySpan(h, today)}</Text>
          {h.reason ? <Text style={styles.text}>{h.reason}</Text> : null}
          {client?.one_on_one || client?.live_only ? (
            <Text style={styles.meta}>Your sessions in that time are cancelled free. Your coach will find you catch-up times.</Text>
          ) : null}
        </View>
      ))}
    </>
  );
}

const styles = themedStyles({
  card: { backgroundColor: "#1E293B", borderLeftWidth: 4, borderLeftColor: HOLIDAY_BLUE, borderRadius: 8, padding: 12, marginBottom: 14 },
  title: { color: "#fff", fontWeight: "800", fontSize: 15, marginBottom: 4 },
  text: { color: "#E2E8F0", fontSize: 14 },
  meta: { color: "#94A3B8", fontSize: 12, marginTop: 4, lineHeight: 17 },
});
