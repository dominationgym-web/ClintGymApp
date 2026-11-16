import { registerWidgetTaskHandler } from "react-native-android-widget";
import { calendarWidgetTask } from "./calendarWidgetTask";

// Only loaded from index.js once it's checked the native code is there.
registerWidgetTaskHandler(calendarWidgetTask);
