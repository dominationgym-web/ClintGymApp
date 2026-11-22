import { navigationRef } from "@/navigation/navigationRef";
import type { NotificationRoute } from "@/lib/notificationRoutes";

// Tapping a notification opens the screen it is about (notificationRoutes.ts).

export function openRoute(route: NotificationRoute) {
  if (route.screen === "Inbox") navigationRef.navigate("Inbox", { messageId: route.messageId });
  else if (route.stack === "client" && route.screen === "Timers") navigationRef.navigate("Timers", { tab: "saved" });
  else if (route.screen === "VideoCheckIn" || route.screen === "VideoCheckIns") navigationRef.navigate(route.screen);
  else if (route.screen === "MySessions" || route.screen === "LiveSessions") navigationRef.navigate(route.screen, { tab: route.tab });
  else if (route.stack === "client") navigationRef.navigate("ClientTabs", { screen: route.screen }, { pop: true });
  else if (route.screen === "ClientDetail")
    navigationRef.navigate("ClientDetail", { clientId: route.clientId, tab: route.tab, open: route.open });
  else if (route.screen === "Billing" || route.screen === "Challenges" || route.screen === "Award" || route.screen === "AwardAdmin")
    navigationRef.navigate(route.screen);
  else if (route.screen === "TrainerProblems") navigationRef.navigate("TrainerProblems", { problemId: route.problemId });
  else navigationRef.navigate("TrainerTabs", { screen: route.screen }, { pop: true });
}

