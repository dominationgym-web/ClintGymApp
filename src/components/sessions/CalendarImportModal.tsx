import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ScrollView } from "@/components/ScrollView";
import { BRAND_GOLD } from "@/lib/brand";
import { dayLabel, dayKey } from "@/lib/liveSessions";
import {
  bookRows,
  canReadPhoneCalendar,
  eventsToSessions,
  readPhoneCalendar,
  readScreenshots,
  reviewRows,
  type ImportFile,
  type ImportRow,
  type ReadSession,
} from "@/lib/calendarImport";
import type { LiveSession } from "@/types/database";
import { themeText, themedStyles } from "@/lib/theme";

type Client = { id: string; name: string };

// Bring sessions in from the trainer's own calendar (GRIZZ, 2026-10-31): a
// screenshot of any calendar app, or the phone's calendar. The trainer
// checks the list (who and when), then books the ticked ones in one go.
export default function CalendarImportModal({
  visible,
  clients,
  sessions,
  onClose,
  onBooked,
}: {
  visible: boolean;
  // The trainer's clients set up for live sessions.
  clients: Client[];
  sessions: LiveSession[];
  onClose: () => void;
  onBooked: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setRows(null);
      setNote(null);
      setPicking(null);
    }
  }, [visible]);

  const today = dayKey(new Date());
  const name = (id: string | null) => clients.find((c) => c.id === id)?.name ?? null;
  const show = (read: ReadSession[], readNote: string | null) => {
    // Only clients set up for live sessions can be booked.
    const ok = new Set(clients.map((c) => c.id));
    const list = read.map((s) => (s.client_id && !ok.has(s.client_id) ? { ...s, client_id: null } : s));
    setRows(reviewRows(list, sessions.filter((s) => s.status !== "removed"), today));
    setNote(readNote);
  };

  const send = async (files: ImportFile[]) => {
    if (!files.length) return;
    setBusy("Reading your calendar… this can take a minute.");
    const res = await readScreenshots(files, today);
    setBusy(null);
    if ("error" in res) return Alert.alert("Couldn't read it", res.error);
    if (!res.sessions.length) return Alert.alert("No sessions found", res.note ?? "No client sessions could be read from these screenshots.");
    show(res.sessions, res.note);
  };

  const pickScreenshots = async () => {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.accept = "image/*";
      input.onchange = async () => {
        const picked = Array.from(input.files ?? []).slice(0, 6);
        const files = await Promise.all(
          picked.map(
            (f) =>
              new Promise<ImportFile>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve({ name: f.name, type: f.type || "image/png", data: String(reader.result).split(",")[1] ?? "" });
                reader.readAsDataURL(f);
              }),
          ),
        );
        send(files);
      };
      input.click();
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Permission needed", "Allow photo access to choose the screenshots.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 6, quality: 0.7, base64: true });
    if (result.canceled) return;
    send(result.assets.filter((a) => a.base64).map((a, i) => ({ name: a.fileName ?? `calendar-${i + 1}.jpg`, type: a.mimeType ?? "image/jpeg", data: a.base64! })));
  };

  const fromPhone = async () => {
    setBusy("Reading your phone's calendar…");
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getFullYear(), from.getMonth() + 3, 0, 23, 59);
    const events = await readPhoneCalendar(from, to);
    setBusy(null);
    if ("error" in events) return Alert.alert("Phone calendar", events.error);
    const found = eventsToSessions(events, clients);
    if (!found.length) return Alert.alert("No sessions found", "No events in the next 3 months have a client's name in them. Use a screenshot instead.");
    show(found, null);
  };

  const book = async () => {
    if (!rows) return;
    const ticked = rows.filter((r) => r.tick && r.client_id);
    if (!ticked.length) return;
    setBusy("Booking…");
    const res = await bookRows(rows);
    setBusy(null);
    if ("error" in res) return Alert.alert("Couldn't book them", res.error);
    Alert.alert("Booked ✅", `${res.added} session${res.added === 1 ? "" : "s"} added.${res.skipped ? ` ${res.skipped} were already in the app.` : ""} Each client gets one notification.`);
    onBooked();
  };

  const toggle = (key: string) => setRows((rs) => rs?.map((r) => (r.key === key && r.client_id ? { ...r, tick: !r.tick } : r)) ?? null);
  const setWho = (key: string, id: string) => {
    setRows((rs) => rs?.map((r) => (r.key === key ? { ...r, client_id: id, tick: r.date >= today, why: r.date < today ? "Before today" : null } : r)) ?? null);
    setPicking(null);
  };
  const ticked = rows?.filter((r) => r.tick && r.client_id).length ?? 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 28 }}>
          <Text style={styles.title}>📥 Bring in your sessions</Text>
          {busy ? (
            <View style={{ paddingVertical: 30, alignItems: "center", gap: 12 }}>
              <ActivityIndicator color={themeText(BRAND_GOLD)} />
              <Text style={styles.helper}>{busy}</Text>
            </View>
          ) : !rows ? (
            <>
              <Text style={styles.helper}>
                Take screenshots of your calendar (Google, Samsung, Apple or any app, week or list view works best). The app reads the names and times, and you check them before anything is booked.
              </Text>
              <Pressable style={styles.button} onPress={pickScreenshots}>
                <Text style={styles.buttonText}>📷 Pick screenshots (up to 6)</Text>
              </Pressable>
              {Platform.OS !== "web" ? (
                <>
                  <Pressable style={styles.outline} onPress={fromPhone}>
                    <Text style={styles.outlineText}>📅 Read my phone's calendar</Text>
                  </Pressable>
                  <Text style={styles.meta}>
                    {canReadPhoneCalendar()
                      ? "Looks at the next 3 months for events with a client's name in them."
                      : "Comes with the next app update from the store."}
                  </Text>
                </>
              ) : null}
              {clients.length === 0 ? <Text style={styles.warn}>Set up your clients on the Clients tab first, so sessions can be matched to them.</Text> : null}
            </>
          ) : (
            <>
              <Text style={styles.helper}>Tick the ones to book. Tap a name to change who it is.</Text>
              {note ? <Text style={styles.meta}>Note: {note}</Text> : null}
              {rows.map((r) => (
                <View key={r.key} style={[styles.row, r.tick && styles.rowOn]}>
                  <Pressable onPress={() => toggle(r.key)} hitSlop={8} style={[styles.box, r.tick && styles.boxOn]}>
                    <Text style={styles.tick}>{r.tick ? "✓" : ""}</Text>
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.when}>
                      {dayLabel(r.date)} · {r.time}
                      {r.minutes ? ` · ${r.minutes} min` : ""}
                    </Text>
                    <Pressable onPress={() => setPicking(picking === r.key ? null : r.key)} hitSlop={6}>
                      <Text style={[styles.who, !r.client_id && styles.whoMissing]}>
                        {name(r.client_id) ?? "Who is this?"} ›{r.seen_name && r.seen_name !== name(r.client_id) ? <Text style={styles.seen}>  "{r.seen_name}"</Text> : null}
                      </Text>
                    </Pressable>
                    {r.why ? <Text style={styles.meta}>{r.why}</Text> : null}
                    {picking === r.key ? (
                      <View style={styles.chips}>
                        {clients.map((c) => (
                          <Pressable key={c.id} style={[styles.chip, r.client_id === c.id && styles.chipOn]} onPress={() => setWho(r.key, c.id)}>
                            <Text style={[styles.chipText, r.client_id === c.id && styles.chipTextOn]}>{c.name}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
              <Pressable style={[styles.button, !ticked && { opacity: 0.5 }]} onPress={book} disabled={!ticked}>
                <Text style={styles.buttonText}>
                  Book {ticked} session{ticked === 1 ? "" : "s"}
                </Text>
              </Pressable>
              <Pressable style={styles.outline} onPress={() => setRows(null)}>
                <Text style={styles.outlineText}>Start again</Text>
              </Pressable>
            </>
          )}
          <Pressable style={styles.closeRow} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = themedStyles({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0F172A", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: "92%" },
  title: { color: "#fff", fontSize: 19, fontWeight: "800", marginBottom: 6 },
  helper: { color: "#94A3B8", fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 6 },
  meta: { color: "#64748B", fontSize: 12, marginTop: 4, lineHeight: 17 },
  warn: { color: "#F59E0B", fontSize: 13, marginTop: 12, lineHeight: 18 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 16 },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
  outline: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 10, padding: 11, alignItems: "center", marginTop: 8 },
  outlineText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14 },
  row: { flexDirection: "row", gap: 12, backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginTop: 8, borderLeftWidth: 4, borderLeftColor: "#334155" },
  rowOn: { borderLeftColor: BRAND_GOLD },
  box: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: BRAND_GOLD, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: BRAND_GOLD },
  tick: { color: "#0F172A", fontWeight: "900", fontSize: 15 },
  when: { color: "#fff", fontSize: 15, fontWeight: "700" },
  who: { color: BRAND_GOLD, fontSize: 14, fontWeight: "700", marginTop: 3 },
  whoMissing: { color: "#F59E0B" },
  seen: { color: "#64748B", fontWeight: "400" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: { backgroundColor: "#0F172A", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "#334155" },
  chipOn: { backgroundColor: BRAND_GOLD, borderColor: BRAND_GOLD },
  chipText: { color: "#CBD5E1", fontWeight: "600", fontSize: 13 },
  chipTextOn: { color: "#0F172A" },
  closeRow: { padding: 12, alignItems: "center", marginTop: 8 },
  closeText: { color: "#94A3B8", fontWeight: "700", fontSize: 15 },
});
