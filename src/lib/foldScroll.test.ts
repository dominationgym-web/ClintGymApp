import { describe, expect, it } from "vitest";
import { FOLD_TOP_GAP, foldScrollTarget, type FoldTap } from "@/lib/foldScroll";

// Screen shows content from 1000 to 1700 (viewTop 100, 700 tall).
const base: FoldTap = {
  contentYBefore: 1300,
  contentYAfter: 1300,
  heightBefore: 3000,
  heightAfter: 3000,
  screenY: 400,
  viewTop: 100,
  viewHeight: 700,
};

describe("foldScrollTarget", () => {
  it("follows a heading pulled up when the drop-down above it closes", () => {
    expect(foldScrollTarget({ ...base, contentYAfter: 800, screenY: -100 })).toBe(800 - FOLD_TOP_GAP);
  });

  it("brings a heading near the bottom to the top when what opens runs off screen", () => {
    expect(foldScrollTarget({ ...base, heightAfter: 3600, screenY: 650 })).toBe(1300 - FOLD_TOP_GAP);
  });

  it("leaves the page alone when what opened fits on screen", () => {
    expect(foldScrollTarget({ ...base, heightAfter: 3150, screenY: 200 })).toBeNull();
  });

  it("leaves a heading already at the top where it is", () => {
    expect(foldScrollTarget({ ...base, heightAfter: 4000, screenY: 110 })).toBeNull();
  });

  it("ignores taps that change nothing, or only a little", () => {
    expect(foldScrollTarget(base)).toBeNull();
    expect(foldScrollTarget({ ...base, heightAfter: 3040, screenY: 780 })).toBeNull();
  });

  it("never scrolls above the start of the page", () => {
    expect(foldScrollTarget({ ...base, contentYAfter: 5, screenY: 50 })).toBe(0);
  });
});
