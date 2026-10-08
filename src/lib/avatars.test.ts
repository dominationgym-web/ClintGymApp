import { describe, expect, it } from "vitest";
import { avatarContentType, avatarStoragePath, initialsFor } from "@/lib/avatars";

describe("initialsFor", () => {
  it("uses the first and last name", () => {
    expect(initialsFor("Thandi van der Merwe")).toBe("TM");
  });

  it("uses one letter for a single name", () => {
    expect(initialsFor("  sipho ")).toBe("S");
  });

  it("falls back to a question mark", () => {
    expect(initialsFor("")).toBe("?");
    expect(initialsFor(null)).toBe("?");
  });
});

describe("avatarStoragePath", () => {
  it("puts the file in the client's own folder", () => {
    expect(avatarStoragePath("abc-123", "image/png", 42)).toBe("abc-123/avatar-42.png");
  });

  it("treats unknown types as JPEG", () => {
    expect(avatarContentType(undefined)).toBe("image/jpeg");
    expect(avatarContentType("image/gif")).toBe("image/jpeg");
    expect(avatarStoragePath("abc-123", null, 7)).toBe("abc-123/avatar-7.jpg");
  });
});
