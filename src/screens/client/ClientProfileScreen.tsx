import React, { useEffect, useState } from "react";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ClientStackParamList, ClientTabParamList } from "@/navigation/types";
import InjuryList from "@/components/InjuryList";
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { AVATAR_BUCKET, avatarContentType, avatarStoragePath } from "@/lib/avatars";
import ClientAvatar from "@/components/ClientAvatar";
import { CoachMessageHistory } from "@/components/CoachMessages";
import ProgressPhotosSection from "@/components/ProgressPhotosSection";
import HomeEquipmentCard from "@/components/HomeEquipmentCard";
import DeleteAccountButton from "@/components/DeleteAccountButton";
import TrainerLogo from "@/components/TrainerLogo";
import { DailyQuoteCard } from "@/components/DailyQuote";
import TrainerPaymentDetails from "@/components/TrainerPaymentDetails";
import SendProofOfPayment from "@/components/SendProofOfPayment";
import WatchLink from "@/components/WatchLink";
import FoldSection from "@/components/FoldSection";
import { trainerDisplayName } from "@/lib/trainers";
import { STATUS_FLAGS } from "@/lib/statusFlags";
import { clientGoals } from "@/lib/clientGoals";
import type { ClientStatusFlag, Trainer } from "@/types/database";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  expiring_soon: "Expiring soon",
  expired: "Expired",
};


