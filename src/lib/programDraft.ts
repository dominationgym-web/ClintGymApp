// The program a trainer is part way through building, kept on the phone so
// going back by mistake doesn't lose it. It stays until they save the program
// or tap "Start over".
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ExercisePlace } from "@/lib/exerciseFilter";
import { DEFAULT_WARM_UP, type DraftSession } from "@/lib/programs";

export type ProgramDraft = {
  name: string;
  howTo: string;
  warmUp: string;
  sessions: DraftSession[];
  activeDay: number;
  place: ExercisePlace;
};

const key = (trainerId: string) => `programDraft:${trainerId}`;

/** True when nothing has been typed or picked yet, so there's nothing to keep. */
export function isEmptyDraft(draft: ProgramDraft): boolean {
  return (
    !draft.name.trim() &&
    !draft.howTo.trim() &&
    (draft.warmUp.trim() === "" || draft.warmUp === DEFAULT_WARM_UP) &&
    draft.sessions.every((s) => !s.title.trim() && s.exercises.every((e) => e.kind === "cardio" || !e.exerciseId))
  );
}

export async function loadProgramDraft(trainerId: string): Promise<ProgramDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(key(trainerId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as ProgramDraft;
    return Array.isArray(draft.sessions) ? draft : null;
  } catch {
    return null;
  }
}

export async function saveProgramDraft(trainerId: string, draft: ProgramDraft): Promise<void> {
  try {
    if (isEmptyDraft(draft)) await AsyncStorage.removeItem(key(trainerId));
    else await AsyncStorage.setItem(key(trainerId), JSON.stringify(draft));
  } catch (e) {
    console.warn("Couldn't keep the program draft", e);
  }
}

export async function clearProgramDraft(trainerId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(trainerId));
  } catch (e) {
    console.warn("Couldn't clear the program draft", e);
  }
}
