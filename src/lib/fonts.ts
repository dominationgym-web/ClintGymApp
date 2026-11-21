import * as Font from "expo-font";

// The heading font (GRIZZ, 2026-11-21 design review): Barlow Semi Condensed
// Bold, a strong sporty look for screen titles and big headings, the same as
// the website. Body text stays the phone's own font. If it can't load, the
// phone's bold font is used, so nothing ever breaks.
export const HEADING_FONT = "BarlowSemiCondensed_700Bold";

let loaded = false;

export async function loadFonts(): Promise<void> {
  try {
    await Promise.race([
      Font.loadAsync({ [HEADING_FONT]: require("../../assets/fonts/BarlowSemiCondensed_700Bold.ttf") }),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
    loaded = Font.isLoaded(HEADING_FONT);
  } catch {
    loaded = false;
  }
}

/** Style for a heading: the heading font once loaded, else plain bold. Slightly bigger, as the font is narrow. */
export function headingFont(size: number): { fontFamily?: string; fontWeight: "700" | "normal"; fontSize: number; letterSpacing?: number } {
  return loaded ? { fontFamily: HEADING_FONT, fontWeight: "normal", fontSize: Math.round(size * 1.12), letterSpacing: 0.2 } : { fontWeight: "700", fontSize: size };
}
