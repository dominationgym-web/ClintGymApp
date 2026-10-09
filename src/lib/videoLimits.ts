// Limits on training-proof videos, so they fit the free plan's 1 GB of Storage
// and its 50 MB per-file cap. The training-videos bucket enforces the size too
// (0032); checking here gives the client a clear message instead of an error.
export const MAX_VIDEO_SECONDS = 60;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

// A reason to refuse the video, or null when it's fine. Duration is in
// milliseconds, as expo-image-picker reports it; missing values aren't checked.
export function videoProblem(durationMs: number | null | undefined, fileSize: number | null | undefined): string | null {
  // A second of slack, since a 60s recording can report as 60.4s.
  if (durationMs && durationMs > (MAX_VIDEO_SECONDS + 1) * 1000) {
    return `Please keep training videos to ${MAX_VIDEO_SECONDS} seconds or less. You can trim it in your phone's gallery first.`;
  }
  if (fileSize && fileSize > MAX_VIDEO_BYTES) {
    return "This video is too big to upload (over 50 MB). Try a shorter clip.";
  }
  return null;
}
