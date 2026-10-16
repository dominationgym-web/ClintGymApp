// Supabase's login server stamps a new token with its own clock, and the
// database server checks that stamp with a slightly different clock. Used in
// the same second (straight after signUp or signIn), the token can look like
// it was "issued at future" and the request is refused. A few seconds later
// it goes through, so wait and try again.

type Result = { error: { message: string } | null };

export function isIssuedInFuture(
  error: { message?: string } | null | undefined,
): boolean {
  return !!error?.message && /issued at future/i.test(error.message);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function retryIfIssuedInFuture<T extends Result>(
  run: () => PromiseLike<T>,
  delaysMs: number[] = [1500, 3000, 5000],
): Promise<T> {
  let result = await run();
  for (const delay of delaysMs) {
    if (!isIssuedInFuture(result.error)) break;
    await wait(delay);
    result = await run();
  }
  return result;
}
