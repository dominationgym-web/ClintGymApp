import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import TextInput from "@/components/TextInput";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { todayIso } from "@/lib/dates";
import { BRAND_GOLD } from "@/lib/brand";
import { importSample, importSummary, addedSummary, unitsLine } from "@/lib/historyImport";
import { addBulk, bulkSummary, chosenClient, dismissBulk, sendBulk, type BulkImport } from "@/lib/bulkImport";
import { pickScreenshots, pickWebFiles } from "@/lib/pickImportFiles";
import type { ImportFile } from "@/lib/historyImport";
import { themeText, themedStyles } from "@/lib/theme";
import { useStepBack } from "@/hooks/useStepBack";

// One file with all of a trainer's clients (0190, GRIZZ 2026-11-03: "it'll
// save a lot of admin for the trainers"). The trainer sends the whole export;
// the app splits it by name and matches each name to a client. The trainer
// checks the names, picks a client for any it couldn't match, and adds them
// all with one tap. People not in the app yet wait here to be linked later.
export default function BulkImportScreen() {
  const { trainer } = useAuth();
  const [imports, setImports] = useState<BulkImport[] | null>(null);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // Per import: person number → the client the trainer picked (null = not now).
  const [picks, setPicks] = useState<Record<string, Record<number, string | null>>>({});
  // The person whose details or client picker is open ("importId:index").
  const [open, setOpen] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  useStepBack(open !== null || picking !== null, () => {
    setOpen(null);
    setPicking(null);
  });

  const load = useCallback(async () => {
    if (!trainer) return;
    const [{ data }, { data: cl }] = await Promise.all([
      supabase
        .from("trainer_bulk_imports")
        .select("*")
        .eq("trainer_id", trainer.id)
        .neq("status", "dismissed")
        .order("created_at", { ascending: false })
        .limit(3),
      supabase.from("clients").select("id, name").eq("trainer_id", trainer.id).order("name"),
    ]);
    setImports((data as BulkImport[] | null) ?? []);
    setClients(cl ?? []);
  }, [trainer]);

  useEffect(() => {
    load();
  }, [load]);

  // While a file is being read, look again every few seconds.
  const reading = imports?.some((b) => b.status === "reading");
  useEffect(() => {
    if (!reading) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [reading, load]);

  const send = async (files: ImportFile[]) => {
    if (!files.length) return;
    setSending(true);
    const error = await sendBulk(todayIso(), files);
    setSending(false);
    if (error) Alert.alert("Couldn't send it", error);
    load();
  };

  const add = async (b: BulkImport) => {
    setBusy(b.id);
    const res = await addBulk(b.id, picks[b.id] ?? {});
    setBusy(null);
    if (res.error) Alert.alert("Couldn't add it", res.error);
    else
      Alert.alert(
        "Added",
        `History added for ${res.added ?? 0} ${res.added === 1 ? "client" : "clients"}.${res.waiting ? ` ${res.waiting} still to link: pick their client when they've joined.` : ""}`,
      );
    setPicks((p) => ({ ...p, [b.id]: {} }));
    load();
  };

  const confirmAdd = (b: BulkImport, count: number) =>
    Alert.alert(
      `Add history for ${count} ${count === 1 ? "client" : "clients"}?`,
      "Dated workouts go into each client's training log and progress. Ones with no date go under Before the app. Anything already in the app is left out.",
      [
        { text: "Not yet", style: "cancel" },
        { text: "Add", onPress: () => add(b) },
      ],
    );

  const remove = (b: BulkImport) =>
    Alert.alert("Remove this file?", "History already added to clients stays. People not added yet are let go.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const error = await dismissBulk(b.id);
          if (error) Alert.alert("Couldn't remove it", error);
          load();
        },
      },
    ]);

  const pick = (b: BulkImport, i: number, clientId: string | null) => {
    setPicks((p) => ({ ...p, [b.id]: { ...(p[b.id] ?? {}), [i]: clientId } }));
    setPicking(null);
    setSearch("");
  };

  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? null;
  const shown = clients.filter((c) => !search.trim() || c.name.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 12);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.helper}>
        Got one file with all your clients' training from your old app or spreadsheet? Send it here. The app splits it by name and matches
        each name to your client. You check it, then add everyone in one go.
      </Text>
      <View style={styles.buttons}>
        {Platform.OS === "web" && (
          <Pressable style={[styles.addButton, sending && styles.disabled]} onPress={() => pickWebFiles(send)} disabled={sending}>
            <Text style={styles.addText}>Send the file (CSV, PDF)</Text>
          </Pressable>
        )}
        <Pressable style={[styles.button, sending && styles.disabled]} onPress={async () => send(await pickScreenshots())} disabled={sending}>
          <Text style={styles.buttonText}>Screenshots</Text>
        </Pressable>
      </View>
      <Text style={styles.small}>
        {Platform.OS === "web" ? "Excel? Save it as CSV first (File › Save As › CSV). " : "Got a CSV or PDF file? Send it from the laptop app. "}
        Each row needs the client's name. Numbers with no kg or lb are read as {trainer?.units === "imperial" ? "pounds" : "kg"} (Settings › Metric or Imperial).
      </Text>
      {sending && <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginTop: 10 }} />}
      {imports === null && <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginTop: 20 }} />}

      {imports?.map((b) => {
        const mine = picks[b.id] ?? {};
        const toAdd = b.people.filter((p, i) => !p.added_import_id && chosenClient(p, i, mine)).length;
        return (
          <View key={b.id} style={styles.card}>
            <Text style={styles.cardTitle}>
              {b.file_names.length === 1 ? b.file_names[0] : `${b.file_names.length} files`} · {b.created_at.slice(0, 10)}
            </Text>
            {b.status === "reading" && <Text style={styles.text}>⏳ Reading… a big file can take a few minutes. You can leave this page.</Text>}
            {b.status === "failed" && <Text style={styles.warn}>{b.error ?? "Couldn't read this."}</Text>}
            {b.status === "ready" && (
              <>
                <Text style={styles.text}>{bulkSummary(b, mine)}</Text>
                {b.note ? <Text style={styles.small}>{b.note}</Text> : null}
                {b.people.map((p, i) => {
                  const key = `${b.id}:${i}`;
                  const chosen = chosenClient(p, i, mine);
                  const units = unitsLine(p.result);
                  return (
                    <View key={key} style={styles.person}>
                      <Pressable onPress={() => setOpen((k) => (k === key ? null : key))} accessibilityRole="button">
                        <Text style={styles.personName}>
                          {open === key ? "▾" : "▸"} {p.name}
                        </Text>
                      </Pressable>
                      {p.added_import_id ? (
                        <Text style={styles.done}>
                          ✓ {clientName(p.client_id) ?? "Added"}: {p.added_counts ? addedSummary(p.added_counts) : "added."}
                        </Text>
                      ) : (
                        <Pressable onPress={() => setPicking((k) => (k === key ? null : key))} accessibilityRole="button">
                          <Text style={chosen ? styles.match : styles.warn}>
                            {chosen ? `→ ${clientName(chosen) ?? "Client"} (change)` : "⚠ Not linked to a client yet. Tap to pick one."}
                          </Text>
                        </Pressable>
                      )}
                      {open === key && (
                        <>
                          <Text style={styles.small}>Found {importSummary(p.result)}.</Text>
                          {importSample(p.result).map((l) => (
                            <Text key={l} style={styles.sample}>
                              {l}
                            </Text>
                          ))}
                          {units ? <Text style={styles.small}>{units}</Text> : null}
                        </>
                      )}
                      {picking === key && (
                        <View style={styles.picker}>
                          <TextInput
                            style={styles.input}
                            placeholder="Search your clients"
                            placeholderTextColor="#64748B"
                            value={search}
                            onChangeText={setSearch}
                          />
                          {shown.map((c) => (
                            <Pressable key={c.id} style={styles.pickRow} onPress={() => pick(b, i, c.id)}>
                              <Text style={[styles.pickText, c.id === chosen && styles.match]}>{c.name}</Text>
                            </Pressable>
                          ))}
                          {!shown.length && <Text style={styles.small}>No client by that name. If they haven't joined yet, leave it and link them later.</Text>}
                          <Pressable style={styles.pickRow} onPress={() => pick(b, i, null)}>
                            <Text style={styles.small}>Not now (leave them for later)</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            )}
            <View style={styles.buttons}>
              {b.status === "ready" && toAdd > 0 && (
                <Pressable style={[styles.addButton, busy === b.id && styles.disabled]} onPress={() => confirmAdd(b, toAdd)} disabled={busy === b.id}>
                  {busy === b.id ? (
                    <ActivityIndicator color={themeText("#0B1426")} />
                  ) : (
                    <Text style={styles.addText}>
                      Add history for {toAdd} {toAdd === 1 ? "client" : "clients"}
                    </Text>
                  )}
                </Pressable>
              )}
              {b.status !== "reading" && (
                <Pressable style={styles.button} onPress={() => remove(b)}>
                  <Text style={styles.buttonText}>Remove</Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = themedStyles({
  container: { padding: 20, paddingBottom: 40, backgroundColor: "#0F172A", flexGrow: 1 },
  helper: { color: "#CBD5E1", fontSize: 14, lineHeight: 20 },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  button: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  buttonText: { color: BRAND_GOLD, fontWeight: "700" },
  addButton: { backgroundColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  addText: { color: "#0B1426", fontWeight: "800" },
  disabled: { opacity: 0.5 },
  small: { color: "#64748B", fontSize: 12, marginTop: 6 },
  card: { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, marginTop: 16 },
  cardTitle: { color: "#fff", fontWeight: "700" },
  text: { color: "#CBD5E1", marginTop: 4 },
  warn: { color: "#F59E0B", marginTop: 4 },
  done: { color: "#22C55E", marginTop: 4 },
  match: { color: "#22C55E", marginTop: 4, fontWeight: "600" },
  person: { borderTopWidth: 1, borderTopColor: "#334155", marginTop: 10, paddingTop: 8 },
  personName: { color: "#fff", fontWeight: "700", fontSize: 15 },
  sample: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  picker: { backgroundColor: "#0F172A", borderRadius: 10, padding: 10, marginTop: 8 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 8, padding: 10, marginBottom: 6 },
  pickRow: { paddingVertical: 8 },
  pickText: { color: "#E2E8F0", fontSize: 15 },
});
