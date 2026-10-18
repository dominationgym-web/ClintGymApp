import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { parseIsoDate } from "@/lib/dates";
import { WEEKDAY_NAMES } from "@/lib/programs";
import { levelInfo } from "@/lib/stability";
import {
  addStabilityDays,
  removeStabilityDay,
  sameWeekdayUntil,
  STABILITY_PURPLE,
  stabilityEndDate,
  stabilityShortName,
  type StabilityCalendarItem,
} from "@/lib/stabilityCalendar";
import type { ClientStabilityDay, ClientStabilityProgram } from "@/types/database";

function shortDate(iso: string): string {
  const d = parseIsoDate(iso);
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

// Under a calendar day on the trainer's client view (0110, GRIZZ,
// 2026-10-18): put the client's running stability programs on this day, or
// on this weekday every week until the program ends, or take them off.
export default function StabilityDayPlanner({
  date,
  clientId,
  programs,
  days,
  items,
  onChanged,
}: {
  date: string;
  clientId: string;
  programs: ClientStabilityProgram[];
  days: ClientStabilityDay[];
  /** What the calendar shows on this day, to mark logged sessions. */
  items: StabilityCalendarItem[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  // Running programs, and any finished one that was on this day.
  const shown = programs.filter((p) => !p.ended_at || items.some((i) => i.programId === p.id));
  const weekday = WEEKDAY_NAMES[(parseIsoDate(date).getDay() + 6) % 7];

  const run = async (work: () => Promise<string | null>) => {
    setBusy(true);
    const error = await work();
    setBusy(false);
    if (error) Alert.alert("Couldn't change the calendar", error);
    else onChanged();
  };

  if (shown.length === 0) {
    return <Text style={styles.none}>🧘 No stability program running. Start one in the Stability card to put it on days.</Text>;
  }

  return (
    <View>
      {shown.map((p) => {
        const planned = days.find((d) => d.stability_program_id === p.id && d.day === date);
        const logged = items.some((i) => i.programId === p.id && i.done);
        const end = stabilityEndDate(p);
        const running = !p.ended_at;
        return (
          <View key={p.id} style={styles.box}>
            <Text style={styles.name}>
              🧘 {stabilityShortName(p)} stability · {levelInfo(p.level).label}
            </Text>
            {logged && <Text style={styles.done}>✓ Logged on this day</Text>}
            {planned ? (
              <>
                <Text style={styles.on}>On this day</Text>
                {running && (
                  <Pressable style={styles.off} onPress={() => run(() => removeStabilityDay(planned.id))} disabled={busy}>
                    <Text style={styles.offText}>Take it off</Text>
                  </Pressable>
                )}
              </>
            ) : (
              running && (
                <View style={styles.buttons}>
                  <Pressable style={styles.add} onPress={() => run(() => addStabilityDays(clientId, p.id, [date]))} disabled={busy}>
                    <Text style={styles.addText}>＋ Put it on this day</Text>
                  </Pressable>
                  {date < end && (
                    <Pressable
                      style={styles.add}
                      onPress={() => run(() => addStabilityDays(clientId, p.id, sameWeekdayUntil(date, end)))}
                      disabled={busy}
                    >
                      <Text style={styles.addText}>
                        ＋ Every {weekday} until it ends ({shortDate(end)})
                      </Text>
                    </Pressable>
                  )}
                </View>
              )
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  none: { color: "#94A3B8", fontSize: 12, marginTop: 12 },
  box: { borderWidth: 1, borderColor: "#6B21A8", backgroundColor: "#1A1029", borderRadius: 10, padding: 10, marginTop: 12 },
  name: { color: STABILITY_PURPLE, fontWeight: "800", fontSize: 15 },
  done: { color: "#22C55E", fontWeight: "700", fontSize: 13, marginTop: 4 },
  on: { color: "#E9D5FF", fontWeight: "700", fontSize: 13, marginTop: 4 },
  buttons: { gap: 6, marginTop: 8 },
  add: { borderWidth: 1, borderColor: STABILITY_PURPLE, borderRadius: 8, paddingVertical: 9, alignItems: "center" },
  addText: { color: STABILITY_PURPLE, fontWeight: "800" },
  off: { borderWidth: 1, borderColor: "#EF4444", borderRadius: 8, paddingVertical: 8, alignItems: "center", marginTop: 8 },
  offText: { color: "#EF4444", fontWeight: "700" },
});
