// Kept apart from loginHelp.ts so it can be tested without the Supabase client.
/** Problems with a new password someone picks for themselves, or null when it's fine. */
export function passwordProblem(password: string, again: string): string | null {
  if (password.length < 8) return "Use at least 8 letters or numbers.";
  if (password !== again) return "The two passwords don't match.";
  return null;
}
