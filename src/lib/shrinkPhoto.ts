// Shrinks a photo before upload so it takes less of the free plan's 1 GB of
// Storage. A full-body progress photo only needs to fill a phone screen, so the
// long side is capped at 1600px and it's saved as a JPEG.
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

export const MAX_PHOTO_SIDE = 1600;

// The new size to scale to, or null when the photo is already small enough.
export function shrunkSize(width: number, height: number, maxSide = MAX_PHOTO_SIDE): { width: number; height: number } | null {
  const longSide = Math.max(width, height);
  if (!width || !height || longSide <= maxSide) return null;
  const scale = maxSide / longSide;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

// Returns the uri and mime type of the photo to upload.
export async function shrinkPhoto(uri: string, width: number, height: number): Promise<{ uri: string; mimeType: string }> {
  const context = ImageManipulator.manipulate(uri);
  const size = shrunkSize(width, height);
  if (size) context.resize(size);
  const image = await context.renderAsync();
  const result = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  return { uri: result.uri, mimeType: "image/jpeg" };
}
