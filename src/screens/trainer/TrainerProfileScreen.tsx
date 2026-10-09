import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { avatarContentType } from "@/lib/avatars";
import { EFT_FIELDS, TRAINER_LOGO_BUCKET, logoStoragePath, trainerDisplayName } from "@/lib/trainers";
import TrainerLogo from "@/components/TrainerLogo";
import DeleteAccountButton from "@/components/DeleteAccountButton";
import ScreenTabBar, { type ScreenTab } from "@/components/ScreenTabBar";
import type { EftDetails } from "@/types/database";

type TabKey = "code" | "details" | "payments" | "account";

const TABS: ScreenTab<TabKey>[] = [
  { key: "code", label: "Code & logo", icon: "qr-code" },
  { key: "details", label: "Details", icon: "person" },
  { key: "payments", label: "Payments", icon: "card" },
  { key: "account", label: "Account", icon: "settings" },
];

// A trainer's own setup (0029): the code their clients sign up with, the logo
// their clients see, and the payment details shown after a client signs up.
export default function TrainerProfileScreen() {
  const { trainer, refreshProfile, signOut } = useAuth();
  const [businessName, setBusinessName] = useState(trainer?.business_name ?? "");
  const [phone, setPhone] = useState(trainer?.phone ?? "");
  const [popWhatsapp, setPopWhatsapp] = useState(trainer?.pop_whatsapp ?? "");
  const [eft, setEft] = useState<EftDetails>(trainer?.eft_details ?? {});
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [tab, setTab] = useState<TabKey>("code");

  if (!trainer) return null;
  const displayName = trainerDisplayName(trainer);

  const shareCode = () =>
    Share.share({
      message: `Join me on the Consistent Change app. When you sign up, enter my trainer code: ${trainer.join_code}`,
    });

  const uploadLogo = async (asset: ImagePicker.ImagePickerAsset) => {
    setUploadingLogo(true);
    try {
      const body = await new File(asset.uri).arrayBuffer();
      const path = logoStoragePath(trainer.id, asset.mimeType);
      const { error: uploadError } = await supabase.storage
        .from(TRAINER_LOGO_BUCKET)
        .upload(path, body, { contentType: avatarContentType(asset.mimeType) });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase.from("trainers").update({ logo_path: path }).eq("id", trainer.id);
      if (updateError) {
        await supabase.storage.from(TRAINER_LOGO_BUCKET).remove([path]);
        throw updateError;
      }
      if (trainer.logo_path && trainer.logo_path !== path) {
        await supabase.storage.from(TRAINER_LOGO_BUCKET).remove([trainer.logo_path]);
      }
      await refreshProfile();
    } catch (err) {
      Alert.alert("Couldn't save logo", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const pickLogo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access to choose your logo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;
    await uploadLogo(result.assets[0]);
  };

  const save = async () => {
    setSaving(true);
    const cleanEft: EftDetails = {};
    for (const { key } of EFT_FIELDS) {
      const value = (eft[key] ?? "").trim();
      if (value) cleanEft[key] = value;
    }
    const { error } = await supabase
      .from("trainers")
      .update({
        business_name: businessName.trim() || null,
        phone: phone.trim() || null,
        pop_whatsapp: popWhatsapp.trim() || null,
        eft_details: cleanEft,
      })
      .eq("id", trainer.id);
    setSaving(false);
    if (error) {
      Alert.alert("Couldn't save", error.message);
      return;
    }
    await refreshProfile();
    Alert.alert("Saved", "Your profile is up to date.");
  };

  return (
    <View style={styles.container}>
      <ScreenTabBar tabs={TABS} current={tab} onChange={setTab} position="top" />
      <ScrollView key={tab} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {tab === "code" && (
          <>
            <Pressable style={styles.logoBlock} onPress={pickLogo} disabled={uploadingLogo}>
              <TrainerLogo name={displayName} path={trainer.logo_path} size={96} />
              {uploadingLogo ? (
                <ActivityIndicator color="#22C55E" style={{ marginTop: 8 }} />
              ) : (
                <Text style={styles.link}>{trainer.logo_path ? "Change logo" : "Add your logo"}</Text>
              )}
              <Text style={styles.hint}>Your clients see this in their app.</Text>
            </Pressable>

            <View style={styles.codeBox}>
              <Text style={styles.label}>Your trainer code</Text>
              <Text style={styles.code}>{trainer.join_code}</Text>
              <Text style={styles.hint}>New clients type this when they sign up, so they join you.</Text>
              <Pressable style={styles.secondaryButton} onPress={shareCode}>
                <Text style={styles.secondaryButtonText}>Share my code</Text>
              </Pressable>
            </View>
          </>
        )}
        {tab === "details" && (
          <>
            <Text style={styles.sectionHeading}>Your details</Text>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.readOnly}>{trainer.name}</Text>
            <Text style={styles.label}>Business name</Text>
            <TextInput style={styles.input} placeholder="Optional" placeholderTextColor="#64748B" value={businessName} onChangeText={setBusinessName} />
            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />

            <Pressable style={styles.button} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.buttonText}>Save</Text>}
            </Pressable>
          </>
        )}
        {tab === "payments" && (
          <>
            <Text style={styles.sectionHeading}>How your clients pay you</Text>
            <Text style={styles.hint}>Shown to a client right after they sign up with your code.</Text>
            {EFT_FIELDS.map(({ key, label }) => (
              <View key={key}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={styles.input}
                  keyboardType={key === "branch_code" || key === "account_number" ? "number-pad" : "default"}
                  value={eft[key] ?? ""}
                  onChangeText={(value) => setEft((prev) => ({ ...prev, [key]: value }))}
                />
              </View>
            ))}
            <Text style={styles.label}>WhatsApp number for proof of payment</Text>
            <TextInput style={styles.input} keyboardType="phone-pad" value={popWhatsapp} onChangeText={setPopWhatsapp} />

            <Pressable style={styles.button} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.buttonText}>Save</Text>}
            </Pressable>
          </>
        )}
        {tab === "account" && (
          <>
            <Text style={styles.sectionHeading}>Signed in as</Text>
            <Text style={styles.readOnly}>{trainer.email}</Text>
            <Pressable style={styles.logout} onPress={signOut}>
              <Text style={styles.logoutText}>Log out</Text>
            </Pressable>
            {trainer.is_owner ? null : <DeleteAccountButton />}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  logoBlock: { alignItems: "center", marginBottom: 20 },
  link: { color: "#22C55E", fontWeight: "600", marginTop: 8 },
  hint: { color: "#64748B", fontSize: 12, marginTop: 4, marginBottom: 8 },
  codeBox: { backgroundColor: "#1E293B", borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 8 },
  code: { color: "#fff", fontSize: 32, fontWeight: "800", letterSpacing: 4, marginVertical: 4 },
  sectionHeading: { color: "#fff", fontSize: 17, fontWeight: "700", marginTop: 20, marginBottom: 6 },
  label: { color: "#94A3B8", fontWeight: "600", marginBottom: 6, marginTop: 6 },
  readOnly: { color: "#E2E8F0", fontSize: 15, marginBottom: 6 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 10, padding: 12, marginBottom: 6 },
  button: { backgroundColor: "#22C55E", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 20 },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 16 },
  secondaryButton: { borderColor: "#22C55E", borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20, marginTop: 8 },
  secondaryButtonText: { color: "#22C55E", fontWeight: "700" },
  logout: { alignItems: "center", marginTop: 24 },
  logoutText: { color: "#64748B", fontSize: 14, fontWeight: "600" },
});
