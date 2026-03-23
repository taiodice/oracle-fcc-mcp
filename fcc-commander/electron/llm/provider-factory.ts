// Multi-LLM provider factory using Vercel AI SDK
// Supports Claude, OpenAI, Gemini, DeepSeek, and Kimi

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import Store from "electron-store";
import { safeStorage } from "electron";

const secureStore = new Store({ name: "fcc-commander-secure" });

function getApiKey(provider: string): string {
  const stored = secureStore.get(`apiKey.${provider}`) as string | undefined;
  if (!stored) {
    throw new Error(
      `No API key configured for ${provider}. Go to Settings → LLM Providers to add your API key.`
    );
  }

  if (safeStorage.isEncryptionAvailable()) {
    try {
      const buffer = Buffer.from(stored, "base64");
      return safeStorage.decryptString(buffer);
    } catch {
      return stored; // Fallback for non-encrypted values
    }
  }
  return stored;
}

export function createLlmProvider(provider: string, model: string): LanguageModel {
  switch (provider) {
    case "claude": {
      const apiKey = getApiKey("claude");
      const client = createAnthropic({ apiKey });
      return client(model);
    }

    case "openai": {
      const apiKey = getApiKey("openai");
      const client = createOpenAI({ apiKey });
      return client(model);
    }

    case "gemini": {
      const apiKey = getApiKey("gemini");
      const client = createGoogleGenerativeAI({ apiKey });
      return client(model);
    }

    case "deepseek": {
      const apiKey = getApiKey("deepseek");
      const client = createOpenAI({
        baseURL: "https://api.deepseek.com/v1",
        apiKey,
      });
      return client(model);
    }

    case "kimi": {
      const apiKey = getApiKey("kimi");
      const client = createOpenAI({
        baseURL: "https://api.moonshot.cn/v1",
        apiKey,
      });
      return client(model);
    }

    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

export function hasApiKey(provider: string): boolean {
  const stored = secureStore.get(`apiKey.${provider}`) as string | undefined;
  return !!stored;
}
