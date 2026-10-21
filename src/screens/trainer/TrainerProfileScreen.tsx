import React, { useEffect, useState } from "react";
import AppUpdateLine from "@/components/AppUpdateLine";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import TextInput from "@/components/TextInput";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { supabase } from "@/lib/supabase";
import { avatarContentType } from "@/lib/avatars";
import {
  EFT_FIELDS,
  REFERRAL_DISCOUNT_PERCENT,
  TRAINER_LOGO_BUCKET,
  logoStoragePath,
  referralRewards,
  trainerDisplayName,
  trialDaysLeft,
  trialLabel,
} from "@/lib/trainers";
import { todayIso } from "@/lib/dates";
import TrainerLogo from "@/components/TrainerLogo";
import ClientAvatar from "@/components/ClientAvatar";
import DeleteAccountButton from "@/components/DeleteAccountButton";
import TrainerPlanCard from "@/components/TrainerPlanCard";
import TrainerIncome from "@/components/TrainerIncome";
import ScreenTabBar, { type ScreenTab } from "@/components/ScreenTabBar";
import { money, referralCreditUseLine, referralCreditValue, trainerCurrency } from "@/lib/billing";
import type { BillingPrices, EftDetails } from "@/types/database";

type TabKey = "code" | "income" | "refer" | "details" | "payments" | "account";

