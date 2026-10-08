import React, { useEffect, useState } from "react";
import { Image, Text, View, StyleSheet } from "react-native";
import { supabase } from "@/lib/supabase";
import { AVATAR_BUCKET, initialsFor } from "@/lib/avatars";

// Signed URLs for the private client-avatars bucket. An hour is plenty for a
// screen to stay open; screens re-sign whenever they load.
const SIGNED_URL_SECONDS = 60 * 60;

export async function signAvatarUrls(paths: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return {};
  const { data } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrls(unique, SIGNED_URL_SECONDS);
  const urls: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  }
  return urls;
}

type Props = {
  name: string | null | undefined;
  // Either a ready signed URL (lists sign in one batch) or the storage path,
  // which this component signs itself.
  url?: string | null;
  path?: string | null;
  size?: number;
};

export default function ClientAvatar({ name, url, path, size = 44 }: Props) {
  const [signed, setSigned] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (url || !path) {
      setSigned(null);
      return;
    }
    let cancelled = false;
    signAvatarUrls([path]).then((urls) => {
      if (!cancelled) setSigned(urls[path] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [url, path]);

  const uri = url ?? signed;
  const circle = { width: size, height: size, borderRadius: size / 2 };

  if (uri && !failed) {
    return <Image source={{ uri }} style={[styles.image, circle]} onError={() => setFailed(true)} />;
  }
  return (
    <View style={[styles.placeholder, circle]}>
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initialsFor(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: "#1E293B" },
  placeholder: { backgroundColor: "#334155", alignItems: "center", justifyContent: "center" },
  initials: { color: "#E2E8F0", fontWeight: "700" },
});
