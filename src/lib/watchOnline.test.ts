import { describe, expect, it } from "vitest";
import { playableClip, youtubeId, youtubeSearchUrl, youtubeThumbnail } from "@/lib/watchOnline";

describe("youtubeSearchUrl", () => {
  it("joins words with %20", () => {
    expect(youtubeSearchUrl("Copenhagen Plank")).toBe("https://www.youtube.com/results?search_query=copenhagen%20plank");
  });
});

describe("youtubeId", () => {
  it("reads the id from watch, short and youtu.be links", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=nCh8VfWY5_g")).toBe("nCh8VfWY5_g");
    expect(youtubeId("https://www.youtube.com/watch?feature=share&v=-ZIpSoTRsuE")).toBe("-ZIpSoTRsuE");
    expect(youtubeId("https://youtu.be/nCh8VfWY5_g")).toBe("nCh8VfWY5_g");
    expect(youtubeId("https://www.youtube.com/shorts/nCh8VfWY5_g")).toBe("nCh8VfWY5_g");
  });
  it("is null for clip files and nothing", () => {
    expect(youtubeId("https://x.supabase.co/storage/v1/object/public/exercise-library/squat.mp4")).toBeNull();
    expect(youtubeId(null)).toBeNull();
  });
});

describe("playableClip", () => {
  it("keeps clip files and leaves out YouTube links", () => {
    expect(playableClip("https://x.supabase.co/a.mp4")).toBe("https://x.supabase.co/a.mp4");
    expect(playableClip("https://www.youtube.com/watch?v=nCh8VfWY5_g")).toBeNull();
    expect(playableClip(undefined)).toBeNull();
  });
});

describe("youtubeThumbnail", () => {
  it("is the video's picture", () => {
    expect(youtubeThumbnail("nCh8VfWY5_g")).toBe("https://i.ytimg.com/vi/nCh8VfWY5_g/hqdefault.jpg");
  });
});
