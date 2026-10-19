import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import TextInput from "@/components/TextInput";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { shrinkPhoto } from "@/lib/shrinkPhoto";
import { filterExercises } from "@/lib/exerciseFilter";
import {
  EQUIPMENT_KINDS,
  equipmentKind,
  equipmentSummary,
  newEquipmentId,
  type EquipmentItem,
  type EquipmentKind,
} from "@/lib/equipment";
import KeyboardSafe from "@/components/KeyboardSafe";
import type { Exercise } from "@/types/database";

export const EQUIPMENT_BUCKET = "equipment-photos";

async function signPhotos(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await supabase.storage.from(EQUIPMENT_BUCKET).createSignedUrls(paths, 60 * 60);
  const urls: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) urls[d.path] = d.signedUrl;
  return urls;
}

// The home equipment list (0092), for the client on their Profile and for the
// trainer on the client's Training tab. Each item is a tap-through form: pick
// what it is, then how many, the weight, the type and a photo. Only the
// trainer can load the exercises a multi station does.
export default function EquipmentEditor({
  clientId,
  items,
  onSave,
  trainer = false,
}: {
  clientId: string;
  items: EquipmentItem[];
  onSave: (items: EquipmentItem[]) => Promise<boolean>;
  trainer?: boolean;
}) {
  const [editing, setEditing] = useState<EquipmentItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [viewing, setViewing] = useState<string | null>(null);

  const photoKey = items
    .map((i) => i.photo)
    .filter(Boolean)
    .join("|");
  useEffect(() => {
    let live = true;
    signPhotos(photoKey ? photoKey.split("|") : []).then((u) => live && setUrls(u));
    return () => {
      live = false;
    };
  }, [photoKey]);

  const save = async (item: EquipmentItem) => {
    const exists = items.some((i) => i.id === item.id);
    const next = exists ? items.map((i) => (i.id === item.id ? item : i)) : [...items, item];
    const ok = await onSave(next);
    if (ok) {
      const old = items.find((i) => i.id === item.id)?.photo;
      if (old && old !== item.photo) supabase.storage.from(EQUIPMENT_BUCKET).remove([old]).catch(() => {});
      setEditing(null);
      setAdding(false);
    }
    return ok;
  };

  const remove = (item: EquipmentItem) => {
    Alert.alert("Remove this?", equipmentSummary(item), [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const ok = await onSave(items.filter((i) => i.id !== item.id));
          if (ok && item.photo) supabase.storage.from(EQUIPMENT_BUCKET).remove([item.photo]).catch(() => {});
        },
      },
    ]);
  };

  return (
    <View>
      {items.length === 0 ? (
        <Text style={styles.empty}>
          {trainer ? "Nothing listed yet. Add what they have, or ask them to add it on their Profile." : "Nothing listed yet. Add what you have at home."}
        </Text>
      ) : (
        items.map((item) => {
          const kind = equipmentKind(item.type);
          const url = item.photo ? urls[item.photo] : undefined;
          return (
            <View key={item.id} style={styles.item}>
              <Text style={styles.itemIcon}>{kind.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemText}>{equipmentSummary(item)}</Text>
                {item.type === "multi_station" ? (
                  <Text style={styles.small}>
                    {item.exercises?.length
                      ? `Exercises: ${item.exercises.join(", ")}`
                      : trainer
                        ? "Tap Edit to load the exercises it can do."
                        : "Your trainer will load the exercises it can do."}
                  </Text>
                ) : null}
                <View style={styles.itemActions}>
                  <Pressable onPress={() => setEditing(item)} hitSlop={6}>
                    <Text style={styles.link}>Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => remove(item)} hitSlop={6}>
                    <Text style={[styles.link, { color: "#F87171" }]}>Remove</Text>
                  </Pressable>
                </View>
              </View>
              {url ? (
                <Pressable onPress={() => setViewing(url)}>
                  <Image source={{ uri: url }} style={styles.thumb} />
                </Pressable>
              ) : null}
            </View>
          );
        })
      )}
      <Pressable style={styles.addButton} onPress={() => setAdding(true)}>
        <Text style={styles.addText}>+ Add equipment</Text>
      </Pressable>

      <EquipmentForm
        visible={adding || editing !== null}
        clientId={clientId}
        initial={editing}
        trainer={trainer}
        onSave={save}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
      />

      <Modal visible={viewing !== null} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <Pressable style={styles.viewer} onPress={() => setViewing(null)}>
          {viewing ? <Image source={{ uri: viewing }} style={styles.viewerImage} resizeMode="contain" /> : null}
          <Text style={styles.small}>Tap to close</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

