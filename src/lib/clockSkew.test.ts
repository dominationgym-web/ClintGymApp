import { describe, expect, it, vi } from "vitest";
import { isIssuedInFuture, retryIfIssuedInFuture } from "@/lib/clockSkew";

const future = { error: { message: "JWT issued at future" } };
const ok = { error: null };

describe("retryIfIssuedInFuture", () => {
  it("spots the error", () => {
    expect(isIssuedInFuture(future.error)).toBe(true);
    expect(isIssuedInFuture({ message: "duplicate key" })).toBe(false);
    expect(isIssuedInFuture(null)).toBe(false);
  });

  it("tries again until the token is accepted", async () => {
    const run = vi.fn().mockResolvedValueOnce(future).mockResolvedValueOnce(future).mockResolvedValueOnce(ok);
    await expect(retryIfIssuedInFuture(run, [0, 0, 0])).resolves.toBe(ok);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("does not retry other errors", async () => {
    const other = { error: { message: "permission denied" } };
    const run = vi.fn().mockResolvedValue(other);
    await expect(retryIfIssuedInFuture(run, [0, 0])).resolves.toBe(other);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("gives up after the last wait", async () => {
    const run = vi.fn().mockResolvedValue(future);
    await expect(retryIfIssuedInFuture(run, [0, 0])).resolves.toBe(future);
    expect(run).toHaveBeenCalledTimes(3);
  });
});
