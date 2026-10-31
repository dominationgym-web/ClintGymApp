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

// Exercises added from YouTube (0171, GRIZZ 2026-10-31: a much bigger library
// with a picture of each move). Their external_url is a YouTube watch link
// rather than a clip file, so it can't go in the video player: it shows the
// video's thumbnail and opens YouTube when tapped.

/** The 11-character video id in a YouTube link (watch?v=, youtu.be/ or shorts/), or null for anything else. */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/** The video's thumbnail picture (YouTube makes one for every video). */
export function youtubeThumbnail(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/** A demo clip the in-app player can play: a clip file, not a YouTube link. */
export function playableClip(url: string | null | undefined): string | null {
  return url && !youtubeId(url) ? url : null;
}
