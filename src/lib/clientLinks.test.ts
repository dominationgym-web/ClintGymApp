import { describe, expect, it } from "vitest";
import { clientsToAsk, nameMatch, rankNames } from "./clientLinks";

describe("calendar name matches", () => {
  it("scores full name, first name, nicknames and surnames", () => {
    expect(nameMatch("Sharde Naidoo", "Sharde Naidoo")).toBe(3);
    expect(nameMatch("sharde", "Sharde Naidoo")).toBe(2);
    expect(nameMatch("Rob V", "Rob Venter")).toBe(2);
    expect(nameMatch("Rob K", "Rob Venter")).toBe(0);
    expect(nameMatch("Rob", "Robert Smith")).toBe(1);
    expect(nameMatch("Behari", "Quraish Behari")).toBe(1);
    expect(nameMatch("Q", "Quraish Behari")).toBe(0);
    expect(nameMatch("Wasi", "Sherwyn Naidoo")).toBe(0);
    expect(nameMatch("Shardé", "Sharde")).toBe(3);
  });

  it("puts the likely name first", () => {
    const names = [
      { key: "wasi", name: "Wasi", coming: 3 },
      { key: "sharde", name: "Sharde", coming: 1 },
      { key: "rob v", name: "Rob V", coming: 2 },
    ];
    expect(rankNames(names, "Sharde Smith").map((n) => n.name)).toEqual(["Sharde", "Wasi", "Rob V"]);
  });
});

describe("who the pop-up asks about", () => {
  const now = new Date(2026, 10, 10, 9, 0);
  const names = [{ key: "sharde", name: "Sharde", coming: 2 }];
  it("asks about new sign-ups, and older clients only with a matching name", () => {
    const clients = [
      { id: "new", name: "Thabo M", created_at: new Date(2026, 10, 9).toISOString() },
      { id: "old-match", name: "Sharde Smith", created_at: new Date(2026, 8, 1).toISOString() },
      { id: "old", name: "Linda K", created_at: new Date(2026, 8, 1).toISOString() },
    ];
    expect(clientsToAsk(clients, names, now).map((c) => c.id)).toEqual(["new", "old-match"]);
    expect(clientsToAsk(clients, [], now)).toEqual([]);
  });
});
