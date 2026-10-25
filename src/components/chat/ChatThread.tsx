import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import TextInput from "@/components/TextInput";
import { supabase } from "@/lib/supabase";
import { BRAND_GOLD } from "@/lib/brand";
import { shrinkPhoto } from "@/lib/shrinkPhoto";
import {
  addMessage,
  audioContentType,
  CHAT_BUCKET,
  chatMediaPath,
  chatTime,
  cleanChatText,
  fileExtension,
  formatDuration,
  MAX_CHAT_LENGTH,
  withDayLines,
  type ChatRow,
} from "@/lib/chat";
import { loadVoiceNotePlayer, loadVoiceRecorder, voiceNotesAvailable } from "@/lib/voiceNotes";
import type { ChatMessage, ChatMessageKind } from "@/types/database";

// The conversation between a client and their trainer (0152), used by both
// sides. Newest at the bottom, live while open, with photos and voice notes.
// There's no ready-made text anywhere on purpose: every word comes from the
// person typing or talking.

const PAGE = 100;
const SIGNED_URL_SECONDS = 60 * 60;

const VoiceRecorder = loadVoiceRecorder();
const VoiceNotePlayer = loadVoiceNotePlayer();

async function readFile(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === "web") return (await fetch(uri)).arrayBuffer();
  return new File(uri).arrayBuffer();
}

