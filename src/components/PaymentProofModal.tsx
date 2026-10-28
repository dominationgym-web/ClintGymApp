import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { PAYMENT_PROOF_BUCKET, proofWhen } from "@/lib/paymentProofs";
import type { PaymentProof } from "@/types/database";

// The receiver's side of proof of payment (0117): the slip or screenshot, who
// sent it and when, and one tap to act on it (Activate for a trainer, Record
// payment for the owner) or say it hasn't come through.
export default function PaymentProofModal({
  proof,
  from,
  confirmLabel,
  onConfirm,
  onClose,
  onReviewed,
}: {
  proof: PaymentProof | null;
  from: string;
  confirmLabel: string;
  /** Runs the activation or opens Record payment; the proof is marked confirmed first. */
  onConfirm: (proof: PaymentProof) => void;
  onClose: () => void;
  /** After the proof's status changed, so lists can reload. */
  onReviewed?: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [ratio, setRatio] = useState(0.6);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setUrl(null);
    setFailed(false);
    if (!proof) return;
    supabase.storage
      .from(PAYMENT_PROOF_BUCKET)
      .createSignedUrl(proof.storage_path, 3600)
      .then(({ data }) => {
        setUrl(data?.signedUrl ?? null);
        if (!data?.signedUrl) setFailed(true);
        if (data?.signedUrl) Image.getSize(data.signedUrl, (w, h) => h && setRatio(w / h), () => undefined);
      });
  }, [proof?.id]);

  const review = async (status: PaymentProof["status"]) => {
    if (!proof) return;
    await supabase.from("payment_proofs").update({ status, reviewed_at: new Date().toISOString() }).eq("id", proof.id);
    onReviewed?.();
  };

  return (
    <Modal visible={!!proof} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 24 }}>
          {proof ? (
            <>
              <Text style={styles.title}>🧾 Proof of payment</Text>
              <Text style={styles.line}>
                From {from} · {proofWhen(proof.created_at)}
              </Text>
              {proof.amount ? <Text style={styles.amount}>Amount: {proof.amount}</Text> : null}
              {url ? (
                <Image source={{ uri: url }} style={[styles.image, { aspectRatio: ratio }]} resizeMode="contain" />
              ) : failed ? (
                <Text style={styles.helper}>The photo couldn't be opened. Close this and try again, or ask them to send it again.</Text>
              ) : (
                <ActivityIndicator color={BRAND_GOLD} style={{ marginVertical: 40 }} />
              )}
              <Text style={styles.helper}>Check it has reached your bank account before you confirm.</Text>
              <Pressable
                style={styles.confirm}
                onPress={async () => {
                  await review("confirmed");
                  onConfirm(proof);
                }}
              >
                <Text style={styles.confirmText}>{confirmLabel}</Text>
              </Pressable>
              <Pressable
                style={styles.secondary}
                onPress={async () => {
                  await review("not_received");
                  onClose();
                }}
              >
                <Text style={styles.secondaryText}>Not in my account yet</Text>
              </Pressable>
              <Pressable style={styles.secondary} onPress={onClose}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { flexGrow: 0, maxHeight: "94%", backgroundColor: "#1E293B", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  title: { color: "#fff", fontWeight: "800", fontSize: 18 },
  line: { color: "#CBD5E1", fontSize: 13, marginTop: 4 },
  amount: { color: BRAND_GOLD, fontSize: 15, fontWeight: "700", marginTop: 6 },
  image: { width: "100%", borderRadius: 10, marginTop: 12, backgroundColor: "#0F172A" },
  helper: { color: "#94A3B8", fontSize: 12, marginTop: 10 },
  confirm: { backgroundColor: "#22C55E", borderRadius: 10, paddingVertical: 13, alignItems: "center", marginTop: 12 },
  confirmText: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
  secondary: { alignItems: "center", paddingVertical: 12 },
  secondaryText: { color: "#F59E0B", fontWeight: "700", fontSize: 14 },
  closeText: { color: "#94A3B8", fontSize: 14 },
});
