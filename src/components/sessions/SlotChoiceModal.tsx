import React, { useEffect, useState } from "react";
import { Modal, Text, View } from "react-native";
import Pressable from "@/components/Pressable";
import { ScrollView } from "@/components/ScrollView";
import SafeBottom from "@/components/SafeBottom";
import { BRAND_GOLD } from "@/lib/brand";
import { awayTag, clockLabel, dayLabel, isAway, outLabel } from "@/lib/liveSessions";
import { catchUpWhoKey, groupCatchUps } from "@/lib/catchUpGroups";
import type { LiveSession } from "@/types/database";
import { themedStyles } from "@/lib/theme";

// Tapping a green open slot (GRIZZ 2026-11-16: "if selecting a green open
// slot can we have an option to place a catch up client in there then
// allocate them from the bank"). Two buttons: a normal booking, or a catch-up
// from the list of catch-ups owed, one line per person with how many.
export default function SlotChoiceModal({
  slot,
  catchUps,
  name,
  onBook,
  onCatchUp,
  onOpen,
  onClose,
}: {
  /** The free time tapped, and the away people still showing there. */
  slot: { day: string; time: string; away: LiveSession[] } | null;
  catchUps: LiveSession[];
  name: (s: Pick<LiveSession, "client_id" | "guest_name">) => string;
  onBook: () => void;
  /** The catch-up picked (their oldest one owed). */
  onCatchUp: (s: LiveSession) => void;
  onOpen: (s: LiveSession) => void;
  onClose: () => void;
}) {
  const [picking, setPicking] = useState(false);
  useEffect(() => {
    if (slot) setPicking(false);
  }, [slot]);
  if (!slot) return null;
  const when = `${dayLabel(`${slot.day}T12:00:00`)} · ${slot.time}`;
  // Oldest first, so the first of each person's is the one booked.
  const groups = groupCatchUps([...catchUps].sort((a, b) => a.starts_at.localeCompare(b.starts_at)).map((s) => ({ s })));
  const short = (s: LiveSession) => `${dayLabel(s.starts_at)} ${clockLabel(s.starts_at)}`;
  return (
    <Modal visible animationType="slide" transparent onRequestClose={picking ? () => setPicking(false) : onClose}>
      <View style={styles.backdrop}>
        <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 12 }}>
          <Text style={styles.title}>{when}</Text>
          {slot.away.length ? (
            <Text style={styles.meta}>
              {slot.away.map((s) => `${name(s).split(" ")[0]}: ${isAway(s) ? awayTag(s) : outLabel(s)}`).join(" · ")}. The slot is free to book.
            </Text>
          ) : (
            <Text style={styles.meta}>This time is free.</Text>
          )}
          {!picking ? (
            <>
              <Pressable style={styles.button} onPress={onBook}>
                <Text style={styles.buttonText}>＋ Book a session</Text>
              </Pressable>
              <Pressable style={[styles.catchUp, !groups.length && { opacity: 0.5 }]} onPress={() => setPicking(true)} disabled={!groups.length}>
                <Text style={styles.catchUpText}>🔁 Put a catch-up client here</Text>
                <Text style={styles.catchUpSub}>
                  {groups.length ? `${catchUps.length} catch-up${catchUps.length === 1 ? "" : "s"} owed` : "No catch-ups owed right now"}
                </Text>
              </Pressable>
              {slot.away.map((s) => (
                <Pressable key={s.id} style={styles.outline} onPress={() => onOpen(s)}>
                  <Text style={styles.outlineText}>See {name(s).split(" ")[0]}'s session</Text>
                </Pressable>
              ))}
              <Pressable style={styles.outline} onPress={onClose}>
                <Text style={styles.outlineText}>Close</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.label}>Who gets the catch-up?</Text>
              {groups.map((g) => {
                const first = g[0].s;
                return (
                  <Pressable key={catchUpWhoKey(first)} style={styles.row} onPress={() => onCatchUp(first)}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text style={[styles.rowTitle, { flex: 1 }]}>{name(first)}</Text>
                      {g.length > 1 ? (
                        <View style={styles.count}>
                          <Text style={styles.countText}>{g.length} owed</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.rowBody}>For {short(first)}{g.length > 1 ? " (the oldest one)" : ""}</Text>
                  </Pressable>
                );
              })}
              <Text style={styles.meta}>Next you check the price, then book it.</Text>
              <Pressable style={styles.outline} onPress={() => setPicking(false)}>
                <Text style={styles.outlineText}>‹ Back</Text>
              </Pressable>
            </>
          )}
          <SafeBottom />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = themedStyles({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0F172A", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: "92%" },
  title: { color: "#fff", fontSize: 20, fontWeight: "800", marginBottom: 4 },
  meta: { color: "#94A3B8", fontSize: 14, marginTop: 2, marginBottom: 6, lineHeight: 20 },
  label: { color: BRAND_GOLD, fontSize: 14, fontWeight: "700", marginTop: 10, marginBottom: 8 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 12 },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
  catchUp: { backgroundColor: "#14532D", borderWidth: 2, borderColor: "#22C55E", borderRadius: 10, padding: 12, alignItems: "center", marginTop: 10 },
  catchUpText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  catchUpSub: { color: "#BBF7D0", fontSize: 13, marginTop: 2 },
  outline: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 10, padding: 12, alignItems: "center", marginTop: 10 },
  outlineText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 15 },
  row: { backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginBottom: 8, borderLeftWidth: 5, borderLeftColor: "#22C55E" },
  rowTitle: { color: "#fff", fontWeight: "700", fontSize: 16 },
  rowBody: { color: "#CBD5E1", fontSize: 13, marginTop: 3 },
  count: { backgroundColor: "#FACC15", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  countText: { color: "#0F172A", fontWeight: "800", fontSize: 12 },
});
