import { useState } from "react";
import type { AiSettings } from "../types";

type AiSettingsModalProps = {
  settings: AiSettings;
  onSave: (settings: AiSettings) => void;
  onClose: () => void;
};

const PRESETS = [
  { label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o" },
  {
    label: "Ollama (local)",
    baseUrl: "http://localhost:11434/v1",
    model: "llama3",
  },
  {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.1-70b-versatile",
  },
  {
    label: "Together",
    baseUrl: "https://api.together.xyz/v1",
    model: "meta-llama/Llama-3-70b-chat-hf",
  },
  {
    label: "NVIDIA NIM",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    model: "moonshotai/kimi-k2.5",
  },
  {
    label: "MiniMax",
    baseUrl: "https://api.minimaxi.chat/v1",
    model: "MiniMax-M1-80k",
  },
];

export default function AiSettingsModal({
  settings,
  onSave,
  onClose,
}: AiSettingsModalProps) {
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [model, setModel] = useState(settings.model);

  const handleSave = () => {
    onSave({ baseUrl: baseUrl.trim(), apiKey, model: model.trim() });
    onClose();
  };

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setBaseUrl(preset.baseUrl);
    setModel(preset.model);
  };

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalContent" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <span className="modalTitle">AI Settings</span>
          <button type="button" className="modalClose" onClick={onClose}>
            &#x2715;
          </button>
        </div>

        <div className="modalBody">
          <div className="aiPresets">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className={`aiPresetBtn ${baseUrl === p.baseUrl ? "active" : ""}`}
                onClick={() => applyPreset(p)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <label className="formLabel">
            Base URL
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </label>

          <label className="formLabel">
            API Key
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-... (leave empty for Ollama)"
            />
          </label>

          <label className="formLabel">
            Model
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="gpt-4o"
            />
          </label>
        </div>

        <div className="modalFooter">
          <button type="button" className="ghostAction" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primaryAction" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
