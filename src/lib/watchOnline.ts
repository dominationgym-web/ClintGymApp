// "Watch examples online" links for moves with no demo clip in the app.
// A YouTube search rather than one video: it is short, opens in the YouTube
// app, and never breaks when a video is taken down.

// Spaces are %20, not +: the YouTube app on Android reads a + as a plus sign
// and searches for "copenhagen+plank" (GRIZZ, 2026-10-14: links not working).
/** youtube.com/results?search_query=copenhagen%20plank */
export function youtubeSearchUrl(term: string): string {
  const words = term
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  return `https://www.youtube.com/results?search_query=${words.join("%20")}`;
}
