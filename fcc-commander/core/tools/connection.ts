// Connection & Health tools: fcc_list_tenants, fcc_test_connection, fcc_get_app_info

import { FccClientManager } from "../fcc-client-manager.js";
import { ToolResult } from "../types.js";

export function registerConnectionTools(
  manager: FccClientManager,
  registerTool: (name: string, description: string, schema: object, handler: (args: Record<string, unknown>) => Promise<ToolResult>) => void
): void {

  // ─── fcc_list_tenants ────────────────────────────────────────────────────
  registerTool(
    "fcc_list_tenants",
    "List all configured FCC tenants/environments. Use this to see which environments are available before running other tools.",
    { type: "object", properties: {}, required: [] },
    async () => {
      const tenants = manager.listTenants();
      return {
        success: true,
        message: `${tenants.length} tenant(s) configured.`,
        data: tenants,
      };
    }
  );

  // ─── fcc_test_connection ─────────────────────────────────────────────────
  registerTool(
    "fcc_test_connection",
    "Test the connection to an Oracle EPM FCC environment and list available applications. For OAuth tenants that are not yet authenticated, this will initiate the Device Code Flow and return the URL + code the user must use to authenticate.",
    {
      type: "object",
      properties: {
        tenant: { type: "string", description: "Tenant name (optional, uses default if not specified)" },
      },
      required: [],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);

      // For OAuth: if not yet authenticated, initiate Device Code Flow
      if (!client.isOAuthAuthenticated()) {
        const challenge = await client.initiateOAuth();
        return {
          success: false,
          message: `OAuth authentication required. Open this URL in your browser: ${challenge.verification_uri}\n\nEnter the code: ${challenge.user_code}\n\nAfter authenticating, call fcc_test_connection again to complete the flow.`,
          data: {
            verification_uri: challenge.verification_uri,
            user_code: challenge.user_code,
            device_code: challenge.device_code,
            expires_in_seconds: challenge.expires_in,
            action: "Visit the URL, enter the code, then call fcc_test_connection again with device_code to complete authentication.",
          },
        };
      }

      // Test connection by listing applications
      const apps = await client.get<{ items: Array<{ name: string; type: string }> }>(
        "/HyperionPlanning/rest/v3/applications"
      );

      return {
        success: true,
        message: `Connected successfully. Found ${apps.items?.length ?? 0} application(s).`,
        data: {
          current_app: client.app,
          applications: apps.items ?? [],
        },
      };
    }
  );

  // ─── fcc_complete_oauth ──────────────────────────────────────────────────
  registerTool(
    "fcc_complete_oauth",
    "Complete OAuth authentication after the user has authenticated at the verification URL. Pass the device_code returned by fcc_test_connection.",
    {
      type: "object",
      properties: {
        device_code: { type: "string", description: "The device_code returned by fcc_test_connection" },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["device_code"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);
      await client.pollOAuth(args.device_code as string);
      return {
        success: true,
        message: "OAuth authentication completed. You can now use all FCC tools.",
      };
    }
  );

  // ─── fcc_get_app_info ────────────────────────────────────────────────────
  registerTool(
    "fcc_get_app_info",
    "Get detailed information about the FCC application: dimensions, plan types, and substitution variables.",
    {
      type: "object",
      properties: {
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: [],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);
      const app = client.app;

      const [dimsRes, planTypesRes, subvarsRes] = await Promise.allSettled([
        client.get<{ items: unknown[] }>(client.appPath("/dimensions")),
        client.get<{ items: unknown[] }>(client.appPath("/plantypes")),
        client.get<{ items: unknown[] }>(client.appPath("/substitutionvariables")),
      ]);

      const dimensions = dimsRes.status === "fulfilled" ? dimsRes.value.items : [];
      const planTypes = planTypesRes.status === "fulfilled" ? planTypesRes.value.items : [];
      const subvars = subvarsRes.status === "fulfilled" ? subvarsRes.value.items : [];

      return {
        success: true,
        message: `App info for ${app}: ${Array.isArray(dimensions) ? dimensions.length : 0} dimensions, ${Array.isArray(planTypes) ? planTypes.length : 0} plan types.`,
        data: {
          app,
          dimensions,
          planTypes,
          substitutionVariables: subvars,
        },
      };
    }
  );
}
