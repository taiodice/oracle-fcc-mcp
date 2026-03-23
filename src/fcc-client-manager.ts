// Multi-tenant FccClient factory — creates and caches one client per tenant

import { FccClient } from "./fcc-client.js";
import { AppConfig } from "./config.js";

export class FccClientManager {
  private clients: Map<string, FccClient> = new Map();
  private config: AppConfig | null;
  private configError: string | null;

  constructor(config: AppConfig | null, configError: string | null = null) {
    this.config = config;
    this.configError = configError;
  }

  getConfigError(): string | null {
    return this.configError;
  }

  getClient(tenant?: string): FccClient {
    if (!this.config) throw new Error(this.configError ?? "Server is not configured");
    const key = tenant || this.config.defaultTenant;
    if (!this.clients.has(key)) {
      const tenantConfig = this.config.tenants[key];
      if (!tenantConfig) {
        const available = Object.keys(this.config.tenants).join(", ");
        throw new Error(
          `Unknown tenant "${key}". Available tenants: ${available}`
        );
      }
      this.clients.set(key, new FccClient(tenantConfig));
    }
    return this.clients.get(key)!;
  }

  listTenants(): Array<{ name: string; url: string; app: string; auth: string; isDefault: boolean }> {
    if (!this.config) return [];
    return Object.entries(this.config.tenants).map(([name, cfg]) => ({
      name,
      url: cfg.url,
      app: cfg.app,
      auth: cfg.auth,
      isDefault: name === this.config!.defaultTenant,
    }));
  }

  getDefaultTenantName(): string {
    if (!this.config) return "";
    return this.config.defaultTenant;
  }
}
