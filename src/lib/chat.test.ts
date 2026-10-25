import { describe, expect, it } from "vitest";
import {
  addMessage,
  audioContentType,
  chatDayLabel,
  chatMediaPath,
  chatPreview,
  cleanChatText,
  fileExtension,
  firstName,
  formatDuration,
  MAX_CHAT_LENGTH,
  quietLine,
  withDayLines,
} from "@/lib/chat";
import type { ChatMessage } from "@/types/database";

const msg = (id: string, created_at: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  client_id: "c1",
  trainer_id: "t1",
  from_trainer: true,
  kind: "text",
  body: "Hi",
  media_path: null,
  duration_ms: null,
  created_at,
  read_at: null,
  ...extra,
});

describe("chat", () => {
  it("trims a message and refuses an empty or too long one", () => {
    expect(cleanChatText("  How was legs?  ")).toBe("How was legs?");
    expect(cleanChatText("   ")).toBeNull();
    expect(cleanChatText("x".repeat(MAX_CHAT_LENGTH + 1))).toBeNull();
  });

  it("shows how long a voice note is", () => {
    expect(formatDuration(42_400)).toBe("0:42");
    expect(formatDuration(125_000)).toBe("2:05");
    expect(formatDuration(null)).toBe("0:00");
  });

  it("works out the file type of a recording", () => {
    expect(fileExtension("file:///data/rec-123.m4a", "m4a")).toBe("m4a");
    expect(fileExtension("blob:https://x/abc", "webm")).toBe("webm");
    expect(audioContentType("m4a")).toBe("audio/mp4");
    expect(audioContentType("webm")).toBe("audio/webm");
    expect(audioContentType("3gp")).toBe("audio/3gpp");
  });

  it("stores files under the client's id, which the storage rules check", () => {
    expect(chatMediaPath("c1", "voice", "m4a", 1000)).toMatch(/^c1\/voice-1000-[a-z0-9]+\.m4a$/);
    expect(chatMediaPath("c1", "photo", "jpg", 1000)).toMatch(/^c1\/photo-1000-[a-z0-9]+\.jpg$/);
  });

  it("previews each kind of message in one line", () => {
    expect(chatPreview({ kind: "voice", body: null, duration_ms: 9_000 })).toBe("🎤 Voice note (0:09)");
    expect(chatPreview({ kind: "photo", body: null })).toBe("📷 Photo");
    expect(chatPreview({ kind: "photo", body: "My new shoes" })).toBe("📷 My new shoes");
    expect(chatPreview({ kind: "text", body: "Great session" })).toBe("Great session");
  });

  it("labels days as Today, Yesterday or a date", () => {
    const now = new Date(2026, 9, 25, 15, 0);
    expect(chatDayLabel(new Date(2026, 9, 25, 8, 0).toISOString(), now)).toBe("Today");
    expect(chatDayLabel(new Date(2026, 9, 24, 23, 0).toISOString(), now)).toBe("Yesterday");
    expect(chatDayLabel(new Date(2026, 9, 20, 9, 0).toISOString(), now)).toMatch(/20/);
  });

  it("puts a day line before each new day", () => {
    const now = new Date(2026, 9, 25, 15, 0);
    const a = msg("a", new Date(2026, 9, 24, 9, 0).toISOString());
    const b = msg("b", new Date(2026, 9, 25, 9, 0).toISOString());
    const c = msg("c", new Date(2026, 9, 25, 10, 0).toISOString());
    expect(withDayLines([a, b, c], now).map((r) => (r.type === "day" ? r.label : r.key))).toEqual(["Yesterday", "a", "Today", "b", "c"]);
  });

  it("adds a live message once, in time order", () => {
    const a = msg("a", "2026-10-25T08:00:00Z");
    const b = msg("b", "2026-10-25T09:00:00Z");
    expect(addMessage([b], a).map((m) => m.id)).toEqual(["a", "b"]);
    expect(addMessage([a, b], { ...a, read_at: "2026-10-25T10:00:00Z" })).toHaveLength(2);
    expect(addMessage([a, b], { ...a, read_at: "2026-10-25T10:00:00Z" })[0].read_at).not.toBeNull();
  });

  it("says how long since the trainer spoke to a client", () => {
    expect(quietLine(5, "2026-10-20T08:00:00Z")).toBe("5 days since you last spoke");
    expect(quietLine(4, null)).toBe("No message from you yet (4 days)");
    expect(firstName("  Nancy van Wyk ")).toBe("Nancy");
  });
});
