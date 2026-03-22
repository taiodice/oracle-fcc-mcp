// Type declarations for the Electron IPC bridge exposed via preload.ts

export interface ToolInfo {
  name: string;
  description: string;
  inputSchema: object;
}

export interface ToolResult {
  success: boolean;
  message: string;
  data?: unknown;
  warnings?: string[];
  jobId?: number;
  duration_ms?: number;
}

export interface BrandConfig {
  appName: string;
  shortName: string;
  companyName: string;
  colors: {
    primary: string;
    primaryLight: string;
    accent: string;
    coral: string;
    success: string;
    warning: string;
    error: string;
    background: string;
    surface: string;
    surfaceElevated: string;
    sidebar: string;
    sidebarText: string;
    text: string;
    textSecondary: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  welcome: {
    title: string;
    subtitle: string;
  };
}

export type AuditCategory =
  | "approval" | "period" | "data" | "substitution_variable"
  | "consolidation" | "journal" | "ownership" | "intercompany"
  | "metadata" | "connection" | "job" | "other";

export interface AuditEntry {
  id: string;
  timestamp: string;
  source: "direct" | "chat";
  toolName: string;
  category: AuditCategory;
  args: Record<string, unknown>;
  resultSummary: string;
  success: boolean;
  durationMs: number;
  tenant?: string;
  user?: string;
}

export interface AuditQuery {
  category?: AuditCategory;
  toolName?: string;
  success?: boolean;
  fromDate?: string;
  toDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AuditQueryResult {
  entries: AuditEntry[];
  total: number;
}

export interface AuditStats {
  totalEntries: number;
  successCount: number;
  failureCount: number;
  byCategory: Record<string, number>;
  lastActivity?: string;
}

export interface FccCommanderAPI {
  listTools: () => Promise<ToolInfo[]>;
  executeTool: (name: string, args: Record<string, unknown>) => Promise<ToolResult>;
  configureTenants: (config: unknown) => Promise<{ success: boolean }>;
  listTenants: () => Promise<Array<{ name: string; url: string; app: string; auth: string; isDefault: boolean }>>;
  sendChatMessage: (messages: Array<{ role: string; content: string }>, provider: string, model: string) => Promise<{ success: boolean; text?: string; error?: string }>;
  onChatStream: (callback: (chunk: string) => void) => () => void;
  onChatToolCall: (callback: (data: { toolName: string; args: unknown; result: unknown }) => void) => () => void;
  onChatDone: (callback: (response: string) => void) => () => void;
  onChatError: (callback: (error: string) => void) => () => void;
  getConfiguredProviders: () => Promise<string[]>;
  getConfig: (key: string) => Promise<unknown>;
  setConfig: (key: string, value: unknown) => Promise<{ success: boolean }>;
  deleteConfig: (key: string) => Promise<{ success: boolean }>;
  setSecureValue: (key: string, value: string) => Promise<{ success: boolean }>;
  getSecureValue: (key: string) => Promise<string | null>;
  testApiKey: (provider: string, apiKey: string) => Promise<{ success: boolean; message: string }>;

  // Audit trail
  queryAudit: (query: AuditQuery) => Promise<AuditQueryResult>;
  getAuditStats: () => Promise<AuditStats>;
  clearAudit: () => Promise<{ success: boolean }>;
  exportAudit: (query: AuditQuery) => Promise<{ success: boolean; message: string }>;

  // Auto-updater
  checkForUpdate: () => Promise<{ success: boolean; updateInfo?: { version: string } | null; error?: string }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => void;
  onUpdateAvailable: (callback: (info: { version: string; releaseDate: string; releaseNotes?: string }) => void) => () => void;
  onUpdateProgress: (callback: (progress: { percent: number; transferred: number; total: number; bytesPerSecond: number }) => void) => () => void;
  onUpdateReady: (callback: (info: { version: string }) => void) => () => void;
  onUpdateError: (callback: (error: string) => void) => () => void;
}

declare global {
  interface Window {
    fccCommander: FccCommanderAPI;
  }
}
