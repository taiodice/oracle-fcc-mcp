/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

console.log("[preload] Script starting...");
console.log("[preload] contextBridge available:", !!contextBridge);
console.log("[preload] ipcRenderer available:", !!ipcRenderer);

// Expose a secure API to the renderer process
try {
contextBridge.exposeInMainWorld("fccCommander", {
  // Tool operations
  listTools: () => ipcRenderer.invoke("tools:list"),
  executeTool: (name: string, args: Record<string, unknown>) =>
    ipcRenderer.invoke("tools:execute", name, args),

  // Tenant management
  configureTenants: (config: unknown) =>
    ipcRenderer.invoke("tenants:configure", config),
  listTenants: () => ipcRenderer.invoke("tenants:list"),

  // Chat
  sendChatMessage: (messages: unknown[], provider: string, model: string) =>
    ipcRenderer.invoke("chat:send", messages, provider, model),

  // Chat streaming events
  onChatStream: (callback: (chunk: string) => void) => {
    const handler = (_event: unknown, chunk: string) => callback(chunk);
    ipcRenderer.on("chat:stream", handler);
    return () => ipcRenderer.removeListener("chat:stream", handler);
  },
  onChatToolCall: (
    callback: (data: { toolName: string; args: unknown; result: unknown }) => void
  ) => {
    const handler = (_event: unknown, data: { toolName: string; args: unknown; result: unknown }) =>
      callback(data);
    ipcRenderer.on("chat:tool", handler);
    return () => ipcRenderer.removeListener("chat:tool", handler);
  },
  onChatDone: (callback: (response: string) => void) => {
    const handler = (_event: unknown, response: string) => callback(response);
    ipcRenderer.on("chat:done", handler);
    return () => ipcRenderer.removeListener("chat:done", handler);
  },
  onChatError: (callback: (error: string) => void) => {
    const handler = (_event: unknown, error: string) => callback(error);
    ipcRenderer.on("chat:error", handler);
    return () => ipcRenderer.removeListener("chat:error", handler);
  },

  // Config / Settings
  getConfig: (key: string) => ipcRenderer.invoke("config:get", key),
  setConfig: (key: string, value: unknown) =>
    ipcRenderer.invoke("config:set", key, value),
  deleteConfig: (key: string) => ipcRenderer.invoke("config:delete", key),

  // Provider status
  getConfiguredProviders: () => ipcRenderer.invoke("providers:configured"),

  // Encrypted storage (for API keys)
  setSecureValue: (key: string, value: string) =>
    ipcRenderer.invoke("config:setSecure", key, value),
  getSecureValue: (key: string) =>
    ipcRenderer.invoke("config:getSecure", key),

  // LLM key testing
  testApiKey: (provider: string, apiKey: string) =>
    ipcRenderer.invoke("llm:test-key", provider, apiKey),

  // Audit trail
  queryAudit: (query: Record<string, unknown>) =>
    ipcRenderer.invoke("audit:query", query),
  getAuditStats: () => ipcRenderer.invoke("audit:stats"),
  clearAudit: () => ipcRenderer.invoke("audit:clear"),
  exportAudit: (query: Record<string, unknown>) =>
    ipcRenderer.invoke("audit:export", query),

  // Auto-updater
  checkForUpdate: () => ipcRenderer.invoke("update:check"),
  downloadUpdate: () => ipcRenderer.invoke("update:download"),
  installUpdate: () => ipcRenderer.send("update:install"),
  onUpdateAvailable: (callback: (info: { version: string; releaseDate: string; releaseNotes?: string }) => void) => {
    const handler = (_e: unknown, info: { version: string; releaseDate: string; releaseNotes?: string }) => callback(info);
    ipcRenderer.on("update:available", handler);
    return () => ipcRenderer.removeListener("update:available", handler);
  },
  onUpdateProgress: (callback: (progress: { percent: number; transferred: number; total: number; bytesPerSecond: number }) => void) => {
    const handler = (_e: unknown, progress: { percent: number; transferred: number; total: number; bytesPerSecond: number }) => callback(progress);
    ipcRenderer.on("update:progress", handler);
    return () => ipcRenderer.removeListener("update:progress", handler);
  },
  onUpdateReady: (callback: (info: { version: string }) => void) => {
    const handler = (_e: unknown, info: { version: string }) => callback(info);
    ipcRenderer.on("update:ready", handler);
    return () => ipcRenderer.removeListener("update:ready", handler);
  },
  onUpdateError: (callback: (error: string) => void) => {
    const handler = (_e: unknown, error: string) => callback(error);
    ipcRenderer.on("update:error", handler);
    return () => ipcRenderer.removeListener("update:error", handler);
  },
});
console.log("[preload] exposeInMainWorld completed successfully");
} catch (err) {
  console.error("[preload] FAILED to expose API:", err);
}
