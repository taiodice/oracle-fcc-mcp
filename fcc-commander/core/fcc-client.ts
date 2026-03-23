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

  /** POST without a body — used for endpoints that accept filters in the query string only. */
  async postNoBody<T>(path: string): Promise<T> {
    return this.request<T>("POST", path);
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

  fccsPath(suffix: string = ""): string {
    return `/fccs/rest/v1${suffix}`;
  }

  // ─── Root Entity Discovery ──────────────────────────────────────────────────

  private rootEntityCache: string | null = null;

  /**
   * Dynamically discover the root entity member name for this FCCS application.
   * Tries the dimension metadata endpoint first, then probes common candidate names.
   * The result is cached for the lifetime of this client instance.
   */
  async discoverRootEntity(): Promise<string> {
    if (this.rootEntityCache) return this.rootEntityCache;

    // Strategy 1: Query /dimensions/Entity for dimension info with root member
    try {
      const res = await this.get<{
        rootMember?: string;
        rootMemberName?: string;
        name?: string;
        items?: Array<{ memberName?: string; name?: string; parent?: string; generation?: number }>;
        members?: Array<{ memberName?: string; name?: string; parent?: string; generation?: number }>;
      }>(
        this.appPath("/dimensions/Entity")
      );

      // Check direct root member field
      const root = res.rootMember || res.rootMemberName;
      if (root) {
        this.rootEntityCache = root;
        return this.rootEntityCache;
      }

      // Check if items/members returned — find root (no parent or generation 0)
      const members = res.items || res.members;
      if (Array.isArray(members) && members.length > 0) {
        const rootMember = members.find((m) => !m.parent || m.generation === 0);
        const name = rootMember
          ? (rootMember.memberName || rootMember.name)
          : (members[0].memberName || members[0].name);
        if (name) {
          this.rootEntityCache = name;
          return this.rootEntityCache;
        }
      }
    } catch { /* continue to fallback strategies */ }

    // Strategy 2: Try common FCCS root entity member names by probing
    const candidates = [
      "FCCS_Total Entity",
      "Total Geography",
      "Total Entity",
      "FCCS_Entity",
      "Entity",
      this.app,
    ];

    for (const candidate of candidates) {
      try {
        const res = await this.get<{ memberName?: string; children?: unknown[] }>(
          this.appPath(`/dimensions/Entity/members/${encodeURIComponent(candidate)}`)
        );
        // Verify this looks like a real parent (has children)
        if (res.memberName || res.children) {
          this.rootEntityCache = candidate;
          return this.rootEntityCache;
        }
      } catch { /* try next candidate */ }
    }

    // Strategy 3: Use substitution variables to get current POV, then exportdataslice
    try {
      // Get substitution variables for current year/period
      const subVars = await this.get<{ items?: Array<{ name: string; value: string }> }>(
        this.appPath("/substitutionvariables")
      );
      const vars = subVars.items || [];
      const curYear = vars.find((v) => /curyear/i.test(v.name))?.value || "FY25";
      const curPeriod = vars.find((v) => /curperiod/i.test(v.name))?.value || "Jan";

      const gridDef = {
        exportPlanningData: false,
        gridDefinition: {
          suppressMissingBlocks: true,
          suppressMissingRows: false,
          suppressMissingColumns: true,
          pov: {
            dimensions: ["Scenario", "Year", "Period", "View", "Value"],
            members: [["Actual"], [curYear], [curPeriod], ["Periodic"], ["Entity Input"]],
          },
          columns: [{ dimensions: ["Account"], members: [["FCCS_Total Assets"]] }],
          rows: [{ dimensions: ["Entity"], members: [["ILvl0Descendants(Entity)"]] }],
        },
      };

      const sliceRes = await this.post<{
        rows?: Array<{ headers?: string[] }>;
      }>(
        this.planPath("Consol", "/exportdataslice"),
        gridDef
      );

      if (sliceRes.rows && sliceRes.rows.length > 0) {
        const firstEntity = sliceRes.rows[0].headers?.[0];
        if (firstEntity) {
          this.rootEntityCache = firstEntity;
          return this.rootEntityCache;
        }
      }
    } catch { /* continue to final fallback */ }

    // Final fallback — return a commonly used root
    return "Total Geography";
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeUrl(url: string): string {
  let clean = url.trim();
  // Ensure https:// protocol prefix
  if (!/^https?:\/\//i.test(clean)) {
    clean = `https://${clean}`;
  }
  // Strip trailing slashes and common suffixes users might include
  clean = clean.replace(/\/$/, "");
  clean = clean.replace(/\/HyperionPlanning(\/.*)?$/, "");
  clean = clean.replace(/\/interop(\/.*)?$/, "");
  clean = clean.replace(/\/fccs(\/.*)?$/, "");
  return clean;
}

export function jobStatusLabel(status: number): string {
  return JOB_STATUS_LABELS[status] ?? `Unknown status (${status})`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
