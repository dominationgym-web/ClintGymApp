import { describe, expect, it } from "vitest";
import { MAX_VIDEO_BYTES, videoProblem } from "./videoLimits";

describe("videoProblem", () => {
  it("accepts a short, small video", () => {
    expect(videoProblem(45_000, 8_000_000)).toBeNull();
  });

  it("allows a 60 second recording that reports a little over", () => {
    expect(videoProblem(60_400, 8_000_000)).toBeNull();
  });

  it("refuses a video longer than 60 seconds", () => {
    expect(videoProblem(90_000, 8_000_000)).toMatch(/60 seconds/);
  });

  it("refuses a file over 50 MB", () => {
    expect(videoProblem(30_000, MAX_VIDEO_BYTES + 1)).toMatch(/50 MB/);
  });

  it("doesn't refuse when the phone doesn't report length or size", () => {
    expect(videoProblem(null, undefined)).toBeNull();
  });
});
