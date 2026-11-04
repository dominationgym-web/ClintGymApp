import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from "react-native";
import { pickScreenshots, pickWebFiles } from "@/lib/pickImportFiles";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { BRAND_GOLD } from "@/lib/brand";
import {
  addImport,
  addedSummary,
  dismissImport,
  groupUndated,
  importSample,
  importSummary,
  sendForReading,
  setsLine,
  unitsLine,
  type ClientImport,
  type ImportFile,
  type UndatedSet,
} from "@/lib/historyImport";
import { useAuth } from "@/context/AuthContext";
import { themeText, themedStyles } from "@/lib/theme";

// Bring a client's history in from another app (0142, GRIZZ 2026-10-22). The
// client (Profile) or their trainer (Training tab) sends screenshots, or on the
// laptop any CSV or PDF export too. Claude reads them; the trainer checks what
// it found and taps "Add to Daily Evolution".
export default function HistoryImportCard({ clientId, role }: { clientId: string; role: "client" | "trainer" }) {
  const [rows, setRows] = useState<ClientImport[] | null>(null);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const { trainer } = useAuth();
  // Workouts that came in with no date (0189), shown as "Before the app".
  const [undated, setUndated] = useState<UndatedSet[]>([]);
  const [showUndated, setShowUndated] = useState(false);
  const [openSession, setOpenSession] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data }, { data: before }] = await Promise.all([
      supabase
        .from("client_imports")
        .select("*")
        .eq("client_id", clientId)
        .neq("status", "dismissed")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("client_undated_sets").select("*").eq("client_id", clientId).order("created_at").limit(1000),
    ]);
    setRows((data as ClientImport[] | null) ?? []);
    setUndated((before as UndatedSet[] | null) ?? []);
  }, [clientId]);
  const sessions = groupUndated(undated);

  useEffect(() => {
    load();
  }, [load]);

  // While Claude is reading, look again every few seconds.
  const reading = rows?.some((r) => r.status === "reading");
  useEffect(() => {
    if (!reading) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [reading, load]);

  const send = async (files: ImportFile[]) => {
    if (!files.length) return;
    setSending(true);
    const error = await sendForReading(clientId, todayIso(), files);
    setSending(false);
    if (error) Alert.alert("Couldn't send it", error);
    load();
  };

  const pickShots = async () => send(await pickScreenshots());
  const pickFiles = () => pickWebFiles(send);

  const act = async (row: ClientImport, action: "add" | "dismiss") => {
    setBusy(row.id);
    const error = await (action === "add" ? addImport(row.id) : dismissImport(row.id));
    setBusy(null);
    if (error) Alert.alert(action === "add" ? "Couldn't add it" : "Couldn't remove it", error);
    load();
  };

  const confirmAdd = (row: ClientImport) =>
    Alert.alert(
      "Add this history?",
      "Dated workouts go into their training log and progress. Ones with no date go under Before the app, and their weights are used as a starting point. Anything already in the app is left out.",
      [
      { text: "Not yet", style: "cancel" },
        { text: "Add", onPress: () => act(row, "add") },
      ],
    );

  return (
    <View>
      <Text style={styles.helper}>
        {role === "client"
          ? "Coming from another app? Send screenshots of your workouts and weigh-ins, or the file the app lets you export. The app reads them and your coach adds them to your history."
          : "Send screenshots or the export file from their old app. The app reads it, you check what it found, then add it to their history."}
      </Text>
      <View style={styles.buttons}>
        <Pressable style={[styles.button, sending && styles.disabled]} onPress={pickShots} disabled={sending}>
          <Text style={styles.buttonText}>Screenshots</Text>
        </Pressable>
        {Platform.OS === "web" && (
          <Pressable style={[styles.button, sending && styles.disabled]} onPress={pickFiles} disabled={sending}>
            <Text style={styles.buttonText}>A file (CSV, PDF)</Text>
          </Pressable>
        )}
      </View>
      {Platform.OS !== "web" && <Text style={styles.small}>Got a CSV or PDF file? Send it from the laptop app.</Text>}
      {role === "trainer" && (
        <Text style={styles.small}>
          Numbers with no kg or lb are read as {trainer?.units === "imperial" ? "pounds" : "kg"}. Change it in Settings › Metric or Imperial.
        </Text>
      )}
      {sending && <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginTop: 10 }} />}

      {sessions.length > 0 && (
        <View style={styles.row}>
          <Pressable onPress={() => setShowUndated((v) => !v)} accessibilityRole="button">
            <Text style={styles.rowTitle}>
              {showUndated ? "▾" : "▸"} 📜 Before the app · {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
            </Text>
          </Pressable>
          {showUndated && (
            <>
              <Text style={styles.small}>
                Brought in with no dates, oldest first. Dates start once {role === "client" ? "you train" : "they train"} in the app. Until then these weights are the starting point.
              </Text>
              {sessions.map((s) => (
                <View key={s.key}>
                  <Pressable onPress={() => setOpenSession((k) => (k === s.key ? null : s.key))} accessibilityRole="button">
                    <Text style={styles.session}>
                      {openSession === s.key ? "▾" : "▸"} {s.label} · {s.exercises.length} {s.exercises.length === 1 ? "exercise" : "exercises"}
                    </Text>
                  </Pressable>
                  {openSession === s.key &&
                    s.exercises.map((e) => (
                      <Text key={e.name} style={styles.sample}>
                        {e.name}: {setsLine(e.sets)}
                      </Text>
                    ))}
                </View>
              ))}
            </>
          )}
        </View>
      )}

      {rows?.map((row) => (
        <View key={row.id} style={styles.row}>
          <Text style={styles.rowTitle}>
            {row.result?.app_name ? `From ${row.result.app_name}` : `${row.file_names.length} file${row.file_names.length === 1 ? "" : "s"}`}
            {" · "}
            {row.created_at.slice(0, 10)}
          </Text>
          {row.status === "reading" && <Text style={styles.text}>⏳ Reading… this can take a minute.</Text>}
          {row.status === "failed" && <Text style={styles.warn}>{row.error ?? "Couldn't read these."}</Text>}
          {row.status === "ready" && row.result && (
            <>
              <Text style={styles.text}>Found {importSummary(row.result)}.</Text>
              {role === "trainer" && importSample(row.result).map((l) => <Text key={l} style={styles.sample}>{l}</Text>)}
              {role === "trainer" && unitsLine(row.result) ? <Text style={styles.small}>{unitsLine(row.result)}</Text> : null}
              {row.result.note ? <Text style={styles.small}>{row.result.note}</Text> : null}
              {role === "client" && <Text style={styles.small}>Sent to your coach to check and add.</Text>}
            </>
          )}
          {row.status === "added" && <Text style={styles.done}>✓ {row.added_counts ? addedSummary(row.added_counts) : "Added."}</Text>}
          {role === "trainer" && (row.status === "ready" || row.status === "failed") && (
            <View style={styles.buttons}>
              {row.status === "ready" && (
                <Pressable style={[styles.addButton, busy === row.id && styles.disabled]} onPress={() => confirmAdd(row)} disabled={busy === row.id}>
                  <Text style={styles.addText}>Add to Daily Evolution</Text>
                </Pressable>
              )}
              <Pressable style={[styles.button, busy === row.id && styles.disabled]} onPress={() => act(row, "dismiss")} disabled={busy === row.id}>
                <Text style={styles.buttonText}>{row.status === "ready" ? "Not this" : "Remove"}</Text>
              </Pressable>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = themedStyles({
  helper: { color: "#94A3B8", fontSize: 13, lineHeight: 18 },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  button: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  buttonText: { color: BRAND_GOLD, fontWeight: "700" },
  addButton: { backgroundColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  addText: { color: "#0B1426", fontWeight: "800" },
  disabled: { opacity: 0.5 },
  small: { color: "#64748B", fontSize: 12, marginTop: 6 },
  row: { borderTopWidth: 1, borderTopColor: "#1E293B", marginTop: 12, paddingTop: 10 },
  rowTitle: { color: "#fff", fontWeight: "700" },
  text: { color: "#CBD5E1", marginTop: 4 },
  sample: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  session: { color: "#CBD5E1", fontWeight: "600", marginTop: 8 },
  warn: { color: "#F59E0B", marginTop: 4 },
  done: { color: "#22C55E", marginTop: 4 },
});
