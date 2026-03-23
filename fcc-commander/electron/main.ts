import { app, BrowserWindow, ipcMain, safeStorage, nativeImage } from "electron";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { FccClientManager } from "../core/fcc-client-manager.js";
import { AppConfig } from "../core/config.js";
import { TenantConfig, ToolResult } from "../core/types.js";
import { registerAllTools, RegisteredTool } from "./ipc/tool-registry.js";
import { setupChatHandler } from "./ipc/chat-handler.js";
import { setupConfigHandler, getConfigValue, getSecureValueDirect } from "./ipc/config-handler.js";
import { setupUpdateHandler } from "./ipc/update-handler.js";
import { BRAND, BrandConfig } from "./branding.js";
import { hasApiKey } from "./llm/provider-factory.js";
import { auditLogger } from "./audit/audit-logger.js";
import { setupAuditHandlers } from "./audit/audit-handlers.js";
import { generateText, type LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

function testKeyCreateModel(provider: string, apiKey: string): LanguageModel | null {
  switch (provider) {
    case "claude":
      return createAnthropic({ apiKey })("claude-sonnet-4-20250514");
    case "openai":
      return createOpenAI({ apiKey })("gpt-4o-mini");
    case "gemini":
      return createGoogleGenerativeAI({ apiKey })("gemini-2.0-flash");
    case "deepseek":
      return createOpenAI({ baseURL: "https://api.deepseek.com/v1", apiKey })("deepseek-chat");
    case "kimi":
      return createOpenAI({ baseURL: "https://api.moonshot.cn/v1", apiKey })("moonshot-v1-8k");
    default:
      return null;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let manager: FccClientManager | null = null;
let tools: RegisteredTool[] = [];

// Load app icon from branding directory (PNG or ICO)
function loadAppIcon(): Electron.NativeImage | undefined {
  const iconCandidates = [
    path.join(__dirname, "../branding/default/icon.ico"),
    path.join(__dirname, "../branding/default/icon.png"),
  ];
  for (const p of iconCandidates) {
    if (fs.existsSync(p)) return nativeImage.createFromPath(p);
  }
  return undefined;
}

function createWindow() {
  const icon = loadAppIcon();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: BRAND.appName,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  // Graceful show when ready
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  // Dev or production
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "bottom" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function initializeToolEngine() {
  tools = registerAllTools(manager!);
}

/** Auto-restore tenant config from saved settings on startup. */
function autoRestoreTenants() {
  try {
    const saved = getConfigValue("tenantConfig") as Record<string, string> | undefined;
    if (!saved?.url) return;

    const password = getSecureValueDirect("tenant.password") || "";
    const tenantId = (saved.appName || "FCCS").toLowerCase().replace(/\s+/g, "-") || "default";
    const config: AppConfig = {
      defaultTenant: tenantId,
      tenants: {
        [tenantId]: {
          url: saved.url.replace(/\/+$/, ""),
          app: saved.appName || "FCCS",
          auth: (saved.authMethod as "basic" | "oauth") || "basic",
          username: saved.username,
          password,
        },
      },
    };
    manager = new FccClientManager(config);
    initializeToolEngine();
    console.log(`[startup] Auto-restored tenant "${tenantId}" with ${tools.length} tools`);
  } catch (err) {
    console.error("[startup] Failed to auto-restore tenants:", err);
  }
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

function setupIpcHandlers() {
  // Tool listing
  ipcMain.handle("tools:list", () =>
    tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }))
  );

  // Direct tool execution (for dashboard views) — with audit logging
  ipcMain.handle(
    "tools:execute",
    async (_event, toolName: string, args: Record<string, unknown>) => {
      const tool = tools.find((t) => t.name === toolName);
      if (!tool) {
        return { success: false, message: `Unknown tool: ${toolName}` } as ToolResult;
      }
      const start = Date.now();
      try {
        const result = await tool.handler(args);
        auditLogger.log({
          source: "direct",
          toolName,
          args,
          result,
          success: true,
          durationMs: Date.now() - start,
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        auditLogger.log({
          source: "direct",
          toolName,
          args,
          result: { message },
          success: false,
          durationMs: Date.now() - start,
        });
        return { success: false, message } as ToolResult;
      }
    }
  );

  // Test LLM API key by making a minimal request
  ipcMain.handle("llm:test-key", async (_event, provider: string, apiKey: string) => {
    console.log(`[llm:test-key] Testing ${provider} key (${apiKey.slice(0, 8)}...)`);
    try {
      const model = testKeyCreateModel(provider, apiKey);
      if (!model) {
        console.log(`[llm:test-key] Unknown provider: ${provider}`);
        return { success: false, message: `Unknown provider: ${provider}` };
      }

      console.log(`[llm:test-key] Sending test request to ${provider}...`);
      await generateText({ model, prompt: "Reply with OK", maxTokens: 5 });
      console.log(`[llm:test-key] ${provider} key is valid`);
      return { success: true, message: `${provider} API key is valid.` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[llm:test-key] ${provider} error:`, msg);
      if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("invalid")) {
        return { success: false, message: "Invalid API key." };
      }
      if (msg.includes("403") || msg.includes("Forbidden")) {
        return { success: false, message: "API key lacks required permissions." };
      }
      return { success: false, message: msg.length > 150 ? msg.slice(0, 150) + "..." : msg };
    }
  });

  // Tenant management
  ipcMain.handle("tenants:configure", (_event, config: AppConfig) => {
    manager = new FccClientManager(config);
    initializeToolEngine();
    return { success: true };
  });

  ipcMain.handle("tenants:list", () => {
    if (!manager) return [];
    return manager.listTenants();
  });

  // Check which providers have API keys configured
  ipcMain.handle("providers:configured", () => {
    const providerIds = ["claude", "openai", "gemini", "deepseek", "kimi"];
    return providerIds.filter((id) => hasApiKey(id));
  });

  // Setup chat, config, update, and audit handlers
  setupChatHandler(ipcMain, () => tools);
  setupConfigHandler(ipcMain);
  setupUpdateHandler(() => mainWindow);
  setupAuditHandlers(ipcMain);
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  autoRestoreTenants();
  setupIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