function EquipmentForm({
  visible,
  clientId,
  initial,
  trainer,
  onSave,
  onClose,
}: {
  visible: boolean;
  clientId: string;
  initial: EquipmentItem | null;
  trainer: boolean;
  onSave: (item: EquipmentItem) => Promise<boolean>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<EquipmentItem | null>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [library, setLibrary] = useState<Pick<Exercise, "id" | "name" | "category">[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!visible) return;
    setDraft(initial);
    setPreview(null);
    setSearch("");
  }, [visible, initial]);

  const isStation = draft?.type === "multi_station";
  useEffect(() => {
    if (!visible || !trainer || !isStation || library.length) return;
    supabase
      .from("exercises")
      .select("id, name, category")
      .order("sort_order")
      .then(({ data }) => setLibrary(data ?? []));
  }, [visible, trainer, isStation, library.length]);

  const kind = draft ? equipmentKind(draft.type) : null;
  const set = (patch: Partial<EquipmentItem>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const choose = (k: EquipmentKind) =>
    setDraft({ id: newEquipmentId(), type: k.type, count: k.count ? 1 : undefined, option: k.options?.[0] });

  const pickPhoto = async (source: "camera" | "library") => {
    const permission =
      source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", source === "camera" ? "Allow camera access to take the photo." : "Allow photo access to choose the photo.");
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.7 };
    const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const photo = await shrinkPhoto(asset.uri, asset.width, asset.height);
      const body = await new File(photo.uri).arrayBuffer();
      const path = `${clientId}/${newEquipmentId()}.jpg`;
      const { error } = await supabase.storage.from(EQUIPMENT_BUCKET).upload(path, body, { contentType: "image/jpeg" });
      if (error) throw error;
      // A photo replaced before saving is tidied up straight away.
      if (draft?.photo && draft.photo !== initial?.photo) supabase.storage.from(EQUIPMENT_BUCKET).remove([draft.photo]).catch(() => {});
      set({ photo: path });
      setPreview(photo.uri);
    } catch (err) {
      Alert.alert("Couldn't save photo", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const addPhoto = () =>
    Alert.alert("Add a photo", undefined, [
      { text: "Take photo", onPress: () => pickPhoto("camera") },
      { text: "Choose from gallery", onPress: () => pickPhoto("library") },
      { text: "Cancel", style: "cancel" },
    ]);

  const submit = async () => {
    if (!draft) return;
    setSaving(true);
    await onSave({ ...draft, weight: draft.weight?.trim() || undefined, note: draft.note?.trim() || undefined });
    setSaving(false);
  };

  const close = () => {
    // A photo taken for an item that was never saved isn't kept.
    if (draft?.photo && draft.photo !== initial?.photo) supabase.storage.from(EQUIPMENT_BUCKET).remove([draft.photo]).catch(() => {});
    onClose();
  };

  const stationList = draft?.exercises ?? [];
  const matches = useMemo(
    () => (search.trim() ? filterExercises(library, search).filter((e) => !stationList.includes(e.name)).slice(0, 8) : []),
    [library, search, stationList],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardSafe>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              {draft && !initial ? (
                <Pressable onPress={() => setDraft(null)} hitSlop={10}>
                  <Text style={styles.close}>‹</Text>
                </Pressable>
              ) : null}
              <Text style={styles.title}>{kind ? `${kind.icon} ${kind.label}` : "What do you have?"}</Text>
              <Pressable onPress={close} hitSlop={10} accessibilityLabel="Close">
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>

            {!draft || !kind ? (
              <ScrollView>
                <View style={styles.grid}>
                  {EQUIPMENT_KINDS.map((k) => (
                    <Pressable key={k.type} style={styles.tile} onPress={() => choose(k)}>
                      <Text style={styles.tileIcon}>{k.icon}</Text>
                      <Text style={styles.tileText}>{k.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.small}>{kind.hint}</Text>

                {kind.count ? (
                  <>
                    <Text style={styles.label}>{kind.count.label}</Text>
                    <View style={styles.stepperRow}>
                      <Pressable style={styles.stepper} onPress={() => set({ count: Math.max(1, (draft.count ?? 1) - 1) })}>
                        <Text style={styles.stepperText}>-</Text>
                      </Pressable>
                      <Text style={styles.itemText}>{draft.count ?? 1}</Text>
                      <Pressable style={styles.stepper} onPress={() => set({ count: Math.min(kind.count!.max, (draft.count ?? 1) + 1) })}>
                        <Text style={styles.stepperText}>+</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}

                {kind.options ? (
                  <View style={styles.chips}>
                    {kind.options.map((o) => (
                      <Pressable key={o} style={[styles.chip, draft.option === o && styles.chipOn]} onPress={() => set({ option: o })}>
                        <Text style={[styles.chipText, draft.option === o && { color: "#0F172A" }]}>{o}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {kind.weight ? (
                  <>
                    <Text style={styles.label}>{kind.weight}</Text>
                    <TextInput
                      style={styles.input}
                      value={draft.weight ?? ""}
                      onChangeText={(t) => set({ weight: t })}
                      placeholder="e.g. 10 kg"
                      placeholderTextColor="#64748B"
                      maxLength={40}
                    />
                  </>
                ) : null}

                {kind.note ? (
                  <>
                    <Text style={styles.label}>{kind.note}</Text>
                    <TextInput
                      style={styles.input}
                      value={draft.note ?? ""}
                      onChangeText={(t) => set({ note: t })}
                      placeholderTextColor="#64748B"
                      maxLength={80}
                    />
                  </>
                ) : null}

                {kind.photo ? (
                  <>
                    <Text style={styles.label}>{kind.photo}</Text>
                    <Pressable style={styles.photoButton} onPress={addPhoto} disabled={uploading}>
                      {uploading ? (
                        <ActivityIndicator color={BRAND_GOLD} />
                      ) : preview ? (
                        <Image source={{ uri: preview }} style={styles.preview} />
                      ) : (
                        <Text style={styles.link}>{draft.photo ? "📷 Photo saved. Tap to change it" : "📷 Add a photo"}</Text>
                      )}
                    </Pressable>
                  </>
                ) : null}

                {isStation && trainer ? (
                  <>
                    <Text style={styles.label}>Exercises it can do</Text>
                    {stationList.map((name) => (
                      <View key={name} style={styles.stationRow}>
                        <Text style={[styles.itemText, { flex: 1 }]}>{name}</Text>
                        <Pressable onPress={() => set({ exercises: stationList.filter((n) => n !== name) })} hitSlop={6}>
                          <Text style={[styles.link, { color: "#F87171" }]}>Remove</Text>
                        </Pressable>
                      </View>
                    ))}
                    <TextInput
                      style={styles.input}
                      value={search}
                      onChangeText={setSearch}
                      placeholder="Search the library, e.g. lat pulldown"
                      placeholderTextColor="#64748B"
                    />
                    {matches.map((e) => (
                      <Pressable
                        key={e.id}
                        style={styles.match}
                        onPress={() => {
                          set({ exercises: [...stationList, e.name] });
                          setSearch("");
                        }}
                      >
                        <Text style={[styles.itemText, { flex: 1 }]}>{e.name}</Text>
                        <Text style={styles.link}>+ Add</Text>
                      </Pressable>
                    ))}
                  </>
                ) : null}

                <Pressable style={[styles.saveButton, (saving || uploading) && { opacity: 0.5 }]} onPress={submit} disabled={saving || uploading}>
                  {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.saveText}>Save</Text>}
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </KeyboardSafe>
    </Modal>
  );
}

const styles = StyleSheet.create({
  empty: { color: "#94A3B8", fontSize: 14, marginBottom: 8 },
  item: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#0F172A", borderRadius: 10, padding: 10, marginBottom: 8 },
  itemIcon: { fontSize: 22 },
  itemText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  itemActions: { flexDirection: "row", gap: 16, marginTop: 4 },
  small: { color: "#94A3B8", fontSize: 13, marginTop: 2 },
  link: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14 },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: "#1E293B" },
  addButton: { borderWidth: 1.5, borderColor: BRAND_GOLD, borderStyle: "dashed", borderRadius: 10, padding: 12, alignItems: "center" },
  addText: { color: BRAND_GOLD, fontWeight: "800", fontSize: 15 },
  viewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center", padding: 16 },
  viewerImage: { width: "100%", height: "80%" },
  backdrop: { flex: 1, backgroundColor: "rgba(2,6,23,0.8)", justifyContent: "center", padding: 16 },
  sheet: { backgroundColor: "#0F172A", borderRadius: 16, padding: 16, maxHeight: "90%", borderWidth: 1, borderColor: "#1E293B" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  title: { color: "#fff", fontWeight: "800", fontSize: 17, flex: 1 },
  close: { color: "#94A3B8", fontSize: 22, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { width: "48%", backgroundColor: "#1E293B", borderRadius: 12, padding: 12, alignItems: "center" },
  tileIcon: { fontSize: 26 },
  tileText: { color: "#fff", fontWeight: "700", fontSize: 13, marginTop: 4, textAlign: "center" },
  label: { color: "#CBD5E1", fontSize: 13, fontWeight: "700", marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 8, padding: 10, fontSize: 15 },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  stepper: { width: 36, height: 36, borderRadius: 8, backgroundColor: "#1E293B", alignItems: "center", justifyContent: "center" },
  stepperText: { color: BRAND_GOLD, fontSize: 20, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  chip: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  chipOn: { backgroundColor: BRAND_GOLD },
  chipText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 14 },
  photoButton: { backgroundColor: "#1E293B", borderRadius: 10, padding: 14, alignItems: "center", minHeight: 52, justifyContent: "center" },
  preview: { width: 120, height: 120, borderRadius: 8 },
  stationRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  match: { flexDirection: "row", alignItems: "center", backgroundColor: "#1E293B", borderRadius: 8, padding: 10, marginTop: 6 },
  saveButton: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 18 },
  saveText: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
});
