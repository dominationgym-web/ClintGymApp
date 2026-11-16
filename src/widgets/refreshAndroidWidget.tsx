import React from "react";
import { requestWidgetUpdate } from "react-native-android-widget";
import { CALENDAR_WIDGET_NAME, CalendarWidget } from "./CalendarWidget";
import { loadCalendarWidget } from "./calendarWidgetTask";

// Only loaded once calendarWidgetSync has checked the native code is there.
export function refreshAndroidWidget() {
  requestWidgetUpdate({
    widgetName: CALENDAR_WIDGET_NAME,
    renderWidget: async () => <CalendarWidget {...await loadCalendarWidget()} />,
  }).catch(() => {});
}
