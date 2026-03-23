// Renderer-side LLM provider metadata (no API keys — those stay in main process)

export interface LlmModel {
  id: string;
  name: string;
  contextWindow?: string;
}

export interface LlmProvider {
  id: string;
  name: string;
  shortName: string;
  defaultModel: string;
  models: LlmModel[];
  color: string;
  badge: string;
}

export const LLM_PROVIDERS: LlmProvider[] = [
  {
    id: "claude",
    name: "Claude (Anthropic)",
    shortName: "Claude",
    defaultModel: "claude-sonnet-4-20250514",
    color: "#D97706",
    badge: "AN",
    models: [
      { id: "claude-opus-4-20250514", name: "Opus 4", contextWindow: "200K" },
      { id: "claude-sonnet-4-20250514", name: "Sonnet 4", contextWindow: "200K" },
      { id: "claude-haiku-4-5-20251001", name: "Haiku 4.5", contextWindow: "200K" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    shortName: "OpenAI",
    defaultModel: "gpt-4o",
    color: "#10A37F",
    badge: "OA",
    models: [
      { id: "gpt-4o", name: "GPT-4o", contextWindow: "128K" },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo", contextWindow: "128K" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", contextWindow: "128K" },
    ],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    shortName: "Gemini",
    defaultModel: "gemini-2.0-flash",
    color: "#4285F4",
    badge: "GG",
    models: [
      { id: "gemini-2.0-flash", name: "2.0 Flash", contextWindow: "1M" },
      { id: "gemini-2.0-pro", name: "2.0 Pro", contextWindow: "1M" },
      { id: "gemini-1.5-pro", name: "1.5 Pro", contextWindow: "2M" },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    shortName: "DeepSeek",
    defaultModel: "deepseek-chat",
    color: "#6366F1",
    badge: "DS",
    models: [
      { id: "deepseek-chat", name: "Chat", contextWindow: "64K" },
      { id: "deepseek-reasoner", name: "Reasoner", contextWindow: "64K" },
    ],
  },
  {
    id: "kimi",
    name: "Kimi (Moonshot)",
    shortName: "Kimi",
    defaultModel: "moonshot-v1-8k",
    color: "#8B5CF6",
    badge: "KM",
    models: [
      { id: "moonshot-v1-8k", name: "v1 8K", contextWindow: "8K" },
      { id: "moonshot-v1-32k", name: "v1 32K", contextWindow: "32K" },
      { id: "moonshot-v1-128k", name: "v1 128K", contextWindow: "128K" },
    ],
  },
];

export function getProvider(id: string): LlmProvider | undefined {
  return LLM_PROVIDERS.find((p) => p.id === id);
}

export function getModel(providerId: string, modelId: string) {
  return getProvider(providerId)?.models.find((m) => m.id === modelId);
}
