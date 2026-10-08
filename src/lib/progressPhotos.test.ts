import { describe, expect, it } from "vitest";
import { progressPhotoPath, progressPhotoStatus } from "@/lib/progressPhotos";

describe("progressPhotoStatus", () => {
  it("asks for a before photo when there are none", () => {
    expect(progressPhotoStatus(null, "2026-10-08")).toEqual({ kind: "before" });
  });

  it("is not due inside the 6 weeks", () => {
    expect(progressPhotoStatus("2026-10-08", "2026-10-08")).toEqual({ kind: "not_due", daysLeft: 42 });
    expect(progressPhotoStatus("2026-08-28", "2026-10-08")).toEqual({ kind: "not_due", daysLeft: 1 });
  });

  it("is due on the 42nd day and after", () => {
    expect(progressPhotoStatus("2026-08-27", "2026-10-08")).toEqual({ kind: "due", daysOverdue: 0 });
    expect(progressPhotoStatus("2026-08-20", "2026-10-08")).toEqual({ kind: "due", daysOverdue: 7 });
  });
});

describe("progressPhotoPath", () => {
  it("puts the file in the client's own folder", () => {
    expect(progressPhotoPath("abc", "image/jpeg", 5)).toBe("abc/progress-5.jpg");
  });
});
