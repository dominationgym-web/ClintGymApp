// When the phone can't reach the server (no signal, wifi with no internet,
// or a Private DNS / ad blocker that blocks supabase.co) the raw error reads
// like "fetch failed: java.net.UnknownHostException: Unable to resolve host
// ...". Trainers and clients should see plain words instead (GRIZZ,
// 2026-11-09: a UK trainer couldn't sign up and got that raw error).

export const NO_INTERNET_TITLE = "No internet connection";
export const NO_INTERNET_MESSAGE =
  "Check your connection and try again. If your internet works, switch between wifi and mobile data, or turn off Private DNS or any ad blocker on your phone.";

// The request never left the phone: it couldn't find or connect to the server.
// Safe to send again, because the server never saw it.
const NEVER_SENT =
  /unable to resolve host|unknownhost|no address associated|enotfound|eai_again|getaddrinfo|econnrefused|failed to connect|could not connect|cannot find host|hostname could not be found|internet connection appears to be offline|not connected to the internet|network is unreachable|enetunreach/i;

// Any failure to reach the server, including ones where the request may
// have got there (a dropped connection, a timeout).
const ANY_NETWORK =
  /network request failed|failed to fetch|fetch failed|load failed|networkerror|network error|timed out|timeout|connection (was )?(reset|lost|closed|abort)|socket|econnreset|ssl|retryablefetcherror/i;

function text(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  const e = error as { message?: unknown; name?: unknown; cause?: unknown };
  const parts = [e.name, e.message].filter((p) => typeof p === "string") as string[];
  if (e.cause) parts.push(text(e.cause));
  return parts.join(" ");
}

export function isNeverSentError(error: unknown): boolean {
  return NEVER_SENT.test(text(error));
}

export function isNetworkError(error: unknown): boolean {
  const t = text(error);
  return NEVER_SENT.test(t) || ANY_NETWORK.test(t);
}

/** The message to show: plain words for a connection problem, else the error's own. */
export function friendlyErrorMessage(error: unknown, fallback = "Please try again."): string {
  if (isNetworkError(error)) return NO_INTERNET_MESSAGE;
  const t = typeof error === "string" ? error : (error as { message?: string } | null)?.message;
  return t || fallback;
}

/** Title + message for an Alert, swapping the title too when it's a connection problem. */
export function friendlyAlert(title: string, error: unknown, fallback?: string): [string, string] {
  if (isNetworkError(error)) return [NO_INTERNET_TITLE, NO_INTERNET_MESSAGE];
  return [title, friendlyErrorMessage(error, fallback)];
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wraps fetch so a request that couldn't reach the server is tried again a
 * few times before giving up (a phone switching between wifi and mobile
 * data often fails the first lookup). Requests that never left the phone
 * are always retried; other dropped requests only when sending twice is
 * harmless (reads, and the login server, which the sign-up screens already
 * handle being asked twice).
 */
export function withNetworkRetry(
  baseFetch: typeof fetch,
  delaysMs: number[] = [1000, 2000, 4000],
): typeof fetch {
  return async (input, init) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    const safeToResend = method === "GET" || method === "HEAD" || /\/auth\/v1\//.test(url ?? "");
    for (let attempt = 0; ; attempt++) {
      try {
        return await baseFetch(input, init);
      } catch (error) {
        const retry =
          attempt < delaysMs.length &&
          !init?.signal?.aborted &&
          (isNeverSentError(error) || (safeToResend && isNetworkError(error)));
        if (!retry) throw error;
        await wait(delaysMs[attempt]);
      }
    }
  };
}
