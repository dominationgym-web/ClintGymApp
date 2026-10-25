import type { ChatMessage, ChatMessageKind } from "@/types/database";

// Trainer-client chat (0152): text, photos and voice notes between a client
// and their trainer. Kept out of the screens so it can be tested.

export const CHAT_BUCKET = "chat-media";

/** Must match the length check on chat_messages.body. */
export const MAX_CHAT_LENGTH = 2000;

/** A voice note stops recording on its own at 3 minutes. */
export const MAX_VOICE_MS = 3 * 60_000;

/** Shorter than this is a slip of the finger, not a voice note. */
export const MIN_VOICE_MS = 1_000;

/** Days without a message from the trainer before the check-in nudge (0152's quiet_clients). */
export const QUIET_AFTER_DAYS = 4;

export const CHAT_MENU_TITLE = "Chat";

/** The trimmed message, or null if there is nothing worth sending. */
export function cleanChatText(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > MAX_CHAT_LENGTH) return null;
  return trimmed;
}

/** "0:42", "2:05": how long a voice note is. */
export function formatDuration(ms: number | null | undefined): string {
  const total = Math.max(0, Math.round((ms ?? 0) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** The file extension of a recording or photo from its uri, without the dot. */
export function fileExtension(uri: string, fallback: string): string {
  const match = /\.([a-z0-9]{2,5})(?:[?#].*)?$/i.exec(uri);
  return match ? match[1].toLowerCase() : fallback;
}

/** The content type to upload a voice note with, from its file extension. */
export function audioContentType(extension: string): string {
  switch (extension) {
    case "webm":
      return "audio/webm";
    case "3gp":
      return "audio/3gpp";
    case "aac":
      return "audio/aac";
    case "mp3":
      return "audio/mpeg";
    default:
      return "audio/mp4";
  }
}

/** Where a chat file goes: under the client's id, which the storage rules check. */
export function chatMediaPath(clientId: string, kind: Exclude<ChatMessageKind, "text">, extension: string, now = Date.now()): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${clientId}/${kind}-${now}-${random}.${extension}`;
}

/** One line for the chat list and notifications. */
export function chatPreview(m: { kind: ChatMessageKind | string | null; body: string | null; duration_ms?: number | null }): string {
  if (m.kind === "voice") return m.duration_ms ? `🎤 Voice note (${formatDuration(m.duration_ms)})` : "🎤 Voice note";
  if (m.kind === "photo") return m.body ? `📷 ${m.body}` : "📷 Photo";
  return m.body ?? "";
}

/** "Today", "Yesterday" or "Mon 20 Oct": the line above each day in the chat. */
export function chatDayLabel(createdAt: string, now = new Date()): string {
  const d = new Date(createdAt);
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((today - day) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  const weekday = d.toLocaleDateString("en-ZA", { weekday: "short" });
  const date = d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
  return d.getFullYear() === now.getFullYear() ? `${weekday} ${date}` : `${date} ${d.getFullYear()}`;
}

/** "14:05": the time under a message. */
export function chatTime(createdAt: string): string {
  const d = new Date(createdAt);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export type ChatRow = { type: "day"; key: string; label: string } | { type: "message"; key: string; message: ChatMessage };

/** The messages (oldest first) with a day line before each new day. */
export function withDayLines(messages: ChatMessage[], now = new Date()): ChatRow[] {
  const rows: ChatRow[] = [];
  let lastLabel: string | null = null;
  for (const m of messages) {
    const label = chatDayLabel(m.created_at, now);
    if (label !== lastLabel) {
      rows.push({ type: "day", key: `day-${m.created_at}`, label });
      lastLabel = label;
    }
    rows.push({ type: "message", key: m.id, message: m });
  }
  return rows;
}

/** Adds a message that just arrived (live or just sent), once, in time order. */
export function addMessage(list: ChatMessage[], m: ChatMessage): ChatMessage[] {
  if (list.some((x) => x.id === m.id)) return list.map((x) => (x.id === m.id ? m : x));
  return [...list, m].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** The check-in nudge line for one client, e.g. "5 days since you last spoke". */
export function quietLine(daysQuiet: number, lastSpokeAt: string | null): string {
  const days = `${daysQuiet} day${daysQuiet === 1 ? "" : "s"}`;
  return lastSpokeAt ? `${days} since you last spoke` : `No message from you yet (${days})`;
}

export function firstName(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] || "them";
}
