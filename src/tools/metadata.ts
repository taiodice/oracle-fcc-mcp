// Metadata tools:
// fcc_list_dimensions, fcc_get_members, fcc_get_substitution_variables, fcc_set_substitution_variables

import { FccClientManager } from "../fcc-client-manager.js";
import { ToolResult } from "../types.js";

type RegisterFn = (name: string, description: string, schema: object, handler: (args: Record<string, unknown>) => Promise<ToolResult>) => void;

// FCCS standard dimensions — there is no REST API endpoint to list all dimensions
const FCCS_STANDARD_DIMENSIONS = [
  { name: "Account", type: "Standard", description: "Chart of accounts" },
  { name: "Entity", type: "Standard", description: "Legal entities and org structure" },
  { name: "Scenario", type: "Standard", description: "Actual, Budget, Forecast" },
  { name: "Year", type: "Standard", description: "Fiscal years" },
  { name: "Period", type: "Standard", description: "Months, quarters" },
  { name: "View", type: "Standard", description: "Periodic, YTD, CYTD" },
  { name: "Value", type: "Standard", description: "Entity Input, Parent Currency Total, etc." },
  { name: "Currency", type: "Standard", description: "Reporting currencies" },
  { name: "Intercompany", type: "Standard", description: "IC partner entities" },
  { name: "Movement", type: "Standard", description: "Movement types for BS accounts" },
  { name: "Multi-GAAP", type: "Standard", description: "GAAP adjustments (if enabled)" },
  { name: "Data Source", type: "Standard", description: "Data source tracking" },
  { name: "Consolidation", type: "System", description: "Consolidation dimension" },
];

// Candidate root members for each standard dimension — tried in order
// The first successful API call wins
const DIMENSION_ROOT_CANDIDATES: Record<string, string[]> = {
  Account: ["FCCS_Total Assets", "Account", "Total Account"],
  Entity: ["FCCS_Total Entity", "Total Geography", "Total Entity", "Entity"],
  Scenario: ["Scenario"],
  Year: ["Years", "Year", "Total Year"],
  Period: ["Period", "Periods"],
  View: ["Periodic", "View"],
  Value: ["Entity Input", "Value"],
  Currency: ["USD", "Currency"],
  Intercompany: ["FCCS_No Intercompany", "ICP_None", "Intercompany"],
  Movement: ["FCCS_Mvmts_Total", "Movement"],
  "Multi-GAAP": ["FCCS_No Multi-GAAP", "Multi-GAAP"],
  "Data Source": ["FCCS_No Data Source", "Data Source"],
  Consolidation: ["FCCS_Entity Input", "Consolidation"],
};

// Some FCCS dimensions have different API names than their common names
// e.g. the "Year" dimension is actually called "Years" in the REST API
const DIMENSION_API_NAMES: Record<string, string[]> = {
  Year: ["Years", "Year"],
  Period: ["Period", "Periods"],
};

