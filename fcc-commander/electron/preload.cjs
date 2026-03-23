// Preload script — must be CommonJS for Electron compatibility
// This file is NOT processed by Vite; it's copied directly to dist-electron/
const { contextBridge, ipcRenderer } = require("electron");

console.log("[preload] Script starting...");

contextBridge.exposeInMainWorld("fccCommander", {
  // Branding
  getBranding: () => ipcRenderer.invoke("branding:get"),

  // Tool operations
  listTools: () => ipcRenderer.invoke("tools:list"),
  executeTool: (name, args) => ipcRenderer.invoke("tools:execute", name, args),

  // Tenant management
  configureTenants: (config) => ipcRenderer.invoke("tenants:configure", config),
  listTenants: () => ipcRenderer.invoke("tenants:list"),

  // Chat
  sendChatMessage: (messages, provider, model) =>
    ipcRenderer.invoke("chat:send", messages, provider, model),

  // Chat streaming events
  onChatStream: (callback) => {
    const handler = (_event, chunk) => callback(chunk);
    ipcRenderer.on("chat:stream", handler);
    return () => ipcRenderer.removeListener("chat:stream", handler);
  },
  onChatToolCall: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("chat:tool", handler);
    return () => ipcRenderer.removeListener("chat:tool", handler);
  },
  onChatDone: (callback) => {
    const handler = (_event, response) => callback(response);
    ipcRenderer.on("chat:done", handler);
    return () => ipcRenderer.removeListener("chat:done", handler);
  },
  onChatError: (callback) => {
    const handler = (_event, error) => callback(error);
    ipcRenderer.on("chat:error", handler);
    return () => ipcRenderer.removeListener("chat:error", handler);
  },

  // Config / Settings
  getConfig: (key) => ipcRenderer.invoke("config:get", key),
  setConfig: (key, value) => ipcRenderer.invoke("config:set", key, value),
  deleteConfig: (key) => ipcRenderer.invoke("config:delete", key),

  // Provider status
  getConfiguredProviders: () => ipcRenderer.invoke("providers:configured"),

  // Encrypted storage (for API keys)
  setSecureValue: (key, value) => ipcRenderer.invoke("config:setSecure", key, value),
  getSecureValue: (key) => ipcRenderer.invoke("config:getSecure", key),

  // LLM key testing
  testApiKey: (provider, apiKey) => ipcRenderer.invoke("llm:test-key", provider, apiKey),

  // Audit trail
  queryAudit: (query) => ipcRenderer.invoke("audit:query", query),
  getAuditStats: () => ipcRenderer.invoke("audit:stats"),
  clearAudit: () => ipcRenderer.invoke("audit:clear"),
  exportAudit: (query) => ipcRenderer.invoke("audit:export", query),

  // Auto-updater
  checkForUpdate: () => ipcRenderer.invoke("update:check"),
  downloadUpdate: () => ipcRenderer.invoke("update:download"),
  installUpdate: () => ipcRenderer.send("update:install"),
  onUpdateAvailable: (callback) => {
    const handler = (_e, info) => callback(info);
    ipcRenderer.on("update:available", handler);
    return () => ipcRenderer.removeListener("update:available", handler);
  },
  onUpdateProgress: (callback) => {
    const handler = (_e, progress) => callback(progress);
    ipcRenderer.on("update:progress", handler);
    return () => ipcRenderer.removeListener("update:progress", handler);
  },
  onUpdateReady: (callback) => {
    const handler = (_e, info) => callback(info);
    ipcRenderer.on("update:ready", handler);
    return () => ipcRenderer.removeListener("update:ready", handler);
  },
  onUpdateError: (callback) => {
    const handler = (_e, error) => callback(error);
    ipcRenderer.on("update:error", handler);
    return () => ipcRenderer.removeListener("update:error", handler);
  },
});

console.log("[preload] fccCommander API exposed successfully");
