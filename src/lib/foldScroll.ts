// When a tap opens a drop-down (tap-to-open heading), GRIZZ wants its heading
// at the top of the screen so he reads downward, never having to scroll back
// up to find where it starts (2026-10-30). This decides, from where the tapped
// heading sat before and after the tap, whether the page should scroll to it.

export type FoldTap = {
  // Heading's position inside the scrolled content, before and after the tap.
  contentYBefore: number;
  contentYAfter: number;
  // Total content height before and after the tap.
  heightBefore: number;
  heightAfter: number;
  // Heading's position on screen after the tap, and the visible window.
  screenY: number;
  viewTop: number;
  viewHeight: number;
};

// How far a heading must move up before we follow it (small shifts are noise).
const MOVE_PX = 24;
// How much new content counts as "a drop-down opened" rather than a tiny change.
const GROW_PX = 80;
// Gap left above the tapped heading text once scrolled, so the edge of its
// box shows too.
export const FOLD_TOP_GAP = 28;

// Returns the scroll offset to move to, or null to leave the page alone.
export function foldScrollTarget(t: FoldTap): number | null {
  const top = Math.max(0, t.contentYAfter - FOLD_TOP_GAP);
  // Something above closed (e.g. another drop-down) and pulled the heading
  // up, often off the top of the screen.
  if (t.contentYBefore - t.contentYAfter > MOVE_PX) return top;
  if (t.screenY < t.viewTop) return top;
  // The heading opened in place but what opened runs past the bottom of the
  // screen: bring the heading up so the reading starts at the top.
  const grew = t.heightAfter - t.heightBefore;
  if (grew > GROW_PX) {
    const below = t.screenY - t.viewTop;
    const nearTop = below <= FOLD_TOP_GAP + MOVE_PX;
    const fits = below + grew <= t.viewHeight;
    if (!nearTop && !fits) return top;
  }
  return null;
}
