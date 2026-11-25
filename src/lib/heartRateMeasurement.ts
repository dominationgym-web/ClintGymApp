// Reading the standard Bluetooth Heart Rate Measurement (0x2A37) that every
// chest strap and broadcasting watch sends (src/lib/heartRateStrap.ts).
import { decode } from "base64-arraybuffer";

/**
 * Reads a Heart Rate Measurement (Bluetooth 0x2A37): the first byte's lowest
 * bit says whether the heart rate is one byte or two.
 */
export function parseHeartRate(bytes: Uint8Array): number | null {
  if (bytes.length < 2) return null;
  const wide = (bytes[0] & 0x01) === 1;
  if (wide && bytes.length < 3) return null;
  const hr = wide ? bytes[1] | (bytes[2] << 8) : bytes[1];
  return hr >= 25 && hr <= 250 ? hr : null;
}

export function parseHeartRateBase64(value: string | null | undefined): number | null {
  if (!value) return null;
  try {
    return parseHeartRate(new Uint8Array(decode(value)));
  } catch {
    return null;
  }
}
