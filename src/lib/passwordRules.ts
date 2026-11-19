// Kept apart from loginHelp.ts so it can be tested without the Supabase client.
/** Problems with a new password someone picks for themselves, or null when it's fine. */
export function passwordProblem(password: string, again: string): string | null {
  if (password.length < 8) return "Use at least 8 letters or numbers.";
  if (password !== again) return "The two passwords don't match.";
  return null;
}

/** The emailed reset code with anything but digits taken out (spaces, a pasted "Code: "). */
export function cleanResetCode(typed: string): string {
  return typed.replace(/\D/g, "").slice(0, 10);
}

/** Plain words for what went wrong while emailing or checking a reset code. */
export function resetCodeProblem(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (/expired|invalid|otp|token/.test(m)) return "That code is wrong or too old. Check the newest email, or tap Send me a new code.";
  if (/only request this after|rate limit|too many/.test(m)) return "A code was sent a moment ago. Wait a minute, check your email (and spam), then try again.";
  if (/different from the old/.test(m)) return "That's already your password. Just log in with it.";
  if (/sending|smtp|email/.test(m)) return "We couldn't send the email right now. Tap Ask my trainer instead.";
  return message || "Please try again.";
}
