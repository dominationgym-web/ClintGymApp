// iPhone home-screen calendar widget (GRIZZ, 2026-11-16). Built by
// @bacons/apple-targets when EAS makes the iOS build. Reads the trainer's
// widget key from the shared App Group (see src/lib/calendarWidgetSync.ts).
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  name: "CalendarWidget",
  displayName: "Today's sessions",
  bundleIdentifier: ".calendarwidget",
  deploymentTarget: "17.0",
  frameworks: ["SwiftUI", "WidgetKit"],
  colors: {
    $accent: "#D4AF37",
    $widgetBackground: "#0F172A",
  },
  entitlements: {
    "com.apple.security.application-groups": config.ios.entitlements["com.apple.security.application-groups"],
  },
});
