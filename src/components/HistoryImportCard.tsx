import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { todayIso } from "@/lib/dates";
import { BRAND_GOLD } from "@/lib/brand";
import {
  addImport,
  addedSummary,
  dismissImport,
  importSample,
  importSummary,
  sendForReading,
  type ClientImport,
  type ImportFile,
} from "@/lib/historyImport";
import { themeText, themedStyles } from "@/lib/theme";

// Bring a client's history in from another app (0142, GRIZZ 2026-10-22). The
// client (Profile) or their trainer (Training tab) sends screenshots, or on the
// laptop any CSV or PDF export too. Claude reads them; the trainer checks what
// it found and taps "Add to Daily Evolution".
export default function HistoryImportCard({ clientId, role }: { clientId: string; role: "client" | "trainer" }) {
  const [rows, setRows] = useState<ClientImport[] | null>(null);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("client_imports")
      .select("*")
      .eq("client_id", clientId)
      .neq("status", "dismissed")
      .order("created_at", { ascending: false })
      .limit(5);
    setRows((data as ClientImport[] | null) ?? []);
  }, [clientId]);

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

  const pickScreenshots = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access to choose the screenshots.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.6,
      base64: true,
    });
    if (result.canceled) return;
    send(
      result.assets
        .filter((a) => a.base64)
        .map((a, i) => ({ name: a.fileName ?? `screenshot-${i + 1}.jpg`, type: a.mimeType ?? "image/jpeg", data: a.base64! })),
    );
  };

  // The laptop app can take any export file: CSV, PDF or pictures.
  const pickFiles = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".csv,.tsv,.txt,.json,.pdf,image/*";
    input.onchange = async () => {
      const picked = Array.from(input.files ?? []).slice(0, 10);
      const files = await Promise.all(
        picked.map(
          (f) =>
            new Promise<ImportFile>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve({ name: f.name, type: f.type, data: String(reader.result).split(",")[1] ?? "" });
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(f);
            }),
        ),
      );
      send(files.filter((f) => f.data));
    };
    input.click();
  };

  const act = async (row: ClientImport, action: "add" | "dismiss") => {
    setBusy(row.id);
    const error = await (action === "add" ? addImport(row.id) : dismissImport(row.id));
    setBusy(null);
    if (error) Alert.alert(action === "add" ? "Couldn't add it" : "Couldn't remove it", error);
    load();
  };

  const confirmAdd = (row: ClientImport) =>
    Alert.alert("Add this history?", "It goes into their training log and progress. Days already in the app are left out.", [
      { text: "Not yet", style: "cancel" },
      { text: "Add", onPress: () => act(row, "add") },
    ]);

  return (
    <View>
      <Text style={styles.helper}>
        {role === "client"
          ? "Coming from another app? Send screenshots of your workouts and weigh-ins, or the file the app lets you export. The app reads them and your coach adds them to your history."
          : "Send screenshots or the export file from their old app. The app reads it, you check what it found, then add it to their history."}
      </Text>
      <View style={styles.buttons}>
        <Pressable style={[styles.button, sending && styles.disabled]} onPress={pickScreenshots} disabled={sending}>
          <Text style={styles.buttonText}>📸 Screenshots</Text>
        </Pressable>
        {Platform.OS === "web" && (
          <Pressable style={[styles.button, sending && styles.disabled]} onPress={pickFiles} disabled={sending}>
            <Text style={styles.buttonText}>📄 A file (CSV, PDF)</Text>
          </Pressable>
        )}
      </View>
      {Platform.OS !== "web" && <Text style={styles.small}>Got a CSV or PDF file? Send it from the laptop app.</Text>}
      {sending && <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginTop: 10 }} />}

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
  warn: { color: "#F59E0B", marginTop: 4 },
  done: { color: "#22C55E", marginTop: 4 },
});
