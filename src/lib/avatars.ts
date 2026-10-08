// Plain helpers for client profile photos (see migration 0026). Kept free of
// Supabase and React Native imports so they can be unit tested.

export const AVATAR_BUCKET = "client-avatars";

// Shown in the placeholder circle when a client has no photo yet.
export function initialsFor(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

// The bucket only accepts these types, so anything else is sent as JPEG
// (which is what the picker produces once a photo is cropped).
export function avatarContentType(mimeType: string | null | undefined): string {
  const mime = (mimeType ?? "").toLowerCase();
  return mime in EXT_BY_MIME ? mime : "image/jpeg";
}

export function imageExtension(mimeType: string | null | undefined): string {
  return EXT_BY_MIME[avatarContentType(mimeType)];
}

// Each upload gets a fresh name so a phone that cached the old photo can't keep
// showing it; the app deletes the previous file afterwards.
export function avatarStoragePath(clientId: string, mimeType: string | null | undefined, now = Date.now()): string {
  return `${clientId}/avatar-${now}.${imageExtension(mimeType)}`;
}
