import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { shrinkPhoto } from "@/lib/shrinkPhoto";
import { latestProof, PAYMENT_PROOF_BUCKET, paymentProofPath, proofStatusText } from "@/lib/paymentProofs";
import type { PaymentProof } from "@/types/database";

// The sender's side of proof of payment (0117): a client to their trainer, or
// a trainer to the app owner (to: "owner"). Take a photo of the slip or pick a
// screenshot of the banking app; it goes straight to the right person, who is
// notified. The last one sent shows whether it's been confirmed.
export default function SendProofOfPayment({
  to,
  payerId,
  trainerId,
  receiverName,
}: {
  to: "trainer" | "owner";
  /** The client's id, or the paying trainer's. */
  payerId: string;
  /** The client's trainer, or the paying trainer. */
  trainerId: string;
  /** "your trainer", "Clint", for the status line. */
  receiverName: string;
}) {
  const [last, setLast] = useState<PaymentProof | null>(null);
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    let query = supabase.from("payment_proofs").select("*").eq("payer_id", payerId).eq("to_owner", to === "owner");
    query = query.order("created_at", { ascending: false }).limit(1);
    const { data } = await query;
    setLast(latestProof((data as PaymentProof[] | null) ?? []));
  }, [payerId, to]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async (asset: ImagePicker.ImagePickerAsset) => {
    setSending(true);
    const path = paymentProofPath(payerId);
    try {
      const photo = await shrinkPhoto(asset.uri, asset.width, asset.height);
      const body = await new File(photo.uri).arrayBuffer();
      const { error: uploadError } = await supabase.storage.from(PAYMENT_PROOF_BUCKET).upload(path, body, { contentType: "image/jpeg" });
      if (uploadError) throw uploadError;
      const { error } = await supabase.from("payment_proofs").insert({
        client_id: to === "trainer" ? payerId : null,
        trainer_id: trainerId,
        to_owner: to === "owner",
        storage_path: path,
        amount: amount.trim() || null,
      });
      if (error) {
        await supabase.storage.from(PAYMENT_PROOF_BUCKET).remove([path]);
        throw error;
      }
      setAmount("");
      await load();
      Alert.alert("Proof sent", `${receiverName[0].toUpperCase()}${receiverName.slice(1)} has been told. You'll see here once it's confirmed.`);
    } catch (err) {
      Alert.alert("Couldn't send it", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSending(false);
    }
  };

  const pick = async (camera: boolean) => {
    const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", camera ? "Allow the camera to take a photo of your slip." : "Allow photos to pick your screenshot.");
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.9 };
    const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets[0]) send(result.assets[0]);
  };

  const choose = () =>
    Alert.alert("Send proof of payment", "A screenshot from your banking app or a photo of the slip.", [
      { text: "Choose a screenshot", onPress: () => pick(false) },
      { text: "Take a photo", onPress: () => pick(true) },
      { text: "Cancel", style: "cancel" },
    ]);

  return (
    <View style={styles.box}>
      {last ? <Text style={[styles.status, last.status === "confirmed" && styles.ok, last.status === "not_received" && styles.warn]}>{proofStatusText(last, receiverName)}</Text> : null}
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        placeholder="Amount paid (optional), like R1 000"
        placeholderTextColor="#64748B"
        maxLength={40}
      />
      <Pressable style={styles.button} onPress={choose} disabled={sending} accessibilityRole="button">
        {sending ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.buttonText}>🧾 Send proof of payment</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 12 },
  status: { color: "#CBD5E1", fontSize: 13, marginBottom: 8, lineHeight: 19 },
  ok: { color: "#22C55E", fontWeight: "700" },
  warn: { color: "#F59E0B", fontWeight: "600" },
  input: { backgroundColor: "#0F172A", color: "#fff", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: "#334155" },
  button: { backgroundColor: BRAND_GOLD, borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
});
