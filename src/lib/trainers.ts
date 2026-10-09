// Plain helpers for multi-trainer support (see migration 0029). Kept free of
// Supabase and React Native imports so they can be unit tested.
import { imageExtension } from "@/lib/avatars";
import type { EftDetails } from "@/types/database";

export const TRAINER_LOGO_BUCKET = "trainer-logos";

// The order and wording the payment screen uses, and the trainer edits.
export const EFT_FIELDS: { key: keyof EftDetails; label: string }[] = [
  { key: "account_holder", label: "Account holder" },
  { key: "bank", label: "Bank" },
  { key: "account_type", label: "Account type" },
  { key: "branch_code", label: "Branch code" },
  { key: "account_number", label: "Account number" },
];

// Only the fields the trainer actually filled in, ready to show.
export function eftRows(details: EftDetails | null | undefined): { label: string; value: string }[] {
  return EFT_FIELDS.map(({ key, label }) => ({ label, value: (details?.[key] ?? "").trim() })).filter(
    (row) => row.value.length > 0
  );
}

// Codes are stored upper case without spaces; people type them however.
export function normalizeJoinCode(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

export function trainerDisplayName(trainer: { name: string; business_name?: string | null }): string {
  const business = trainer.business_name?.trim();
  return business ? business : trainer.name;
}

// A fresh name per upload, so phones that cached the old logo don't keep it.
export function logoStoragePath(trainerId: string, mimeType: string | null | undefined, now = Date.now()): string {
  return `${trainerId}/logo-${now}.${imageExtension(mimeType)}`;
}
