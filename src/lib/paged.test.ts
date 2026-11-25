import { describe, expect, it } from "vitest";
import { fetchPaged, PAGE_SIZE } from "./paged";

describe("fetchPaged", () => {
  it("keeps asking until a short page comes back", async () => {
    const rows = Array.from({ length: 2 * PAGE_SIZE + 37 }, (_, i) => i);
    const asked: [number, number][] = [];
    const { data, error } = await fetchPaged(async (from, to) => {
      asked.push([from, to]);
      return { data: rows.slice(from, to + 1), error: null };
    });
    expect(error).toBeNull();
    expect(data).toEqual(rows);
    expect(asked).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("asks once when everything fits", async () => {
    let calls = 0;
    const { data } = await fetchPaged(async () => {
      calls++;
      return { data: [1, 2, 3], error: null };
    });
    expect(data).toEqual([1, 2, 3]);
    expect(calls).toBe(1);
  });

  it("stops on an error and passes it on", async () => {
    const { data, error } = await fetchPaged<number>(async () => ({ data: null, error: "boom" }));
    expect(data).toEqual([]);
    expect(error).toBe("boom");
  });
});
