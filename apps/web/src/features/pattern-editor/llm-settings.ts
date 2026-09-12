export type LlmSettings = {
  apiKey: string;
  baseURL: string;
  model: string;
};

export const LLM_SETTINGS_STORAGE_KEY = "beadloom.llm";

export const defaultLlmSettings: LlmSettings = {
  apiKey: "",
  baseURL: "https://open.bigmodel.cn/api/paas/v4/",
  model: "glm-5.3-flash"
};

export function loadLlmSettings(): LlmSettings {
  if (typeof window === "undefined") {
    return defaultLlmSettings;
  }
  try {
    const raw = window.localStorage.getItem(LLM_SETTINGS_STORAGE_KEY);
    if (raw === null) {
      return defaultLlmSettings;
    }
    const parsed = JSON.parse(raw) as Partial<LlmSettings>;
    return {
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      baseURL: typeof parsed.baseURL === "string" && parsed.baseURL.length > 0 ? parsed.baseURL : defaultLlmSettings.baseURL,
      model: typeof parsed.model === "string" && parsed.model.length > 0 ? parsed.model : defaultLlmSettings.model
    };
  } catch {
    return defaultLlmSettings;
  }
}

export function saveLlmSettings(settings: LlmSettings): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(LLM_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
