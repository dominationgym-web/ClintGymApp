import { describe, expect, it } from "vitest";
import {
  groupIntoSets,
  isCompleteSet,
  openSetDate,
  progressPhotoPath,
  progressPhotoReminderAt,
  progressPhotoStatus,
  type ProgressPhotoAngle,
} from "@/lib/progressPhotos";

const photo = (takenOn: string, angle: ProgressPhotoAngle) => ({ id: `${takenOn}-${angle}`, takenOn, angle });
const fullSet = (d: string) => [photo(d, "front"), photo(d, "side"), photo(d, "back")];

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
    expect(progressPhotoPath("abc", "side", "image/jpeg", 5)).toBe("abc/progress-side-5.jpg");
  });
});

describe("groupIntoSets", () => {
  it("groups by date, oldest first, one photo per angle", () => {
    const sets = groupIntoSets([photo("2026-10-08", "front"), ...fullSet("2026-08-27")]);
    expect(sets.map((s) => s.takenOn)).toEqual(["2026-08-27", "2026-10-08"]);
    expect(isCompleteSet(sets[0])).toBe(true);
    expect(isCompleteSet(sets[1])).toBe(false);
    expect(sets[1].byAngle.front?.id).toBe("2026-10-08-front");
  });
});

describe("openSetDate", () => {
  it("starts today when there are no photos", () => {
    expect(openSetDate([], "2026-10-08")).toBe("2026-10-08");
  });

  it("keeps a recent unfinished set open", () => {
    const sets = groupIntoSets([photo("2026-10-05", "front")]);
    expect(openSetDate(sets, "2026-10-08")).toBe("2026-10-05");
  });

  it("starts a new set once the last one is finished", () => {
    expect(openSetDate(groupIntoSets(fullSet("2026-10-05")), "2026-10-08")).toBe("2026-10-08");
  });

  it("starts a new set when an unfinished one is a week old", () => {
    const sets = groupIntoSets([photo("2026-10-01", "front")]);
    expect(openSetDate(sets, "2026-10-08")).toBe("2026-10-08");
  });
});

describe("progressPhotoReminderAt", () => {
  it("schedules nothing before the client has opted in", () => {
    expect(progressPhotoReminderAt(null, new Date(2026, 9, 8, 12))).toBeNull();
  });

  it("is 9am local on the day the next set is due", () => {
    // 2026-10-08 + 42 days = 2026-11-19.
    const at = progressPhotoReminderAt("2026-10-08", new Date(2026, 9, 8, 12));
    expect(at).toEqual(new Date(2026, 10, 19, 9, 0, 0, 0));
  });

  it("still schedules on the due day before 9am", () => {
    expect(progressPhotoReminderAt("2026-10-08", new Date(2026, 10, 19, 7))).toEqual(new Date(2026, 10, 19, 9));
  });

  it("schedules nothing once that moment has passed, since the banner takes over", () => {
    expect(progressPhotoReminderAt("2026-10-08", new Date(2026, 10, 19, 9, 30))).toBeNull();
  });
});
