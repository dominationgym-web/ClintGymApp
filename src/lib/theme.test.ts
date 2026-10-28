import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

vi.mock("react-native", () => ({
  StyleSheet: { create: (s: unknown) => s },
  Platform: { OS: "ios" },
  Appearance: { getColorScheme: () => "light" },
}));
const store: Record<string, string> = {};
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => store[k] ?? null,
    setItem: async (k: string, v: string) => {
      store[k] = v;
    },
  },
}));
const theme = await import("@/lib/theme");
const { lightBg, lightBorder, lightText, themedStyles, setThemePreference, getThemeMode, themeText } = theme;

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

describe("light mode colours", () => {
  it("turns the navy page and cards light and the white text dark", () => {
    expect(lightBg("#0F172A")).toBe("#EEF2F7");
    expect(lightBg("#1E293B")).toBe("#FFFFFF");
    expect(lightText("#fff")).toBe("#0F172A");
    expect(lightText("white")).toBe("#0F172A");
    expect(lightText("#94A3B8")).toBe("#475569");
  });

  it("keeps bright buttons, black video areas and see-through overlays", () => {
    expect(lightBg("#22C55E")).toBe("#22C55E");
    expect(lightBg("#D4AF37")).toBe("#D4AF37");
    expect(lightBg("#000")).toBe("#000");
    expect(lightBg("rgba(0,0,0,0.6)")).toBe("rgba(0,0,0,0.6)");
    expect(lightText("#0F172A")).toBe("#0F172A");
  });

  it("turns dark tinted boxes into pale tints", () => {
    expect(luminance(lightBg("#14532D"))).toBeGreaterThan(0.7);
    expect(luminance(lightBg("#422006"))).toBeGreaterThan(0.7);
  });

  it("darkens accent text until it reads on white", () => {
    for (const c of ["#22C55E", "#4ADE80", "#F59E0B", "#FBBF24", "#F87171", "#38BDF8", "#D4AF37", "#FDE68A", "#A78BFA"]) {
      expect(contrast(lightText(c), "#FFFFFF")).toBeGreaterThan(4.5);
    }
  });

  it("gives a colour mapped twice the same answer", () => {
    const all = ["#fff", "#0F172A", "#1E293B", "#334155", "#94A3B8", "#CBD5E1", "#22C55E", "#14532D", "#475569", "#64748B"];
    for (const c of all) {
      expect(lightText(lightText(c))).toBe(lightText(c));
      expect(lightBg(lightBg(c))).toBe(lightBg(c));
      expect(lightBorder(lightBorder(c))).toBe(lightBorder(c));
    }
  });
});

describe("themedStyles", () => {
  it("hands out the style for the current mode, except kept ones", async () => {
    const styles = themedStyles(
      { card: { backgroundColor: "#1E293B", padding: 4 }, title: { color: "#fff" }, onVideo: { color: "#fff" } },
      ["onVideo"]
    );
    await setThemePreference("dark");
    expect(styles.card).toEqual({ backgroundColor: "#1E293B", padding: 4 });
    expect(themeText("#fff")).toBe("#fff");
    await setThemePreference("light");
    expect(getThemeMode()).toBe("light");
    expect(styles.card).toEqual({ backgroundColor: "#FFFFFF", padding: 4 });
    expect(styles.title).toEqual({ color: "#0F172A" });
    expect(styles.onVideo).toEqual({ color: "#fff" });
    await setThemePreference("system");
    expect(getThemeMode()).toBe("light");
    await setThemePreference("dark");
  });

  it("is used for every screen's styles, so none stay dark in light mode", () => {
    const files = execSync("grep -rl 'StyleSheet.create(' src App.tsx || true", { encoding: "utf8" })
      .split("\n")
      .filter((f) => f && !f.endsWith(".test.ts") && !/src\/lib\/theme\.ts$|src\/components\/TextInput\.tsx$/.test(f))
      .filter((f) => readFileSync(f, "utf8").includes("StyleSheet.create("));
    expect(files).toEqual([]);
  });
});