export default function ClientProfileScreen() {
  const { client, signOut, refreshProfile } = useAuth();
  const [selectedFlag, setSelectedFlag] = useState<ClientStatusFlag | null>(null);
  // null means "not edited on this screen yet", so the box falls back to
  // whatever note is already on the row. That way the client can see and edit a
  // note they raised earlier instead of it silently riding along behind an empty
  // box, and what they read in the box is exactly what gets saved.
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  // Which tap-to-open heading is open (one at a time, none at first).
  const [openFold, setOpenFold] = useState<string | null>(null);
  const navigation = useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  // The plan-ending banner on Check-in opens Paying your trainer straight away (C8).
  const route = useRoute<RouteProp<ClientTabParamList, "Profile">>();
  const openParam = route.params?.open;
  useEffect(() => {
    if (openParam) {
      setOpenFold(openParam);
      navigation.setParams({ open: undefined } as never);
    }
  }, [openParam]);
  const trainerId = client?.trainer_id;

  // The client's own trainer, for their logo and payment details (0029).
  useEffect(() => {
    if (!trainerId) return;
    let cancelled = false;
    supabase
      .from("trainers")
      .select("*")
      .eq("id", trainerId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setTrainer(data);
      });
    return () => {
      cancelled = true;
    };
  }, [trainerId]);

  if (!client) return null;

  const uploadPhoto = async (asset: ImagePicker.ImagePickerAsset) => {
    setUploadingPhoto(true);
    try {
      const body = await new File(asset.uri).arrayBuffer();
      const path = avatarStoragePath(client.id, asset.mimeType);
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, body, { contentType: avatarContentType(asset.mimeType) });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase.from("clients").update({ avatar_path: path }).eq("id", client.id);
      if (updateError) {
        await supabase.storage.from(AVATAR_BUCKET).remove([path]);
        throw updateError;
      }
      // Tidy up the old photo. If this fails the new one is already showing,
      // so there is nothing to tell the client.
      if (client.avatar_path && client.avatar_path !== path) {
        await supabase.storage.from(AVATAR_BUCKET).remove([client.avatar_path]);
      }
      await refreshProfile();
    } catch (err) {
      Alert.alert("Couldn't save photo", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const pickPhoto = async (source: "camera" | "library") => {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        source === "camera" ? "Allow camera access to take your photo." : "Allow photo access to choose your photo."
      );
      return;
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    };
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ ...options, cameraType: ImagePicker.CameraType.front })
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets?.[0]) return;
    await uploadPhoto(result.assets[0]);
  };

  const changePhoto = () => {
    Alert.alert(client.avatar_path ? "Change your photo" : "Add your photo", "So your trainer can put a face to your name.", [
      { text: "Take photo", onPress: () => pickPhoto("camera") },
      { text: "Choose from gallery", onPress: () => pickPhoto("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const activeFlag = selectedFlag ?? client.status_flag;
  const noteValue = note ?? client.status_flag_note ?? "";
  const savedNote = client.status_flag_note ?? "";

  const handleSave = async () => {
    if (activeFlag !== "green" && !noteValue.trim()) {
      Alert.alert("Add a quick note", "Let your trainer know what's going on so they have context.");
      return;
    }
    setSaving(true);
    // status_flag_updated_at is stamped server-side by the trigger in 0023 -
    // the phone's clock is not trustworthy enough for the trainer to sort by.
    const { error } = await supabase
      .from("clients")
      .update({
        status_flag: activeFlag,
        status_flag_note: activeFlag === "green" ? null : noteValue.trim(),
      })
      .eq("id", client.id);
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't update", error.message);
      return;
    }
    setSelectedFlag(null);
    setNote(null);
    await refreshProfile();
  };

  // Changing the flag counts, and so does adding detail to a flag that is
  // already standing - for the state that means "urgent", being unable to save
  // more context without first toggling the flag was the wrong constraint.
  const hasChange =
    (selectedFlag !== null && selectedFlag !== client.status_flag) ||
    (activeFlag !== "green" && noteValue.trim() !== savedNote);

  const fold = (key: string) => setOpenFold(openFold === key ? null : key);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <DailyQuoteCard />
      <View style={styles.headerRow}>
        <Pressable style={styles.photoBlock} onPress={changePhoto} disabled={uploadingPhoto}>
          <ClientAvatar name={client.name} path={client.avatar_path} size={72} />
          {uploadingPhoto ? (
            <ActivityIndicator style={{ marginTop: 6 }} color="#22C55E" />
          ) : (
            <Text style={styles.photoLink}>{client.avatar_path ? "Change photo" : "Add a photo"}</Text>
          )}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{client.name}</Text>
          <Text style={styles.email}>{client.email}</Text>
          <View style={[styles.statusPill, statusStyle(client.access_status)]}>
            <Text style={styles.statusText}>{STATUS_LABEL[client.access_status]}</Text>
          </View>
        </View>
      </View>

      {client.plan_expires_at && (
        <Text style={styles.helper}>Plan renews/expires {new Date(client.plan_expires_at).toLocaleDateString()}</Text>
      )}

      {trainer ? (
        <View style={styles.trainerCard}>
          <View style={styles.trainerRow}>
            <TrainerLogo name={trainerDisplayName(trainer)} path={trainer.logo_path} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={styles.trainerLabel}>Your trainer</Text>
              <Text style={styles.trainerName}>{trainerDisplayName(trainer)}</Text>
            </View>
          </View>
        </View>
      ) : null}

      <FoldSection
        icon="🚦"
        title="How are you doing?"
        hint={STATUS_FLAGS.find((f) => f.key === activeFlag)?.label}
        open={openFold === "flag"}
        onToggle={() => fold("flag")}
      >
        <Text style={styles.body}>
          Let your trainer know if you need anything - they check this before anything else.
        </Text>
        {STATUS_FLAGS.map((f) =>
          f.key === "red" ? (
            <Pressable key={f.key} style={styles.flagRow} onPress={() => setSelectedFlag(f.key)}>
              <Text style={styles.flagIcon}>🚩</Text>
              <View style={[styles.radio, activeFlag === f.key && { borderColor: f.color, backgroundColor: f.color }]} />
              <Text style={styles.flagLabel}>{f.label}</Text>
            </Pressable>
          ) : (
            <Pressable key={f.key} style={styles.flagRow} onPress={() => setSelectedFlag(f.key)}>
              <View style={[styles.flagDot, { backgroundColor: f.color }]} />
              <View style={[styles.radio, activeFlag === f.key && { borderColor: f.color, backgroundColor: f.color }]} />
              <Text style={styles.flagLabel}>{f.label}</Text>
            </Pressable>
          )
        )}

        {activeFlag !== "green" && (
          <TextInput
            style={styles.noteInput}
            multiline
            placeholder="Quick note for your trainer (what's going on?)"
            placeholderTextColor="#64748B"
            value={noteValue}
            onChangeText={setNote}
          />
        )}

        {hasChange && (
          <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.buttonText}>Update status</Text>}
          </Pressable>
        )}

      </FoldSection>

      <FoldSection icon="💬" title="Messages from your coach" open={openFold === "messages"} onToggle={() => fold("messages")}>
        <CoachMessageHistory bare />
      </FoldSection>

      {/* Was the Video log tab (app-flow review C2, 2026-10-18); opens its own page. */}
      <FoldSection
        icon="🎥"
        title="Form videos"
        hint="Your videos and your coach's feedback"
        open={false}
        onToggle={() => navigation.navigate("FormVideos")}
      >
        {null}
      </FoldSection>

      <FoldSection icon="📸" title="Progress photos" open={openFold === "photos"} onToggle={() => fold("photos")}>
        <ProgressPhotosSection bare />
      </FoldSection>

      {client.training_place === "home" && (
        <FoldSection icon="🏠" title="My home equipment" open={openFold === "equipment"} onToggle={() => fold("equipment")}>
          <HomeEquipmentCard client={client} onChanged={() => refreshProfile()} />
        </FoldSection>
      )}

      <FoldSection icon="🎯" title="Goals and injuries" open={openFold === "goals"} onToggle={() => fold("goals")}>
        <Text style={styles.sectionHeading}>Goals</Text>
        <Text style={styles.body}>{clientGoals(client) || "None yet. Tell your coach what you want to achieve and they can add it here."}</Text>
        <Text style={styles.sectionHeading}>My injuries</Text>
        <Text style={styles.body}>List every injury, one at a time, so your coach can keep your program safe. Tap Healed once it's better.</Text>
        <InjuryList clientId={client.id} role="client" />
        {client.injuries ? (
          <>
            <Text style={styles.sectionHeading}>Noted earlier</Text>
            <Text style={styles.body}>{client.injuries}</Text>
          </>
        ) : null}
      </FoldSection>

      <FoldSection icon="⌚" title="My devices" open={openFold === "devices"} onToggle={() => fold("devices")}>
        <Text style={styles.body}>
          Link your watch or fitness tracker so your runs, rides, walks and swims go to your coach by themselves. Samsung,
          Garmin and Polar watches sync through your phone's health app (turn it on in their app's settings).
        </Text>
        <WatchLink clientId={client.id} />
      </FoldSection>

      {trainer ? (
        <FoldSection icon="💳" title="Paying your trainer" open={openFold === "pay"} onToggle={() => fold("pay")}>
          <TrainerPaymentDetails eftDetails={trainer.eft_details} popWhatsapp={trainer.pop_whatsapp} proofInApp />
          <SendProofOfPayment to="trainer" payerId={client.id} trainerId={trainer.id} receiverName={trainerDisplayName(trainer)} />
        </FoldSection>
      ) : null}

      <FoldSection icon="⚙️" title="Account" open={openFold === "account"} onToggle={() => fold("account")}>
        <Pressable style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
        <DeleteAccountButton />
      </FoldSection>
    </ScrollView>
  );
}

