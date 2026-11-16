import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { widgetView, type WidgetSession } from "@/lib/calendarWidget";
import { WIDGET_KEY_STORAGE } from "@/lib/widgetKeyStorage";
import { CalendarWidget, type CalendarWidgetProps } from "./CalendarWidget";

// Runs in the background when Android asks the widget to draw (added, every
// 30 minutes, or when the app asks after a change). It reads the trainer's
// sessions with the phone's widget key (0214), never the app's login.

export async function loadCalendarWidget(): Promise<CalendarWidgetProps> {
  const key = await AsyncStorage.getItem(WIDGET_KEY_STORAGE).catch(() => null);
  if (!key) return { kind: "message", text: "Log in to Daily Evolution as a trainer to see your sessions." };
  try {
    const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/rpc/widget_sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
        Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ""}`,
      },
      body: JSON.stringify({ p_key: key }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { ok: boolean; sessions?: WidgetSession[] };
    if (!data.ok) return { kind: "message", text: "Log in to Daily Evolution to see your sessions." };
    const view = widgetView(data.sessions ?? []);
    await AsyncStorage.setItem(`${WIDGET_KEY_STORAGE}.last`, JSON.stringify(data.sessions ?? [])).catch(() => {});
    return { kind: "view", view };
  } catch {
    // No signal: show the last list we had, worked out for the time now.
    const last = await AsyncStorage.getItem(`${WIDGET_KEY_STORAGE}.last`).catch(() => null);
    if (last) return { kind: "view", view: widgetView(JSON.parse(last) as WidgetSession[]) };
    return { kind: "message", text: "No connection. Tap to open the app." };
  }
}

export async function calendarWidgetTask({ widgetAction, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === "WIDGET_DELETED") return;
  renderWidget(<CalendarWidget {...await loadCalendarWidget()} />);
}
