import React from "react";
import Celebration from "@/components/Celebration";
import { percentUp } from "@/lib/achievements";
import type { ClientAchievement } from "@/types/database";

const kg = (n: number) => `${Number(n)}kg`;

// The gold achievement badge that pops up when a set earns one (0085), with the confetti gun.
export default function AchievementBadge({ badge, onClose }: { badge: ClientAchievement | null; onClose: () => void }) {
  return (
    <Celebration
      info={
        badge && {
          emoji: "🏅",
          title: "Gold achievement!",
          lines: [badge.exercise_name, `${kg(badge.from_weight)} → ${kg(badge.weight)} for ${badge.reps} reps`],
          highlight: `+${percentUp(Number(badge.from_weight), Number(badge.weight))}% stronger`,
          note: "Your coach has been told. Keep it up!",
        }
      }
      onClose={onClose}
    />
  );
}