function statusStyle(status: string) {
  switch (status) {
    case "active":
      return { backgroundColor: "#22C55E" };
    case "expiring_soon":
      return { backgroundColor: "#F59E0B" };
    default:
      return { backgroundColor: "#EF4444" };
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 8 },
  photoBlock: { alignItems: "center" },
  trainerCard: { backgroundColor: "#111C33", borderRadius: 12, padding: 14, marginTop: 8 },
  trainerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  trainerLabel: { color: "#64748B", fontSize: 12 },
  trainerName: { color: "#fff", fontSize: 16, fontWeight: "700" },
  photoLink: { color: "#22C55E", fontWeight: "600", marginTop: 6, fontSize: 12 },
  title: { fontSize: 22, fontWeight: "700", color: "#fff" },
  email: { color: "#94A3B8", marginBottom: 8 },
  statusPill: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginBottom: 8 },
  statusText: { color: "#0F172A", fontWeight: "700", fontSize: 12 },
  helper: { color: "#64748B", fontSize: 12, marginBottom: 16 },
  sectionHeading: { color: "#94A3B8", fontWeight: "600", marginTop: 16, marginBottom: 6 },
  body: { color: "#E2E8F0", fontSize: 14, lineHeight: 20 },
  flagRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  flagDot: { width: 10, height: 10, borderRadius: 5 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#334155" },
  flagIcon: { fontSize: 14, width: 10, textAlign: "center" },
  flagLabel: { color: "#E2E8F0", fontSize: 14, flexShrink: 1 },
  noteInput: {
    backgroundColor: "#1E293B",
    color: "#fff",
    borderRadius: 10,
    padding: 12,
    minHeight: 70,
    textAlignVertical: "top",
    marginTop: 14,
  },
  button: { backgroundColor: "#22C55E", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 14 },
  logoutButton: {
    backgroundColor: "#334155",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: { color: "#0F172A", fontWeight: "700" },
  logoutText: { color: "#fff", fontWeight: "700" },
});
