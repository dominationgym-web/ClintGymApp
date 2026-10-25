// Where tapping a phone notification takes you. The server puts a `type` (and
// usually the client's id) in each push's data (0034, 0056, 0058, 0075, 0117 and
// others); this turns it into a screen for the person who got it. Anything
// not listed just opens the app where it was.

export type NotificationRoute =
  | { stack: "client"; screen: "CheckIn" | "Habits" | "Exercises" | "Profile" }
  | { stack: "trainer"; screen: "Dashboard" | "Clients" | "Trainers" }
  | { stack: "trainer"; screen: "Billing" | "Challenges" }
  | { stack: "trainer"; screen: "TrainerProblems"; problemId?: string }
  | { stack: "trainer"; screen: "ClientDetail"; clientId: string; tab?: "training"; open?: "videos" | "history" };

const CLIENT_SCREENS: Record<string, "CheckIn" | "Habits" | "Exercises" | "Profile"> = {
  coach_message: "CheckIn",
  client_activated: "CheckIn",
  catch_up: "Exercises",
  plan_next_week: "Exercises",
  deload_due: "Exercises",
  achievement: "Exercises",
  habit_win: "Habits",
  challenge_started: "Habits",
  plan_expiring: "Profile",
  weigh_in: "Profile",
  plan_expired: "Profile",
};

// Pushes to the trainer about one client: open that client.
const TRAINER_CLIENT_TYPES = new Set([
  "checkin_wellbeing",
  "problem_reply",
  "workout_session",
  "workout_star",
  "achievement",
  "habit_win",
]);
const TRAINER_TRAINING_TYPES = new Set(["training_level", "deload_due", "plan_next_week"]);

export function notificationRoute(
  data: Record<string, unknown> | null | undefined,
  role: "client" | "trainer" | null
): NotificationRoute | null {
  const type = typeof data?.type === "string" ? data.type : null;
  if (!type || !role) return null;
  if (role === "client") {
    const screen = CLIENT_SCREENS[type];
    return screen ? { stack: "client", screen } : null;
  }
  const raw = data?.clientId ?? data?.client_id;
  const clientId = typeof raw === "string" && raw ? raw : null;
  if (type === "form_video" && clientId) return { stack: "trainer", screen: "ClientDetail", clientId, tab: "training", open: "videos" };
  if (type === "history_import" && clientId) return { stack: "trainer", screen: "ClientDetail", clientId, tab: "training", open: "history" };
  if (type === "payment_proof") return clientId ? { stack: "trainer", screen: "Clients" } : { stack: "trainer", screen: "Billing" };
  if (type === "client_signup" || type === "client_plan_expired" || type === "client_plan_expiring") return { stack: "trainer", screen: "Clients" };
  if (TRAINER_TRAINING_TYPES.has(type) && clientId) return { stack: "trainer", screen: "ClientDetail", clientId, tab: "training" };
  if (TRAINER_CLIENT_TYPES.has(type) && clientId) return { stack: "trainer", screen: "ClientDetail", clientId };
  if (type === "planning_reminder") return { stack: "trainer", screen: "Dashboard" };
  if (type === "trainer_problem" || type === "trainer_problem_reply") {
    const problemId = typeof data?.problemId === "string" && data.problemId ? data.problemId : undefined;
    return { stack: "trainer", screen: "TrainerProblems", problemId };
  }
  if (type === "challenge_done" || type === "challenge_shared") return { stack: "trainer", screen: "Challenges" };
  if (type === "trainer_signup" || type === "referral_signup") return { stack: "trainer", screen: "Trainers" };
  return null;
}
