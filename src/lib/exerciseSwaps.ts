// Change exercise (0047): the swaps a client made for today's workout, kept on
// the phone and only for the day, so tomorrow's program is back to normal.
// Maps a program_exercises row id to the exercise used instead.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLiveClient } from "@/lib/supabase";

export type ExerciseSwap = { id: string; name: string };
export type ExerciseSwaps = Record<string, ExerciseSwap>;

// In a live 1-on-1 session (0134) the trainer's phone keeps each client's
// ticks and swaps apart.
const scope = () => {
  const live = getLiveClient();
  return live ? `${live}:` : "";
};
const key = (date: string) => `exerciseSwaps:${scope()}${date}`;

export async function getExerciseSwaps(date: string): Promise<ExerciseSwaps> {
  try {
    const raw = await AsyncStorage.getItem(key(date));
    return raw ? (JSON.parse(raw) as ExerciseSwaps) : {};
  } catch {
    return {};
  }
}

export async function saveExerciseSwaps(date: string, swaps: ExerciseSwaps): Promise<void> {
  try {
    await AsyncStorage.setItem(key(date), JSON.stringify(swaps));
  } catch (e) {
    console.warn("Couldn't save the exercise swap", e);
  }
}

// Cardio blocks (0048) the client ticked off today, by program_exercises row id.
const cardioKey = (date: string) => `cardioDone:${scope()}${date}`;

export async function getCardioDone(date: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(cardioKey(date));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function saveCardioDone(date: string, ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(cardioKey(date), JSON.stringify(ids));
  } catch (e) {
    console.warn("Couldn't save the cardio tick", e);
  }
}

// Change exercise in the Health Reset workouts: like the program swaps, only
// for today and kept on the phone, but with the whole exercise (video and
// body part) since the Reset's exercises don't come from a program.
export type ResetSwap = { id: string; name: string; category: string | null; external_url: string | null };
const resetKey = (date: string) => `resetSwaps:${date}`;

export async function getResetSwaps(date: string): Promise<Record<string, ResetSwap>> {
  try {
    const raw = await AsyncStorage.getItem(resetKey(date));
    return raw ? (JSON.parse(raw) as Record<string, ResetSwap>) : {};
  } catch {
    return {};
  }
}

export async function saveResetSwaps(date: string, swaps: Record<string, ResetSwap>): Promise<void> {
  try {
    await AsyncStorage.setItem(resetKey(date), JSON.stringify(swaps));
  } catch (e) {
    console.warn("Couldn't save the exercise swap", e);
  }
}
