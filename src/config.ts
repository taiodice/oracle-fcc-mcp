// Config loader — supports single-tenant (env vars) and multi-tenant (tenants.json)

import fs from "fs";
import path from "path";
import { TenantConfig, TenantsFile } from "./types.js";

export interface AppConfig {
  defaultTenant: string;
  tenants: Record<string, TenantConfig>;
}

export function loadConfig(): AppConfig {
  // Multi-tenant: FCC_TENANTS_CONFIG points to a JSON file
  const tenantsConfigPath = process.env.FCC_TENANTS_CONFIG;
  if (tenantsConfigPath) {
    const resolved = path.resolve(tenantsConfigPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`FCC_TENANTS_CONFIG file not found: ${resolved}`);
    }
    const raw = fs.readFileSync(resolved, "utf8");
    const parsed = JSON.parse(raw) as TenantsFile;
    return {
      defaultTenant: parsed.default,
      tenants: parsed.tenants,
    };
  }

  // Single-tenant: flat env vars
  const url = process.env.FCC_URL;
  const app = process.env.FCC_APP_NAME;
  const auth = (process.env.FCC_AUTH_METHOD || "basic") as "basic" | "oauth";

  if (!url || !app) {
    throw new Error(
      "Missing required environment variables. Set FCC_URL and FCC_APP_NAME (basic auth), " +
      "or set FCC_TENANTS_CONFIG pointing to a tenants.json file."
    );
  }

  const tenant: TenantConfig = {
    url,
    app,
    auth,
    username: process.env.FCC_USERNAME,
    password: process.env.FCC_PASSWORD,
    idcs_url: process.env.FCC_IDCS_URL,
    client_id: process.env.FCC_CLIENT_ID,
    client_secret: process.env.FCC_CLIENT_SECRET,
  };

  return {
    defaultTenant: "default",
    tenants: { default: tenant },
  };
}
