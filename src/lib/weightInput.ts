/**
 * Reads a weight the client typed. South African phones type a comma as the
 * decimal mark ("22,5"), which `Number()` rejects, so a comma is read as a dot.
 * Blank, unreadable or not above zero is `null` (saved as no weight).
 */
export function parseWeight(text: string | null | undefined): number | null {
  const cleaned = (text ?? "").trim().replace(",", ".");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** "0" typed for an exercise done with bodyweight only (GRIZZ, 2026-10-21): a valid answer, saved as no weight. */
export function isBodyweight(text: string | null | undefined): boolean {
  const cleaned = (text ?? "").trim().replace(",", ".");
  return cleaned !== "" && Number(cleaned) === 0;
}
