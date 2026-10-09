import React from "react";
import { supabase } from "@/lib/supabase";
import { TRAINER_LOGO_BUCKET } from "@/lib/trainers";
import ClientAvatar from "@/components/ClientAvatar";

// Logos live in a public bucket (0029), so no signing is needed.
export function trainerLogoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(TRAINER_LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
}

// A trainer's logo in a circle, or their initials until they upload one.
export default function TrainerLogo({
  name,
  path,
  size = 56,
}: {
  name: string;
  path: string | null | undefined;
  size?: number;
}) {
  return <ClientAvatar name={name} url={trainerLogoUrl(path)} size={size} />;
}
