import { describe, expect, it } from "vitest";
import { suggestionByline, suggestionsWithStatus } from "@/lib/suggestions";
import type { Suggestion } from "@/types/database";

const s = (id: string, status: Suggestion["status"]): Suggestion => ({
  id,
  author_id: "a",
  author_role: "client",
  author_name: "Sipho",
  body: "Dark mode",
  status,
  created_at: "2026-10-10T08:00:00Z",
});

describe("suggestions", () => {
  it("splits suggestions by status", () => {
    const list = [s("1", "new"), s("2", "good_idea"), s("3", "new")];
    expect(suggestionsWithStatus(list, "new").map((x) => x.id)).toEqual(["1", "3"]);
  });
  it("names who sent it and when", () => {
    expect(suggestionByline(s("1", "new"))).toMatch(/^Sipho \(client\) · 10 Oct/);
    expect(suggestionByline({ ...s("1", "new"), author_name: "" })).toMatch(/^Someone/);
  });
});
