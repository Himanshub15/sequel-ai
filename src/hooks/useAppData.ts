import { invoke } from "@tauri-apps/api/core";

export async function saveAppData<T>(key: string, value: T): Promise<void> {
  await invoke("save_app_data", { key, value: JSON.stringify(value) });
}

export async function loadAppData<T>(key: string): Promise<T | null> {
  const raw = await invoke<string>("load_app_data", { key });
  if (raw === "null") return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
