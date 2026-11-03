// Picking screenshots or export files to bring history in (0142, 0190).
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { ImportFile } from "@/lib/historyImport";

/** Up to 10 screenshots from the phone's photos, as base64. Empty if cancelled. */
export async function pickScreenshots(): Promise<ImportFile[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Permission needed", "Allow photo access to choose the screenshots.");
    return [];
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: 10,
    quality: 0.6,
    base64: true,
  });
  if (result.canceled) return [];
  return result.assets
    .filter((a) => a.base64)
    .map((a, i) => ({ name: a.fileName ?? `screenshot-${i + 1}.jpg`, type: a.mimeType ?? "image/jpeg", data: a.base64! }));
}

/** The laptop app can take any export file: CSV, PDF or pictures (web only). */
export function pickWebFiles(onPicked: (files: ImportFile[]) => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.accept = ".csv,.tsv,.txt,.json,.pdf,image/*";
  input.onchange = async () => {
    const picked = Array.from(input.files ?? []).slice(0, 10);
    const files = await Promise.all(
      picked.map(
        (f) =>
          new Promise<ImportFile>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ name: f.name, type: f.type, data: String(reader.result).split(",")[1] ?? "" });
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(f);
          }),
      ),
    );
    onPicked(files.filter((f) => f.data));
  };
  input.click();
}