const TABS: ScreenTab<TabKey>[] = [
  { key: "code", label: "Code & logo", icon: "qr-code" },
  { key: "income", label: "Income", icon: "cash" },
  { key: "refer", label: "Plan & refer", icon: "gift" },
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
  // The picked picture, shown the moment it's saved (GRIZZ, 2026-10-21: a
  // trainer's new logo saved but the screen kept showing the old one).
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("code");
  // Trainers who signed up with this trainer's code (0060).
  const [referrals, setReferrals] = useState<{ name: string; approved: boolean }[]>([]);
  const [prices, setPrices] = useState<BillingPrices | null>(null);

  useEffect(() => {
    if (!trainer || trainer.is_owner) return;
    supabase.rpc("my_referrals").then(({ data }) => setReferrals(data ?? []));
    supabase
      .from("billing_settings")
      .select("prices")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => setPrices((data?.prices as BillingPrices | undefined) ?? null));
  }, [trainer?.id, tab]);

  if (!trainer) return null;
  // The owner has no plan or referrals. Their tracker across all trainers
  // (0105) is under Trainers → Billing, with the rest of the money.
  const tabs = TABS.filter((t) => !trainer.is_owner || t.key !== "refer");
  const today = todayIso();
  const trial = trialLabel(trainer.trial_ends_at, today);
  const trialLeft = trialDaysLeft(trainer.trial_ends_at, today);
  const rewards = referralRewards(referrals.filter((r) => r.approved).length, trainer.referral_credits_used);

  const shareReferral = () =>
    Share.share({
      message: `I coach my clients on the Daily Evolution app. Sign up as a trainer and enter my referral code ${trainer.join_code} to get a free 30-day trial.`,
    });
  const displayName = trainerDisplayName(trainer);

  const shareCode = () =>
    Share.share({
      message: `Join me on the Daily Evolution app. When you sign up, enter my trainer code: ${trainer.join_code}`,
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
      setLogoPreview(asset.uri);
      await refreshProfile();
      Alert.alert("✓ Logo saved", "Your clients see it on their Profile tab and when they sign up.");
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

  const togglePlanningReminders = async (on: boolean) => {
    const { error } = await supabase.from("trainers").update({ planning_reminders: on }).eq("id", trainer.id);
    if (error) {
      Alert.alert("Couldn't save", error.message);
      return;
    }
    await refreshProfile();
  };

  return (
    <View style={styles.container}>
      <ScreenTabBar tabs={tabs} current={tab} onChange={setTab} position="top" />
      <ScrollView key={tab} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {tab === "code" && (
          <>
            <Pressable style={styles.logoBlock} onPress={pickLogo} disabled={uploadingLogo}>
              {logoPreview ? (
                <ClientAvatar name={displayName} url={logoPreview} size={96} />
              ) : (
                <TrainerLogo name={displayName} path={trainer.logo_path} size={96} />
              )}
              {uploadingLogo ? (
                <ActivityIndicator color="#22C55E" style={{ marginTop: 8 }} />
              ) : (
                <Text style={styles.link}>{trainer.logo_path || logoPreview ? "Change logo" : "Add your logo"}</Text>
              )}
              <Text style={styles.hint}>Your clients see this in their app.</Text>
            </Pressable>

            <View style={styles.codeBox}>
              <Text style={styles.label}>Your trainer code</Text>
              <Text style={styles.code}>{trainer.join_code}</Text>
              <Text style={[styles.hint, { textAlign: "center" }]}>
                New clients type this when they sign up, so they join you.
                {trainer.is_owner ? "" : " It's also your referral code: a trainer who signs up with it counts as your referral (Plan & refer)."}
              </Text>
              <Pressable style={styles.secondaryButton} onPress={shareCode}>
                <Text style={styles.secondaryButtonText}>Share my code</Text>
              </Pressable>
            </View>
          </>
        )}
        {tab === "income" && <TrainerIncome />}
        {tab === "refer" && (
          <>
            <TrainerPlanCard trainer={trainer} />
            {trial ? (
              <View style={[styles.trialBox, trialLeft !== null && trialLeft < 0 && { borderColor: "#F59E0B" }]}>
                <Text style={styles.trialTitle}>{trial}</Text>
                <Text style={styles.hint}>
                  {trialLeft !== null && trialLeft < 0
                    ? "Your access stays on while we sort out your plan."
                    : "Try everything free. We'll remind you before it ends."}
                </Text>
              </View>
            ) : null}

            <View style={styles.codeBox}>
              <Text style={styles.label}>Your referral code (the same as your trainer code)</Text>
              <Text style={styles.code}>{trainer.join_code}</Text>
              <Text style={[styles.hint, { textAlign: "center" }]}>
                Another trainer enters this when they sign up. For each one who's approved, you get {REFERRAL_DISCOUNT_PERCENT}% off
                a month. 4 referrals = a free month. {referralCreditUseLine(!!trainer.free_use_from)} If you cancel, unused
                referrals are paid out to you.
              </Text>
              <Pressable style={styles.secondaryButton} onPress={shareReferral}>
                <Text style={styles.secondaryButtonText}>Share with a trainer</Text>
              </Pressable>
            </View>

            <View style={styles.rewardRow}>
              <View style={styles.rewardStat}>
                <Text style={styles.rewardNumber}>{rewards.earned}</Text>
                <Text style={styles.hint}>earned</Text>
              </View>
              <View style={styles.rewardStat}>
                <Text style={styles.rewardNumber}>{rewards.unused}</Text>
                <Text style={styles.hint}>banked</Text>
              </View>
              <View style={styles.rewardStat}>
                <Text style={styles.rewardNumber}>
                  {prices ? money(referralCreditValue(prices, trainerCurrency(trainer), rewards.unused), trainerCurrency(trainer)) : `${rewards.unusedPercent}%`}
                </Text>
                <Text style={styles.hint}>off to use</Text>
              </View>
            </View>
            {referrals.length > 0 ? <Text style={styles.sectionHeading}>Trainers you referred</Text> : null}
            {referrals.map((r, i) => (
              <View key={`${r.name}-${i}`} style={styles.referralRow}>
                <Text style={styles.readOnly}>{r.name}</Text>
                <Text style={[styles.hint, { color: r.approved ? "#22C55E" : "#F59E0B" }]}>
                  {r.approved ? `+${REFERRAL_DISCOUNT_PERCENT}%` : "Waiting for approval"}
                </Text>
              </View>
            ))}
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

            <Text style={styles.sectionHeading}>Notifications</Text>
            <View style={styles.switchRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.switchTitle}>Planning reminders</Text>
                <Text style={styles.hint}>
                  A reminder 2 days and 1 day before a client's planned workouts on their training calendar run out, so you can plan their next week.
                </Text>
              </View>
              <Switch
                value={trainer.planning_reminders !== false}
                onValueChange={togglePlanningReminders}
                trackColor={{ true: BRAND_GOLD, false: "#334155" }}
                accessibilityLabel="Planning reminders"
              />
            </View>
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
            <AppUpdateLine />
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
  switchRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#1E293B", borderRadius: 10, padding: 12 },
  switchTitle: { color: "#fff", fontWeight: "700", fontSize: 15 },
  sectionHeading: { color: "#fff", fontSize: 17, fontWeight: "700", marginTop: 20, marginBottom: 6 },
  label: { color: "#94A3B8", fontWeight: "600", marginBottom: 6, marginTop: 6 },
  readOnly: { color: "#E2E8F0", fontSize: 15, marginBottom: 6 },
  input: { backgroundColor: "#1E293B", color: "#fff", borderRadius: 10, padding: 12, marginBottom: 6 },
  button: { backgroundColor: "#22C55E", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 20 },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 16 },
  secondaryButton: { borderColor: "#22C55E", borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20, marginTop: 8 },
  secondaryButtonText: { color: "#22C55E", fontWeight: "700" },
  trialBox: { backgroundColor: "#1E293B", borderRadius: 12, borderWidth: 1, borderColor: "#22C55E", padding: 14, marginBottom: 14 },
  trialTitle: { color: "#fff", fontSize: 17, fontWeight: "800" },
  rewardRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  rewardStat: { flex: 1, backgroundColor: "#1E293B", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  rewardNumber: { color: "#fff", fontSize: 22, fontWeight: "800" },
  referralRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#1E293B", borderRadius: 10, padding: 12, marginBottom: 8 },
  logout: { alignItems: "center", marginTop: 24 },
  logoutText: { color: "#64748B", fontSize: 14, fontWeight: "600" },
});
