// Remembers that a page was opened from the top-right menu, so going back from
// that page shows the menu again (one step back) instead of the tab behind it.
let pending = false;

export function markOpenedFromMenu() {
  pending = true;
}

/** True once, when coming back from a page opened from the menu. */
export function takeMenuReturn(): boolean {
  const was = pending;
  pending = false;
  return was;
}

/** For a page that sends the person somewhere else instead of back to the menu. */
export function cancelMenuReturn() {
  pending = false;
}
