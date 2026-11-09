import React from "react";
import { Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BRAND_GOLD } from "@/lib/brand";
import { themeText } from "@/lib/theme";

// Plain gold line icons in place of the emoji that menus and fold headings
// used (critique, 2026-11-04: emoji everywhere looked busy). An emoji with no
// match here still shows as it is.
const LINE: Record<string, keyof typeof Ionicons.glyphMap> = {
  "🥗": "restaurant-outline",
  "💊": "medkit-outline",
  "🌙": "moon-outline",
  "🌸": "flower-outline",
  "🌿": "leaf-outline",
  "📹": "videocam-outline",
  "🎥": "videocam-outline",
  "⏱": "stopwatch-outline",
  "⏱️": "stopwatch-outline",
  "💡": "bulb-outline",
  "❓": "help-circle-outline",
  "🏋️": "barbell-outline",
  "🏋": "barbell-outline",
  "🛡️": "shield-outline",
  "🛡": "shield-outline",
  "🏆": "trophy-outline",
  "📥": "download-outline",
  "📚": "library-outline",
  "📘": "book-outline",
  "🛠": "construct-outline",
  "🛠️": "construct-outline",
  "⚙️": "settings-outline",
  "⚙": "settings-outline",
  "✨": "sparkles-outline",
  "💳": "card-outline",
  "🎯": "locate-outline",
  "🚩": "flag-outline",
  "🙋": "hand-left-outline",
  "📈": "trending-up-outline",
  "🩹": "bandage-outline",
  "🧭": "compass-outline",
  "🧠": "bulb-outline",
  "🥄": "nutrition-outline",
  "🚦": "pulse-outline",
  "🗓️": "calendar-outline",
  "📅": "calendar-outline",
  "🗄": "archive-outline",
  "🔑": "key-outline",
  "🔬": "flask-outline",
  "📸": "camera-outline",
  "📝": "create-outline",
  "📄": "document-text-outline",
  "📏": "resize-outline",
  "📋": "clipboard-outline",
  "📊": "stats-chart-outline",
  "💬": "chatbubble-outline",
  "👤": "person-outline",
  "🏠": "home-outline",
  "🏃": "walk-outline",
  "🏁": "flag-outline",
  "🌗": "contrast-outline",
  "⌚": "watch-outline",
  "🤝": "people-outline",
  "👥": "people-outline",
  "🧘": "body-outline",
  "😴": "bed-outline",
  "🔁": "repeat-outline",
  "🧾": "receipt-outline",
  "📉": "trending-down-outline",
  "🚀": "rocket-outline",
  "🥩": "nutrition-outline",
  "🔋": "battery-charging-outline",
  "💪": "fitness-outline",
  "🔥": "flame-outline",
  "▶": "play-outline",
  "🍳": "egg-outline",
  "🥣": "cafe-outline",
  "🍽️": "restaurant-outline",
  "🍽": "restaurant-outline",
  "🔢": "calculator-outline",
  "🍚": "nutrition-outline",
  "🥦": "leaf-outline",
  "💧": "water-outline",
  "🩺": "medkit-outline",
  "🧪": "flask-outline",
  "🛌": "bed-outline",
  "☀️": "sunny-outline",
  "🍎": "nutrition-outline",
  "🧂": "nutrition-outline",
  "📖": "book-outline",
  "🚫": "ban-outline",
  "🛏️": "bed-outline",
  "🔄": "repeat-outline",
};

export function hasLineIcon(icon: string): boolean {
  return !!LINE[icon];
}

export default function LineIcon({ icon, size = 20, color }: { icon: string; size?: number; color?: string }) {
  const name = LINE[icon];
  if (!name) return <Text style={{ fontSize: size }}>{icon}</Text>;
  return <Ionicons name={name} size={size} color={themeText(color ?? BRAND_GOLD)} />;
}
