import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Every library exercise's demo clip by exercise id, loaded once and shared.
// For the small clips beside exercises on the trainer's laptop layout.
let cache: Record<string, string> | null = null;
let loading: Promise<Record<string, string>> | null = null;

function loadClips() {
  loading ??= Promise.resolve(
    supabase
      .from("exercises")
      .select("id, external_url")
      .not("external_url", "is", null)
      .then(({ data }) => {
        cache = Object.fromEntries((data ?? []).map((e) => [e.id as string, e.external_url as string]));
        return cache;
      }),
  ).catch(() => {
    loading = null;
    return {};
  });
  return loading;
}

export function useExerciseClips(enabled: boolean): Record<string, string> {
  const [clips, setClips] = useState<Record<string, string>>(cache ?? {});
  useEffect(() => {
    if (!enabled || cache) return;
    let live = true;
    loadClips().then((c) => live && setClips(c));
    return () => {
      live = false;
    };
  }, [enabled]);
  return clips;
}
