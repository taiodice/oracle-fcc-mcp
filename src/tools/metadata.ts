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
    async () => {
      // No GET .../dimensions endpoint exists in Oracle REST API — return hardcoded FCCS standard dimensions
      const fccsDimensions = [
        { name: "Entity", description: "Legal entities and organizational structure" },
        { name: "Account", description: "Chart of accounts (FCCS_Total Assets, Revenue, etc.)" },
        { name: "Scenario", description: "Data versions (Actual, Budget, Forecast)" },
        { name: "Year", description: "Fiscal years (FY24, FY25)" },
        { name: "Period", description: "Time periods (Jan, Feb, Q1, YearTotal)" },
        { name: "View", description: "Aggregation type (Periodic, YTD, CYTD)" },
        { name: "Value", description: "Currency layer (Entity Input, Parent Currency Total)" },
        { name: "Currency", description: "Reporting currencies (USD, EUR, GBP)" },
        { name: "Intercompany", description: "Intercompany partner tracking" },
        { name: "Movement", description: "Balance sheet movement types (FCCS_OpeningBalance, FCCS_Mvmts_Total)" },
        { name: "Multi-GAAP", description: "GAAP adjustment layer (FCCS_No Multi-GAAP)" },
        { name: "Data Source", description: "Source tracking (FCCS_No Data Source)" },
        { name: "Consolidation", description: "System dimension (FCCS_Entity Input)" },
      ];
      return {
        success: true,
        message: `FCCS has ${fccsDimensions.length} standard dimensions.`,
        data: fccsDimensions,
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
      const dim = args.dimension as string;
      const parent = args.parent as string | undefined;
      const search = args.search as string | undefined;

      // If a specific member name is given via search, use single-member GET endpoint
      if (search && !parent) {
        try {
          const member = await client.get<Record<string, unknown>>(
            client.appPath(`/dimensions/${encodeURIComponent(dim)}/members/${encodeURIComponent(search)}`)
          );
          return {
            success: true,
            message: `Found member "${search}" in dimension "${dim}".`,
            data: [member],
          };
        } catch (err) {
          return {
            success: false,
            message: `Member "${search}" not found in "${dim}": ${(err as Error).message}`,
          };
        }
      }

      // For listing children/descendants, use exportdataslice with the dimension on rows
      // No bulk members query endpoint exists in Oracle REST API
      const parentMember = parent || getDefaultRoot(dim);
      const memberFunc = args.include_descendants
        ? `IDescendants(${parentMember})`
        : `IChildren(${parentMember})`;

      try {
        const gridDef = {
          exportPlanningData: false,
          gridDefinition: {
            suppressMissingBlocks: true,
            suppressMissingRows: false,
            suppressMissingColumns: true,
            pov: {
              dimensions: ["Scenario", "Year", "View", "Value"],
              members: [["Actual"], ["FY25"], ["Periodic"], ["Entity Input"]],
            },
            columns: [{ dimensions: ["Period"], members: [["Jan"]] }],
            rows: [{ dimensions: [dim], members: [[memberFunc]] }],
          },
        };

        const res = await client.post<{ rows?: Array<{ headers: string[]; data: string[] }> }>(
          client.planPath("Consol", "/exportdataslice"),
          gridDef
        );

        const members = (res.rows ?? []).map((r) => ({
          memberName: r.headers?.[0],
        }));

        return {
          success: true,
          message: `Found ${members.length} member(s) in "${dim}" under "${parentMember}".`,
          data: members,
        };
      } catch (err) {
        return {
          success: false,
          message: `Could not list members for "${dim}": ${(err as Error).message}. Try using fcc_export_data or fcc_query_mdx for more flexible member queries.`,
        };
      }
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

// Default root members for FCCS dimensions (used with IChildren/IDescendants)
function getDefaultRoot(dimension: string): string {
  const roots: Record<string, string> = {
    Entity: "Total Geography",
    Account: "FCCS_Total Assets",
    Scenario: "Scenario",
    Year: "Years",
    Period: "Period",
    Currency: "Currency",
    Intercompany: "FCCS_Total Intercompany",
    Movement: "FCCS_Mvmts_Total",
    View: "View",
    Value: "Value",
  };
  return roots[dimension] || dimension;
}
