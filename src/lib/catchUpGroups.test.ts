import { describe, expect, it } from "vitest";
import { groupCatchUps } from "./catchUpGroups";

const r = (id: string, client_id: string | null, guest_name: string | null = null) => ({ id, s: { client_id, guest_name } });

describe("groupCatchUps", () => {
  it("puts each client's catch-ups in one group, in order", () => {
    const g = groupCatchUps([r("1", "sarah"), r("2", "tom"), r("3", "sarah"), r("4", "sarah")]);
    expect(g.map((x) => x.map((y) => y.id))).toEqual([["1", "3", "4"], ["2"]]);
  });
  it("groups diary names by name, ignoring case and spaces", () => {
    const g = groupCatchUps([r("1", null, "Jade"), r("2", null, " jade "), r("3", null, "Camilla")]);
    expect(g.map((x) => x.length)).toEqual([2, 1]);
  });
  it("keeps an app client apart from a diary name", () => {
    expect(groupCatchUps([r("1", "jade"), r("2", null, "jade")])).toHaveLength(2);
  });
});
