// Change exercise (0047): the swaps a client made for today's workout, kept on
// the phone and only for the day, so tomorrow's program is back to normal.
// Maps a program_exercises row id to the exercise used instead.
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ExerciseSwap = { id: string; name: string };
export type ExerciseSwaps = Record<string, ExerciseSwap>;

const key = (date: string) => `exerciseSwaps:${date}`;

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
