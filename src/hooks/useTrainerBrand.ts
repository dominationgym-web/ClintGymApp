import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { trainerDisplayName } from "@/lib/trainers";
import { trainerLogoUrl } from "@/components/TrainerLogo";

export type TrainerBrand = { name: string; logoUrl: string | null };

// The trainer's logo and name, remembered on the phone so the log-in screen
// shows them next time (GRIZZ, 2026-11-04: "like it's the trainer's own app").
// Before anyone has logged in on a phone, the log-in screen shows the DE logo.
export const LOGIN_BRAND_KEY = "loginBrand";

export async function loadLoginBrand(): Promise<TrainerBrand | null> {
  try {
    const raw = await AsyncStorage.getItem(LOGIN_BRAND_KEY);
    const parsed = raw ? (JSON.parse(raw) as TrainerBrand) : null;
    return parsed?.name ? parsed : null;
  } catch {
    return null;
  }
}

/** The signed-in person's trainer (a trainer's own details), saved for the log-in screen. */
export function useTrainerBrand(): TrainerBrand | null {
  const { trainer, client } = useAuth();
  const [brand, setBrand] = useState<TrainerBrand | null>(null);
  const trainerId = trainer?.id ?? client?.trainer_id ?? null;
  useEffect(() => {
    if (!trainerId) return;
    let cancelled = false;
    const use = (t: { name: string; business_name?: string | null; logo_path: string | null }) => {
      const next = { name: trainerDisplayName(t), logoUrl: trainerLogoUrl(t.logo_path) };
      if (cancelled) return;
      setBrand(next);
      AsyncStorage.setItem(LOGIN_BRAND_KEY, JSON.stringify(next)).catch(() => {});
    };
    if (trainer) use(trainer);
    else
      supabase
        .from("trainers")
        .select("name, business_name, logo_path")
        .eq("id", trainerId)
        .maybeSingle()
        .then(({ data }) => data && use(data));
    return () => {
      cancelled = true;
    };
  }, [trainerId, trainer?.logo_path, trainer?.business_name, trainer?.name]);
  return brand;
}
