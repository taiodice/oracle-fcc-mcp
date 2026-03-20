// Core HTTP client for Oracle EPM FCC REST API
// Mirrors EpmClient.cs patterns from Captain-EPM-Addin

import { buildBasicAuthHeader } from "./auth/basic-auth.js";
import { OAuthDeviceFlow, OAuthConfig, DeviceCodeChallenge } from "./auth/oauth-device.js";
import { TenantConfig, JobStatus, JOB_STATUS_LABELS } from "./types.js";

// Common FCC error code translations
const ERROR_TRANSLATIONS: Record<string, string> = {
  "EPMIE-12503": "The specified period is locked and cannot be modified.",
  "EPMIE-12504": "The specified period is already closed.",
  "EPMIE-12505": "The specified entity does not exist in the application.",
  "EPMIE-12506": "Consolidation is already running for this entity/period.",
  "EPMIE-00001": "Authentication failed — check your username and password.",
  "EPMIE-00002": "Authorization failed — insufficient permissions for this operation.",
};

export class FccClient {
  private baseUrl: string;
  public readonly app: string;
  private authMode: "basic" | "oauth";
  private basicHeader?: string;
  private oauthFlow?: OAuthDeviceFlow;

  constructor(config: TenantConfig) {
    this.baseUrl = sanitizeUrl(config.url);
    this.app = config.app;
    this.authMode = config.auth;

    if (config.auth === "basic") {
      if (!config.username || !config.password) {
        throw new Error("Basic auth requires username and password");
      }
      this.basicHeader = buildBasicAuthHeader(config.username, config.password);
    } else {
      if (!config.idcs_url || !config.client_id) {
        throw new Error("OAuth auth requires idcs_url and client_id");
      }
      const oauthConfig: OAuthConfig = {
        idcs_url: config.idcs_url,
        client_id: config.client_id,
        client_secret: config.client_secret,
      };
      this.oauthFlow = new OAuthDeviceFlow(oauthConfig);
    }
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────

  async getAuthHeader(): Promise<string> {
    if (this.authMode === "basic") {
      return this.basicHeader!;
    }
    return this.oauthFlow!.getAuthHeader();
  }

  async initiateOAuth(): Promise<DeviceCodeChallenge> {
    if (!this.oauthFlow) throw new Error("Not configured for OAuth");
    return this.oauthFlow.initiateDeviceFlow();
  }

  async pollOAuth(device_code: string): Promise<void> {
    if (!this.oauthFlow) throw new Error("Not configured for OAuth");
    await this.oauthFlow.pollForToken(device_code);
  }

  isOAuthAuthenticated(): boolean {
    return this.oauthFlow?.isAuthenticated() ?? true; // basic auth is always "authenticated"
  }

  // ─── HTTP Methods ──────────────────────────────────────────────────────────

  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  async delete(path: string): Promise<void> {
    await this.request<void>("DELETE", path);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const authHeader = await this.getAuthHeader();

    const headers: Record<string, string> = {
      Authorization: authHeader,
      Accept: "application/json",
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      await this.throwOracleError(res);
    }

    if (res.status === 204 || res.headers.get("content-length") === "0") {
      return undefined as unknown as T;
    }

    return res.json() as Promise<T>;
  }

  // ─── File Upload ───────────────────────────────────────────────────────────

  async uploadFile(fileName: string, content: Buffer): Promise<void> {
    const url = `${this.baseUrl}/HyperionPlanning/rest/v3/files/${encodeURIComponent(fileName)}`;
    const authHeader = await this.getAuthHeader();

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
      body: content as unknown as BodyInit,
    });

    if (!res.ok) {
      await this.throwOracleError(res);
    }
  }

  // ─── Job Polling ───────────────────────────────────────────────────────────

  async pollJob(jobId: number, timeoutMs: number = 30 * 60 * 1000): Promise<JobStatus> {
    const deadline = Date.now() + timeoutMs;
    const pollInterval = 5000; // 5 seconds

    while (Date.now() < deadline) {
      const status = await this.get<JobStatus>(
        `/HyperionPlanning/rest/v3/applications/${this.app}/jobs/${jobId}`
      );

      if (status.status !== -1 && status.status !== 3) {
        return status; // Done (success, warning, or error)
      }

      await sleep(pollInterval);
    }

    throw new Error(
      `Job ${jobId} did not complete within ${timeoutMs / 60000} minutes. Check EPM Cloud for job status.`
    );
  }

  // ─── Error Handling ────────────────────────────────────────────────────────

  private async throwOracleError(res: Response): Promise<never> {
    let message = `HTTP ${res.status} ${res.statusText}`;

    try {
      const body = await res.json() as { localizedMessage?: string; detail?: string; message?: string };
      const raw = body.localizedMessage || body.detail || body.message || "";

      // Try to translate known Oracle error codes
      const codeMatch = raw.match(/EPMIE-\d+/);
      if (codeMatch && ERROR_TRANSLATIONS[codeMatch[0]]) {
        message = ERROR_TRANSLATIONS[codeMatch[0]];
      } else if (raw) {
        message = raw;
      }
    } catch {
      // Could not parse JSON body — use HTTP status
    }

    throw new Error(message);
  }

  // ─── Convenience Path Builders ─────────────────────────────────────────────

  planPath(planType: string, suffix: string = ""): string {
    return `/HyperionPlanning/rest/v3/applications/${this.app}/plantypes/${planType}${suffix}`;
  }

  appPath(suffix: string = ""): string {
    return `/HyperionPlanning/rest/v3/applications/${this.app}${suffix}`;
  }

  interopPath(suffix: string = ""): string {
    return `/interop/rest/11.1.2.3.600${suffix}`;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeUrl(url: string): string {
  // Strip trailing slashes and common suffixes users might include
  let clean = url.replace(/\/$/, "");
  clean = clean.replace(/\/HyperionPlanning(\/.*)?$/, "");
  clean = clean.replace(/\/interop(\/.*)?$/, "");
  return clean;
}

export function jobStatusLabel(status: number): string {
  return JOB_STATUS_LABELS[status] ?? `Unknown status (${status})`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
