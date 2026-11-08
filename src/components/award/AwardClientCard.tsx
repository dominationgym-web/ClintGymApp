import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { BRAND_GOLD } from "@/lib/brand";
import { todayIso } from "@/lib/dates";
import { proofDueText, type AwardClientNeeds, type GoalDirection } from "@/lib/award";
import { saveAwardProfile, sendProofVideo } from "@/lib/awardUploads";
import AwardProfileFields from "@/components/award/AwardProfileFields";
import { themeText, themedStyles } from "@/lib/theme";

// On the client's Today tab while Trainer of the Half-Year is switched on
// (0194): a face photo and goal for clients who joined before it, and any
// proof video the app asked for. Shows nothing while the award is off.
export default function AwardClientCard() {
  const { client } = useAuth();
  const [needs, setNeeds] = useState<AwardClientNeeds | null>(null);
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [consented, setConsented] = useState(false);
  const [goal, setGoal] = useState<GoalDirection | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("my_award_needs");
    setNeeds((data as AwardClientNeeds | null) ?? null);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!client || !needs?.enabled) return null;
  const proofs = needs.proofs ?? [];
  const profileMissing = !!needs.needs_photo || !!needs.needs_goal;
  if (!profileMissing && proofs.length === 0) return null;

  const saveProfile = async () => {
    if (needs.needs_goal && !goal) return Alert.alert("Pick your main goal", "Lose fat, Build muscle or Maintain.");
    if (needs.needs_photo && !photo) return Alert.alert("Face photo needed", "Add a clear photo of your face.");
    if (needs.needs_photo && !consented) return Alert.alert("Consent needed", "Tick the box to agree to how your face photo is used.");
    setBusy("profile");
    try {
      await saveAwardProfile(client.id, needs.needs_photo ? photo : null, needs.needs_goal ? goal : null);
      setOpen(false);
      await load();
    } catch (e) {
      Alert.alert("Couldn't save", e instanceof Error ? e.message : "Check your internet and try again.");
    } finally {
      setBusy(null);
    }
  };

  const send = (proofId: string) =>
    Alert.alert("Proof video", "Up to 60 seconds. Keep your face clearly in view the whole time.", [
      { text: "Film it now", onPress: () => upload(proofId, true) },
      { text: "Choose a video", onPress: () => upload(proofId, false) },
      { text: "Cancel", style: "cancel" },
    ]);
  const upload = async (proofId: string, camera: boolean) => {
    setBusy(proofId);
    const problem = await sendProofVideo(client.id, proofId, camera).catch((e) => (e instanceof Error ? e.message : "Upload failed"));
    setBusy(null);
    if (problem === "cancelled") return;
    if (problem) Alert.alert("Couldn't send the video", problem);
    else Alert.alert("Sent ✅", "Thanks! It will be checked soon.");
    load();
  };

  return (
    <View style={styles.card}>
      {profileMissing && (
        <>
          <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
            <Text style={styles.title}>{needs.needs_photo ? "Add your face photo" : "Pick your main goal"}</Text>
            <Text style={styles.text}>
              {needs.needs_photo && needs.needs_goal
                ? "A face photo and your main goal, so your progress counts. Takes a minute."
                : needs.needs_photo
                  ? "So your progress counts. Takes a minute."
                  : "Lose fat, Build muscle or Maintain, so the app knows which way is progress."}
            </Text>
            <Text style={styles.link}>{open ? "Close ▴" : "Open ›"}</Text>
          </Pressable>
          {open && (
            <>
              <AwardProfileFields
                photo={photo}
                onPhoto={setPhoto}
                consented={consented}
                onConsent={setConsented}
                goal={goal}
                onGoal={setGoal}
                askPhoto={!!needs.needs_photo}
                askGoal={!!needs.needs_goal}
              />
              <Pressable style={styles.button} onPress={saveProfile} disabled={busy !== null}>
                {busy === "profile" ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.buttonText}>Save</Text>}
              </Pressable>
            </>
          )}
        </>
      )}
      {proofs.map((p, i) => (
        <View key={p.id} style={(profileMissing || i > 0) && styles.line}>
          <Text style={styles.title}>{p.status === "uploaded" ? "Proof video sent" : "Please send a quick proof video"}</Text>
          <Text style={styles.text}>
            {p.status === "uploaded"
              ? `Thanks! Your video of ${p.detail} is being checked.`
              : `Great progress! To count it, film ${p.detail} with your face clearly visible. ${proofDueText(p.due_on, todayIso())}.`}
          </Text>
          {p.status === "requested" && (
            <Pressable style={styles.button} onPress={() => send(p.id)} disabled={busy !== null}>
              {busy === p.id ? <ActivityIndicator color={themeText("#0F172A")} /> : <Text style={styles.buttonText}>Send the video</Text>}
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = themedStyles({
  card: { backgroundColor: "#1E293B", borderLeftWidth: 4, borderLeftColor: BRAND_GOLD, borderRadius: 8, padding: 12, marginBottom: 14 },
  title: { color: "#fff", fontWeight: "700", marginBottom: 4 },
  text: { color: "#E2E8F0", lineHeight: 20 },
  link: { color: BRAND_GOLD, fontWeight: "700", marginTop: 6 },
  line: { borderTopWidth: 1, borderTopColor: "#334155", marginTop: 12, paddingTop: 12 },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, padding: 12, alignItems: "center", marginTop: 10 },
  buttonText: { color: "#0F172A", fontWeight: "700", fontSize: 15 },
});