export default function ChatThread({
  clientId,
  trainerId,
  me,
  otherName,
}: {
  clientId: string;
  trainerId: string;
  me: "client" | "trainer";
  otherName: string;
}) {
  const fromMe = me === "trainer";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasEarlier, setHasEarlier] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState<null | "text" | "photo" | "voice">(null);
  const [recording, setRecording] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [viewing, setViewing] = useState<string | null>(null);
  const requested = useRef(new Set<string>());

  const markRead = useCallback(() => {
    supabase.rpc("mark_chat_read", me === "trainer" ? { p_client: clientId } : {}).then(() => undefined);
  }, [me, clientId]);

  const load = useCallback(
    async (before?: string) => {
      let query = supabase
        .from("chat_messages")
        .select("*")
        .eq("client_id", clientId)
        .eq("trainer_id", trainerId)
        .order("created_at", { ascending: false })
        .limit(PAGE);
      if (before) query = query.lt("created_at", before);
      const { data, error } = await query;
      if (error) {
        Alert.alert("Couldn't load the chat", error.message);
        setLoading(false);
        return;
      }
      const page = (data ?? []).reverse();
      setHasEarlier(page.length === PAGE);
      setMessages((prev) => (before ? [...page, ...prev] : page));
      setLoading(false);
    },
    [clientId, trainerId]
  );

  useEffect(() => {
    setLoading(true);
    load();
    markRead();
  }, [load, markRead]);

  // New messages and "seen" ticks arrive live. Realtime only sends rows this
  // person may read (the select policy in 0152).
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${clientId}-${me}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", filter: `client_id=eq.${clientId}` },
        (payload) => {
          const row = payload.new as ChatMessage | undefined;
          if (!row?.id || row.trainer_id !== trainerId) return;
          setMessages((prev) => addMessage(prev, row));
          if (payload.eventType === "INSERT" && row.from_trainer !== fromMe) markRead();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId, trainerId, me, fromMe, markRead]);

  // Signed links for photos and voice notes, fetched once each.
  useEffect(() => {
    const paths = messages.map((m) => m.media_path).filter((p): p is string => !!p && !requested.current.has(p));
    if (paths.length === 0) return;
    paths.forEach((p) => requested.current.add(p));
    supabase.storage
      .from(CHAT_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_SECONDS)
      .then(({ data }) => {
        const found: Record<string, string> = {};
        for (const item of data ?? []) if (item.path && item.signedUrl) found[item.path] = item.signedUrl;
        setUrls((prev) => ({ ...prev, ...found }));
      });
  }, [messages]);

  const rows = useMemo(() => withDayLines(messages).reverse(), [messages]);

  const insert = async (kind: ChatMessageKind, fields: { body?: string | null; media_path?: string; duration_ms?: number }) => {
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({ client_id: clientId, trainer_id: trainerId, from_trainer: fromMe, kind, ...fields })
      .select()
      .single();
    if (error || !data) throw error ?? new Error("Please try again.");
    setMessages((prev) => addMessage(prev, data));
  };

  const sendText = async () => {
    const body = cleanChatText(text);
    if (!body || sending) return;
    setSending("text");
    try {
      await insert("text", { body });
      setText("");
    } catch (e) {
      Alert.alert("Couldn't send", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setSending(null);
    }
  };

  const upload = async (path: string, uri: string, contentType: string) => {
    const body = await readFile(uri);
    const { error } = await supabase.storage.from(CHAT_BUCKET).upload(path, body, { contentType });
    if (error) throw error;
  };

  const sendPhoto = async (asset: ImagePicker.ImagePickerAsset) => {
    setSending("photo");
    try {
      const photo = Platform.OS === "web" ? { uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg" } : await shrinkPhoto(asset.uri, asset.width, asset.height);
      const ext = photo.mimeType === "image/png" ? "png" : photo.mimeType === "image/webp" ? "webp" : "jpg";
      const path = chatMediaPath(clientId, "photo", ext);
      await upload(path, photo.uri, photo.mimeType);
      // Whatever is in the typing box goes with the photo as its caption.
      const caption = cleanChatText(text);
      await insert("photo", { media_path: path, body: caption });
      if (caption) setText("");
    } catch (e) {
      Alert.alert("Couldn't send the photo", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setSending(null);
    }
  };

  const pickPhoto = async (camera: boolean) => {
    const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", camera ? "Allow the camera to take a photo." : "Allow photos to pick one to send.");
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.9 };
    const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets[0]) sendPhoto(result.assets[0]);
  };

  const choosePhoto = () => {
    if (Platform.OS === "web") {
      pickPhoto(false);
      return;
    }
    Alert.alert("Send a photo", text.trim() ? "What you typed goes with it." : undefined, [
      { text: "Take a photo", onPress: () => pickPhoto(true) },
      { text: "Choose from my photos", onPress: () => pickPhoto(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const startVoice = () => {
    if (!voiceNotesAvailable() || !VoiceRecorder) {
      Alert.alert(
        "Update the app for voice notes",
        "Voice notes need the newest version of Daily Evolution. Install the latest update from the app store (or the link your coach sent), then try again. Text and photos work now."
      );
      return;
    }
    setRecording(true);
  };

  const sendVoice = async ({ uri, durationMs }: { uri: string; durationMs: number }) => {
    setRecording(false);
    setSending("voice");
    try {
      const ext = fileExtension(uri, Platform.OS === "web" ? "webm" : "m4a");
      const path = chatMediaPath(clientId, "voice", ext);
      await upload(path, uri, audioContentType(ext));
      await insert("voice", { media_path: path, duration_ms: Math.round(durationMs) });
    } catch (e) {
      Alert.alert("Couldn't send the voice note", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setSending(null);
    }
  };

  // Only my last message that has been read shows "Seen", like most chat apps.
  const lastSeenId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.from_trainer === fromMe && m.read_at) return m.id;
    }
    return null;
  }, [messages, fromMe]);

  const renderRow = ({ item }: { item: ChatRow }) => {
    if (item.type === "day") return <Text style={styles.day}>{item.label}</Text>;
    const m = item.message;
    const mine = m.from_trainer === fromMe;
    const url = m.media_path ? urls[m.media_path] ?? null : null;
    return (
      <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, m.kind === "photo" && styles.photoBubble]}>
          {m.kind === "photo" ? (
            <Pressable onPress={() => url && setViewing(url)} accessibilityLabel="Open photo">
              {url ? <Image source={{ uri: url }} style={styles.photo} resizeMode="cover" /> : <View style={[styles.photo, styles.photoLoading]}><ActivityIndicator color={BRAND_GOLD} /></View>}
            </Pressable>
          ) : null}
          {m.kind === "voice" ? (
            VoiceNotePlayer ? (
              <VoiceNotePlayer url={url} durationMs={m.duration_ms} mine={mine} />
            ) : (
              <Text style={[styles.text, mine && styles.textMine]}>
                🎤 Voice note ({formatDuration(m.duration_ms)}). Update the app to play it.
              </Text>
            )
          ) : null}
          {m.body ? <Text style={[styles.text, mine && styles.textMine, m.kind === "photo" && styles.caption]}>{m.body}</Text> : null}
          <Text style={[styles.time, mine && styles.timeMine]}>
            {chatTime(m.created_at)}
            {mine && m.id === lastSeenId ? "  ✓✓ Seen" : ""}
          </Text>
        </View>
      </View>
    );
  };

  const message = cleanChatText(text);

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={BRAND_GOLD} />
        </View>
      ) : (
        <FlatList
          inverted
          data={rows}
          keyExtractor={(r) => r.key}
          renderItem={renderRow}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={[styles.empty, styles.flip]}>
              {me === "trainer"
                ? `No messages with ${otherName} yet. Say hi in your own words, send a photo or a voice note.`
                : `This is your private chat with ${otherName}. Ask a question, share a win, send a photo or a voice note.`}
            </Text>
          }
          ListFooterComponent={
            hasEarlier ? (
              <Pressable style={styles.earlier} onPress={() => messages[0] && load(messages[0].created_at)}>
                <Text style={styles.earlierText}>Show earlier messages</Text>
              </Pressable>
            ) : null
          }
          ListHeaderComponent={
            sending && sending !== "text" ? (
              <Text style={styles.sending}>{sending === "photo" ? "Sending photo…" : "Sending voice note…"}</Text>
            ) : null
          }
        />
      )}

      <View style={styles.inputBar}>
        {recording && VoiceRecorder ? (
          <VoiceRecorder onDone={sendVoice} onCancel={() => setRecording(false)} />
        ) : (
          <View style={styles.inputRow}>
            <Pressable style={styles.iconButton} onPress={choosePhoto} disabled={!!sending} accessibilityLabel="Send a photo">
              <Ionicons name="camera-outline" size={24} color={BRAND_GOLD} />
            </Pressable>
            <TextInput
              style={styles.input}
              multiline
              placeholder="Message"
              maxLength={MAX_CHAT_LENGTH}
              value={text}
              onChangeText={setText}
            />
            {message ? (
              <Pressable style={styles.send} onPress={sendText} disabled={!!sending} accessibilityLabel="Send">
                {sending === "text" ? <ActivityIndicator color="#0F172A" /> : <Ionicons name="send" size={20} color="#0F172A" />}
              </Pressable>
            ) : (
              <Pressable style={styles.send} onPress={startVoice} disabled={!!sending} accessibilityLabel="Record a voice note">
                <Ionicons name="mic" size={22} color="#0F172A" />
              </Pressable>
            )}
          </View>
        )}
      </View>

      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <Pressable style={styles.viewer} onPress={() => setViewing(null)}>
          {viewing ? <Image source={{ uri: viewing }} style={styles.viewerImage} resizeMode="contain" /> : null}
          <Text style={styles.viewerHint}>Tap to close</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 12, flexGrow: 1 },
  // The list is upside down (newest at the bottom), so the empty message is flipped back.
  flip: { transform: [{ scaleY: -1 }] },
  empty: { color: "#94A3B8", textAlign: "center", marginTop: 40, paddingHorizontal: 24, lineHeight: 20 },
  day: { color: "#64748B", fontSize: 12, textAlign: "center", marginVertical: 10 },
  bubbleRow: { flexDirection: "row", marginVertical: 3 },
  rowMine: { justifyContent: "flex-end" },
  rowTheirs: { justifyContent: "flex-start" },
  bubble: { maxWidth: "80%", borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 },
  bubbleMine: { backgroundColor: BRAND_GOLD, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: "#1E293B", borderBottomLeftRadius: 4 },
  photoBubble: { padding: 4 },
  photo: { width: 220, height: 220, borderRadius: 10, backgroundColor: "#0F172A" },
  photoLoading: { alignItems: "center", justifyContent: "center" },
  text: { color: "#E2E8F0", fontSize: 15, lineHeight: 20 },
  textMine: { color: "#0F172A" },
  caption: { paddingHorizontal: 6, paddingTop: 6 },
  time: { color: "#64748B", fontSize: 10, marginTop: 3, alignSelf: "flex-end" },
  timeMine: { color: "#1E293B" },
  earlier: { alignSelf: "center", padding: 10 },
  earlierText: { color: BRAND_GOLD, fontWeight: "600" },
  sending: { color: "#94A3B8", fontSize: 12, textAlign: "right", marginVertical: 6 },
  inputBar: { borderTopWidth: 1, borderTopColor: "#1E293B", paddingHorizontal: 8, paddingVertical: 6, backgroundColor: "#0F172A" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  iconButton: { padding: 10 },
  input: { flex: 1, backgroundColor: "#F8FAFC", borderRadius: 20, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, maxHeight: 120, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: BRAND_GOLD, alignItems: "center", justifyContent: "center" },
  viewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", alignItems: "center", justifyContent: "center" },
  viewerImage: { width: "100%", height: "85%" },
  viewerHint: { color: "#94A3B8", marginTop: 12 },
});
