import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Alert: {}, Platform: { OS: "web" } }));

const { webAlert } = await import("@/lib/webAlert");

const dialogs = (answers: { confirm?: boolean; prompt?: string | null } = {}) => ({
  alert: vi.fn(),
  confirm: vi.fn(() => answers.confirm ?? true),
  prompt: vi.fn(() => answers.prompt ?? null),
});

describe("webAlert", () => {
  it("shows a plain message", () => {
    const d = dialogs();
    webAlert(d, "Saved", "All done");
    expect(d.alert).toHaveBeenCalledWith("Saved\n\nAll done");
  });

  it("runs the action when OK is pressed, and cancel otherwise", () => {
    const go = vi.fn();
    const stop = vi.fn();
    webAlert(dialogs({ confirm: true }), "Remove?", undefined, [{ text: "Keep", style: "cancel", onPress: stop }, { text: "Remove", onPress: go }]);
    expect(go).toHaveBeenCalled();
    webAlert(dialogs({ confirm: false }), "Remove?", undefined, [{ text: "Keep", style: "cancel", onPress: stop }, { text: "Remove", onPress: go }]);
    expect(stop).toHaveBeenCalled();
  });

  it("lets the person pick from several choices by number", () => {
    const a = vi.fn();
    const b = vi.fn();
    webAlert(dialogs({ prompt: "2" }), "Send proof", undefined, [{ text: "Screenshot", onPress: a }, { text: "Photo", onPress: b }, { text: "Cancel", style: "cancel" }]);
    expect(b).toHaveBeenCalled();
    expect(a).not.toHaveBeenCalled();
  });
});