// Fallback flat map for non-critical uses (exportdataslice POV, etc.)
const DIMENSION_ROOT_MEMBERS: Record<string, string> = Object.fromEntries(
  Object.entries(DIMENSION_ROOT_CANDIDATES).map(([k, v]) => [k, v[0]])
);

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
    async (_args) => {
      // The FCCS REST API does not have an endpoint to list all dimensions.
      // Return the well-known FCCS standard dimensions.
      return {
        success: true,
        message: `FCCS has ${FCCS_STANDARD_DIMENSIONS.length} standard dimensions. Custom dimensions may also exist in your application.`,
        data: FCCS_STANDARD_DIMENSIONS,
        warnings: [
          "This list shows FCCS standard dimensions. Your application may have additional custom dimensions.",
          "Use fcc_get_members with a specific dimension name to explore members within each dimension.",
        ],
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
        parent: { type: "string", description: "Parent member — returns this member and its children (optional)" },
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

      // Determine alternate API names for the dimension (e.g. "Year" → "Years")
      const dimApiNames = DIMENSION_API_NAMES[dim] || [dim];

      // Determine which member(s) to try
      const explicitParent = args.parent as string | undefined;
      const candidates = explicitParent
        ? [explicitParent]
        : [...(DIMENSION_ROOT_CANDIDATES[dim] || []), dim];

      // Try each dimension API name × member candidate until one succeeds
      console.log(`[fcc_get_members] Dimension "${dim}" — API names: ${dimApiNames}, member candidates:`, candidates);
      let lastErr: Error | null = null;
      for (const dimName of dimApiNames) {
        const dimEncoded = encodeURIComponent(dimName);
        for (const memberName of candidates) {
          const memberEncoded = encodeURIComponent(memberName);

          try {
            console.log(`[fcc_get_members] Trying dim="${dimName}" member="${memberName}"...`);
            const res = await client.get<Record<string, unknown>>(
              client.appPath(`/dimensions/${dimEncoded}/members/${memberEncoded}`)
            );
            console.log(`[fcc_get_members] SUCCESS dim="${dimName}" member="${memberName}" — keys: ${Object.keys(res).join(", ")}`);

          // The response is a single member object. Extract useful info.
          const members: Array<Record<string, unknown>> = [];
          members.push(res);

          // If the member has children listed, include them
          if (Array.isArray(res.children)) {
            for (const child of res.children as Array<Record<string, unknown>>) {
              members.push(child);
            }
          }

          // Apply search filter if specified
          let filtered = members;
          if (args.search) {
            const searchLower = (args.search as string).toLowerCase();
            filtered = members.filter((m) => {
              const name = (m.memberName || m.name || "") as string;
              const alias = (m.alias || "") as string;
              return name.toLowerCase().includes(searchLower) || alias.toLowerCase().includes(searchLower);
            });
          }

          // Apply limit
          const limit = (args.limit as number) || 100;
          const limited = filtered.slice(0, limit);

          return {
            success: true,
            message: `Found ${limited.length} member(s) in dimension "${dim}" starting from "${memberName}".`,
            data: limited,
          };
        } catch (err) {
          console.log(`[fcc_get_members] FAILED dim="${dimName}" member="${memberName}": ${(err as Error).message}`);
          lastErr = err as Error;
          continue;
        }
        }
      }

      // All dimension name × member combinations failed — try exportdataslice fallback
      {
        const err = lastErr;
        const memberName = candidates[0];
        // Fallback: try using exportdataslice to discover members
        // This works by putting the dimension on rows with a function like IChildren()
        try {
          const memberFunc = args.include_descendants
            ? `IDescendants(${memberName})`
            : `IChildren(${memberName})`;

          const gridDef = {
            exportPlanningData: false,
            gridDefinition: {
              suppressMissingBlocks: false,
              suppressMissingRows: false,
              suppressMissingColumns: true,
              pov: {
                dimensions: ["Scenario", "Year", "Period", "View", "Value"],
                members: [["Actual"], ["FY25"], ["Jan"], ["Periodic"], ["Entity Input"]],
              },
              columns: [{ dimensions: ["Account"], members: [["FCCS_Total Assets"]] }],
              rows: [{ dimensions: [dim], members: [[memberFunc]] }],
            },
          };

          const sliceRes = await client.post<{ rows?: Array<{ headers?: string[] }> }>(
            client.planPath("Consol", "/exportdataslice"),
            gridDef
          );

          // Extract member names from the row headers
          const memberNames: string[] = [];
          if (sliceRes.rows) {
            for (const row of sliceRes.rows) {
              if (row.headers && row.headers.length > 0) {
                memberNames.push(row.headers[0]);
              }
            }
          }

          const limit = (args.limit as number) || 100;
          const limited = memberNames.slice(0, limit);

          return {
            success: true,
            message: `Found ${limited.length} member(s) in dimension "${dim}" via data slice (fallback).`,
            data: limited.map((name) => ({ memberName: name, dimension: dim })),
            warnings: [
              "Member details retrieved via exportdataslice fallback. Use fcc_get_members with a specific parent member for full member properties.",
            ],
          };
        } catch (fallbackErr) {
          return {
            success: false,
            message: `Could not retrieve members for dimension "${dim}": ${(err as Error).message}. Fallback also failed: ${(fallbackErr as Error).message}.`,
            data: {
              dimension: dim,
              requestedMember: memberName,
              hint: "Use fcc_get_members with a known member name in the 'parent' parameter. Common roots: " +
                Object.entries(DIMENSION_ROOT_MEMBERS).map(([d, m]) => `${d}="${m}"`).join(", "),
            },
          };
        }
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
