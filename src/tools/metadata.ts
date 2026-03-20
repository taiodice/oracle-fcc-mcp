// Metadata tools:
// fcc_list_dimensions, fcc_get_members, fcc_get_substitution_variables, fcc_set_substitution_variables

import { FccClientManager } from "../fcc-client-manager.js";
import { ToolResult } from "../types.js";

type RegisterFn = (name: string, description: string, schema: object, handler: (args: Record<string, unknown>) => Promise<ToolResult>) => void;

export function registerMetadataTools(manager: FccClientManager, registerTool: RegisterFn): void {

  // ─── fcc_list_dimensions ─────────────────────────────────────────────────
  registerTool(
    "fcc_list_dimensions",
    "List all dimensions in the FCC application. FCC standard dimensions include: Entity, Scenario, Period, Year, View, Value, Account, Intercompany, Currency, Movement, Multi-GAAP.",
    {
      type: "object",
      properties: {
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: [],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);
      const res = await client.get<{ items: unknown[] }>(client.appPath("/dimensions"));
      return {
        success: true,
        message: `Found ${res.items?.length ?? 0} dimensions.`,
        data: res.items,
      };
    }
  );

  // ─── fcc_get_members ─────────────────────────────────────────────────────
  registerTool(
    "fcc_get_members",
    "Get members of a specific FCC dimension. Optionally filter by parent member, search by name, or include all descendants.",
    {
      type: "object",
      properties: {
        dimension: {
          type: "string",
          description: "Dimension name (e.g., 'Entity', 'Account', 'Scenario', 'Period', 'Year', 'View', 'Value', 'Intercompany')",
        },
        parent: { type: "string", description: "Parent member — returns only children of this member (optional)" },
        search: { type: "string", description: "Search string to filter member names (optional)" },
        include_descendants: {
          type: "boolean",
          description: "Include all descendants (not just immediate children). Default: false.",
        },
        fields: {
          type: "string",
          description: "Comma-separated fields to return (e.g., 'memberName,alias,parent,consolidation'). Default: all.",
        },
        limit: { type: "number", description: "Max members to return (default: 100)" },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["dimension"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);
      const dim = encodeURIComponent(args.dimension as string);

      const params = new URLSearchParams();
      if (args.parent) params.set("parent", args.parent as string);
      if (args.search) params.set("memberName", args.search as string);
      if (args.include_descendants) params.set("descendants", "true");
      if (args.fields) params.set("fields", args.fields as string);
      if (args.limit) params.set("limit", String(args.limit));

      const query = params.toString() ? `?${params.toString()}` : "";
      const res = await client.get<{ items: unknown[] }>(
        client.appPath(`/dimensions/${dim}/members${query}`)
      );

      return {
        success: true,
        message: `Found ${res.items?.length ?? 0} member(s) in dimension "${args.dimension}".`,
        data: res.items,
      };
    }
  );

  // ─── fcc_get_substitution_variables ──────────────────────────────────────
  registerTool(
    "fcc_get_substitution_variables",
    "Get all substitution variable values in the FCC application. These are system-wide variables like CurPeriod, CurYear that drive consolidation scripts.",
    {
      type: "object",
      properties: {
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: [],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);
      const res = await client.get<{ items: Array<{ name: string; value: string }> }>(
        client.appPath("/substitutionvariables")
      );
      return {
        success: true,
        message: `Found ${res.items?.length ?? 0} substitution variable(s).`,
        data: res.items,
      };
    }
  );

  // ─── fcc_set_substitution_variables ──────────────────────────────────────
  registerTool(
    "fcc_set_substitution_variables",
    "Update one or more substitution variable values in FCC. Common uses: update CurPeriod and CurYear to drive the current reporting period for consolidation scripts.",
    {
      type: "object",
      properties: {
        variables: {
          type: "array",
          description: "Array of variable name/value pairs to update",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Variable name (e.g., 'CurPeriod')" },
              value: { type: "string", description: "New value (e.g., 'Jan')" },
            },
            required: ["name", "value"],
          },
        },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["variables"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);
      const variables = args.variables as Array<{ name: string; value: string }>;

      // Update each variable sequentially
      const results: Array<{ name: string; success: boolean; error?: string }> = [];
      for (const variable of variables) {
        try {
          await client.put(
            client.appPath(`/substitutionvariables/${encodeURIComponent(variable.name)}`),
            { value: variable.value }
          );
          results.push({ name: variable.name, success: true });
        } catch (err) {
          results.push({ name: variable.name, success: false, error: (err as Error).message });
        }
      }

      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      return {
        success: failed === 0,
        message: `Updated ${succeeded} variable(s)${failed > 0 ? `, ${failed} failed` : ""}.`,
        data: results,
        warnings: failed > 0 ? results.filter((r) => !r.success).map((r) => `${r.name}: ${r.error}`) : undefined,
      };
    }
  );
}
