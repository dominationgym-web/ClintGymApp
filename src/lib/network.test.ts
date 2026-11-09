import { describe, expect, it, vi } from "vitest";
import { friendlyAlert, isNetworkError, isNeverSentError, NO_INTERNET_TITLE, withNetworkRetry } from "./network";

const dns = new TypeError(
  'fetch failed: java.net.UnknownHostException: Unable to resolve host "vrasgqqubyurzoknsbgm.supabase.co": No address associated with hostname'
);

describe("network errors", () => {
  it("spots the Android DNS failure a trainer saw", () => {
    expect(isNeverSentError(dns)).toBe(true);
    expect(friendlyAlert("Couldn't sign up", { message: dns.message })[0]).toBe(NO_INTERNET_TITLE);
  });
  it("spots the iPhone and web wording", () => {
    expect(isNetworkError(new TypeError("Network request failed"))).toBe(true);
    expect(isNetworkError({ name: "AuthRetryableFetchError", message: "Failed to fetch" })).toBe(true);
  });
  it("leaves real errors alone", () => {
    expect(isNetworkError({ message: "Invalid login credentials" })).toBe(false);
    expect(friendlyAlert("Couldn't sign in", { message: "User already registered" })).toEqual([
      "Couldn't sign in",
      "User already registered",
    ]);
  });
});

describe("withNetworkRetry", () => {
  const ok = { ok: true } as Response;
  it("retries a lookup failure, even for a write", async () => {
    const base = vi.fn().mockRejectedValueOnce(dns).mockResolvedValueOnce(ok);
    const f = withNetworkRetry(base as unknown as typeof fetch, [0, 0]);
    await expect(f("https://x.supabase.co/rest/v1/trainers", { method: "POST" })).resolves.toBe(ok);
    expect(base).toHaveBeenCalledTimes(2);
  });
  it("retries a dropped login request", async () => {
    const base = vi.fn().mockRejectedValueOnce(new TypeError("Network request failed")).mockResolvedValueOnce(ok);
    const f = withNetworkRetry(base as unknown as typeof fetch, [0]);
    await expect(f("https://x.supabase.co/auth/v1/signup", { method: "POST" })).resolves.toBe(ok);
  });
  it("doesn't resend a dropped database write", async () => {
    const base = vi.fn().mockRejectedValue(new TypeError("Network request failed"));
    const f = withNetworkRetry(base as unknown as typeof fetch, [0, 0]);
    await expect(f("https://x.supabase.co/rest/v1/sets", { method: "POST" })).rejects.toThrow();
    expect(base).toHaveBeenCalledTimes(1);
  });
  it("gives up after the last try", async () => {
    const base = vi.fn().mockRejectedValue(dns);
    const f = withNetworkRetry(base as unknown as typeof fetch, [0, 0, 0]);
    await expect(f("https://x.supabase.co/rest/v1/x")).rejects.toBe(dns);
    expect(base).toHaveBeenCalledTimes(4);
  });
});
