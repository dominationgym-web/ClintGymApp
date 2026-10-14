// "Watch examples online" links for moves with no demo clip in the app.
// A YouTube search rather than one video: it is short, opens in the YouTube
// app, and never breaks when a video is taken down.

/** youtube.com/results?search_query=copenhagen+plank */
export function youtubeSearchUrl(term: string): string {
  const words = term
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  return `https://www.youtube.com/results?search_query=${words.join("+")}`;
}
