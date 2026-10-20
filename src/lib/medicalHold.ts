import type { MedicalClearance } from "@/types/database";

// Clearing a serious-symptoms hold (0133; GRIZZ, 2026-10-20: "the trainer
// must confirm appropriate medical assessment or resolution before clearing
// the workout hold. Simply typing a note shouldn't be sufficient").

export const CLEARANCE_OPTIONS: { key: MedicalClearance; label: (name: string) => string }[] = [
  { key: "medical_cleared", label: (name) => `A doctor or other health professional assessed ${name} and cleared them to exercise` },
  { key: "reported_in_error", label: (name) => `${name} tapped it by mistake and has none of these symptoms` },
];

/** The serious symptoms the check-in asks about. */
export const SERIOUS_SYMPTOMS = [
  "Chest pain or tightness",
  "Fainting or nearly fainting",
  "New numbness or weakness",
  "Trouble speaking or seeing",
  "Sudden severe breathlessness",
];

export type ClearanceForm = { clearance: MedicalClearance | null; by: string; on: string; checked: boolean };

/** What's still missing before the hold can be cleared, or null when it's ready. */
export function clearanceProblem(form: ClearanceForm, reportedOn: string, today: string): string | null {
  if (!form.clearance) return "Pick how it was resolved.";
  if (!form.by.trim()) return form.clearance === "medical_cleared" ? "Say who assessed them, e.g. Dr Naidoo (GP)." : "Say who confirmed it with you.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.on)) return "Pick the date it was assessed.";
  if (form.on > today || form.on < reportedOn) return "The date must be between the report and today.";
  if (!form.checked) return "Tick that you've confirmed this yourself.";
  return null;
}
