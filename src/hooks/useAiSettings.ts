import { useState, useEffect, useCallback } from "react";
import type { AiSettings } from "../types";
import { saveAppData, loadAppData } from "./useAppData";

const AI_SETTINGS_KEY = "ai_settings";

const DEFAULT_SETTINGS: AiSettings = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o",
};

export function useAiSettings() {
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    loadAppData<AiSettings>(AI_SETTINGS_KEY).then((data) => {
      if (data) setSettings(data);
    });
  }, []);

  const updateSettings = useCallback(async (updated: AiSettings) => {
    setSettings(updated);
    await saveAppData(AI_SETTINGS_KEY, updated);
  }, []);

  const isConfigured =
    settings.baseUrl.trim() !== "" && settings.model.trim() !== "";

  return { settings, updateSettings, isConfigured };
}
