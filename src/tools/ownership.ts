// Ownership Management tools:
// fcc_get_ownership, fcc_update_ownership, fcc_get_entity_hierarchy

import { FccClientManager } from "../fcc-client-manager.js";
import { ToolResult } from "../types.js";

type RegisterFn = (name: string, description: string, schema: object, handler: (args: Record<string, unknown>) => Promise<ToolResult>) => void;

// FCCS system accounts for ownership data
const OWNERSHIP_ACCOUNTS = [
  "FCCS_Percent Consol",
  "FCCS_Percent Ownership",
  "FCCS_Percent Minority Interest",
  "FCCS_Control",
];

export function registerOwnershipTools(manager: FccClientManager, registerTool: RegisterFn): void {

  // ─── fcc_get_ownership ───────────────────────────────────────────────────
  registerTool(
    "fcc_get_ownership",
    "Get ownership data for a specific entity in a given period, year, and scenario. Returns consolidation method, percentage ownership, minority interest, and control status.",
    {
      type: "object",
      properties: {
        entity: { type: "string", description: "Entity name" },
        period: { type: "string", description: "Period (e.g., 'Jan', 'Q1')" },
        year: { type: "string", description: "Year (e.g., 'FY25')" },
        scenario: { type: "string", description: "Scenario (e.g., 'Actual')" },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["entity", "period", "year", "scenario"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);

      // No /ownership endpoint exists — use exportdataslice with FCCS ownership system accounts
      const gridDef = {
        exportPlanningData: false,
        gridDefinition: {
          suppressMissingBlocks: true,
          suppressMissingRows: false,
          suppressMissingColumns: true,
          pov: {
            dimensions: ["Scenario", "Year", "Period", "Entity", "View"],
            members: [
              [args.scenario as string],
              [args.year as string],
              [args.period as string],
              [args.entity as string],
              ["Periodic"],
            ],
          },
          columns: [{ dimensions: ["Value"], members: [["Entity Input"]] }],
          rows: [{ dimensions: ["Account"], members: [OWNERSHIP_ACCOUNTS] }],
        },
      };

      try {
        const res = await client.post<{ rows?: Array<{ headers: string[]; data: string[] }> }>(
          client.planPath("Consol", "/exportdataslice"),
          gridDef
        );

        // Parse ownership data from the grid response
        const ownership: Record<string, string> = {};
        for (const row of res.rows ?? []) {
          if (row.headers?.[0] && row.data?.[0]) {
            ownership[row.headers[0]] = row.data[0];
          }
        }

        return {
          success: true,
          message: `Ownership data for ${args.entity} in ${args.period} ${args.year} ${args.scenario}.`,
          data: {
            entity: args.entity,
            period: args.period,
            year: args.year,
            scenario: args.scenario,
            ...ownership,
          },
        };
      } catch (err) {
        return {
          success: false,
          message: `Could not retrieve ownership data: ${(err as Error).message}`,
          data: { entity: args.entity, period: args.period, year: args.year, scenario: args.scenario },
        };
      }
    }
  );

  // ─── fcc_update_ownership ────────────────────────────────────────────────
  registerTool(
    "fcc_update_ownership",
    "Update ownership parameters for an entity: percent consolidation, percent ownership, and minority interest via importdataslice.",
    {
      type: "object",
      properties: {
        entity: { type: "string", description: "Entity name" },
        period: { type: "string", description: "Period" },
        year: { type: "string", description: "Year" },
        scenario: { type: "string", description: "Scenario" },
        percent_consolidation: { type: "number", description: "Percent consolidation (0-100)" },
        percent_ownership: { type: "number", description: "Percent ownership (0-100)" },
        percent_minority_interest: { type: "number", description: "Percent minority interest (0-100)" },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["entity", "period", "year", "scenario"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);

      // Build rows for each ownership value to update
      const rows: Array<{ headers: string[]; data: string[] }> = [];
      if (args.percent_consolidation !== undefined) {
        rows.push({ headers: ["FCCS_Percent Consol"], data: [String(args.percent_consolidation)] });
      }
      if (args.percent_ownership !== undefined) {
        rows.push({ headers: ["FCCS_Percent Ownership"], data: [String(args.percent_ownership)] });
      }
      if (args.percent_minority_interest !== undefined) {
        rows.push({ headers: ["FCCS_Percent Minority Interest"], data: [String(args.percent_minority_interest)] });
      }

      if (rows.length === 0) {
        return { success: false, message: "No ownership values provided to update." };
      }

      // No /ownership endpoint exists — use importdataslice to write ownership system accounts
      const payload = {
        aggregateEssbaseData: false,
        cellNotesOption: "Overwrite",
        dataGrid: {
          pov: [args.scenario, args.year, args.period, args.entity, "Periodic", "Entity Input"],
          columns: [["Entity Input"]],
          rows,
        },
      };

      try {
        const res = await client.post<{
          numAcceptedCells?: number;
          numRejectedCells?: number;
        }>(
          client.planPath("Consol", "/importdataslice"),
          payload
        );

        const accepted = res.numAcceptedCells ?? 0;
        const rejected = res.numRejectedCells ?? 0;

        return {
          success: rejected === 0,
          message: `Ownership updated for ${args.entity}: ${accepted} cells accepted, ${rejected} rejected.`,
          data: res,
        };
      } catch (err) {
        return {
          success: false,
          message: `Ownership update failed: ${(err as Error).message}`,
        };
      }
    }
  );

  // ─── fcc_get_entity_hierarchy ────────────────────────────────────────────
  registerTool(
    "fcc_get_entity_hierarchy",
    "Browse the FCC entity consolidation hierarchy. Returns parent-child relationships, showing which entities roll up to which parents.",
    {
      type: "object",
      properties: {
        parent_entity: {
          type: "string",
          description: "Start browsing from this entity (default: 'Total Geography')",
        },
        depth: {
          type: "number",
          description: "How many levels of children to include (1=immediate children, 0=all descendants). Default: 1",
        },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: [],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);
      const parent = (args.parent_entity as string) || "Total Geography";
      const depth = (args.depth as number) ?? 1;

      // Try single-member GET first for the parent entity info
      try {
        const memberInfo = await client.get<Record<string, unknown>>(
          client.appPath(`/dimensions/Entity/members/${encodeURIComponent(parent)}`)
        );

        // Then use exportdataslice to get children
        const memberFunc = depth === 0 ? `IDescendants(${parent})` : `IChildren(${parent})`;
        const gridDef = {
          exportPlanningData: false,
          gridDefinition: {
            suppressMissingBlocks: true,
            suppressMissingRows: false,
            suppressMissingColumns: true,
            pov: {
              dimensions: ["Scenario", "Year", "Period", "View", "Value"],
              members: [["Actual"], ["FY25"], ["Jan"], ["Periodic"], ["Entity Input"]],
            },
            columns: [{ dimensions: ["Account"], members: [["FCCS_Total Assets"]] }],
            rows: [{ dimensions: ["Entity"], members: [[memberFunc]] }],
          },
        };

        const res = await client.post<{ rows?: Array<{ headers: string[]; data: string[] }> }>(
          client.planPath("Consol", "/exportdataslice"),
          gridDef
        );

        const children = (res.rows ?? []).map((r) => ({
          memberName: r.headers?.[0],
        }));

        return {
          success: true,
          message: `Entity hierarchy from "${parent}": ${children.length} entities found.`,
          data: {
            parent: memberInfo,
            children,
          },
        };
      } catch (err) {
        return {
          success: false,
          message: `Could not retrieve entity hierarchy: ${(err as Error).message}. Try using fcc_query_mdx with an Entity hierarchy MDX query.`,
        };
      }
    }
  );
}
