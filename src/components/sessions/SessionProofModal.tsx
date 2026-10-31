import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, Text, View } from "react-native";
import { ScrollView } from "@/components/ScrollView";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { STORAGE_BUCKET } from "@/lib/liveSessions";
import { themeText, themedStyles } from "@/lib/theme";

// The screenshot of a cancellation message, saved as proof (0168).
export default function SessionProofModal({ path, caption, onClose }: { path: string | null; caption?: string; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [ratio, setRatio] = useState(0.6);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setUrl(null);
    setFailed(false);
    if (!path) return;
    supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        setUrl(data?.signedUrl ?? null);
        if (!data?.signedUrl) setFailed(true);
        if (data?.signedUrl) Image.getSize(data.signedUrl, (w, h) => h && setRatio(w / h), () => undefined);
      });
  }, [path]);

  return (
    <Modal visible={!!path} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 24 }}>
          <Text style={styles.title}>📸 Cancellation proof</Text>
          {caption ? <Text style={styles.line}>{caption}</Text> : null}
          {url ? (
            <Image source={{ uri: url }} style={[styles.image, { aspectRatio: ratio }]} resizeMode="contain" />
          ) : failed ? (
            <Text style={styles.line}>The screenshot couldn't be opened. Close this and try again.</Text>
          ) : (
            <ActivityIndicator color={themeText(BRAND_GOLD)} style={{ marginVertical: 40 }} />
          )}
          <Pressable style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = themedStyles({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0F172A", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: "90%" },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  line: { color: "#CBD5E1", fontSize: 14, marginTop: 6, lineHeight: 20 },
  image: { width: "100%", marginTop: 12, borderRadius: 8 },
  close: { borderWidth: 1, borderColor: BRAND_GOLD, borderRadius: 10, padding: 12, alignItems: "center", marginTop: 16 },
  closeText: { color: BRAND_GOLD, fontWeight: "700", fontSize: 15 },
});
