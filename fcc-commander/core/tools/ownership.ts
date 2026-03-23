// Ownership Management tools:
// fcc_get_ownership, fcc_update_ownership, fcc_get_entity_hierarchy

import { FccClientManager } from "../fcc-client-manager.js";
import { ToolResult } from "../types.js";

type RegisterFn = (name: string, description: string, schema: object, handler: (args: Record<string, unknown>) => Promise<ToolResult>) => void;

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
        year: { type: "string", description: "Year (e.g., 'FY2024')" },
        scenario: { type: "string", description: "Scenario (e.g., 'Actual')" },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["entity", "period", "year", "scenario"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);

      // There is no direct /ownership endpoint in FCCS REST API.
      // Ownership data is stored in FCCS system accounts. Retrieve via exportdataslice.
      const ownershipAccounts = [
        "FCCS_Percent Consol",
        "FCCS_Percent Ownership",
        "FCCS_Percent Minority Interest",
        "FCCS_Consol Method",
        "FCCS_Control",
      ];

      try {
        const gridDef = {
          exportPlanningData: false,
          gridDefinition: {
            suppressMissingBlocks: false,
            suppressMissingRows: false,
            suppressMissingColumns: true,
            pov: {
              dimensions: ["Scenario", "Year", "Period", "View", "Value"],
              members: [
                [args.scenario as string],
                [args.year as string],
                [args.period as string],
                ["Periodic"],
                ["Entity Input"],
              ],
            },
            columns: [{ dimensions: ["Account"], members: [ownershipAccounts] }],
            rows: [{ dimensions: ["Entity"], members: [[args.entity as string]] }],
          },
        };

        const res = await client.post<unknown>(
          client.planPath("Consol", "/exportdataslice"),
          gridDef
        );

        return {
          success: true,
          message: `Ownership data for ${args.entity} in ${args.period} ${args.year} ${args.scenario}.`,
          data: res,
        };
      } catch (err) {
        return {
          success: false,
          message: `Could not retrieve ownership data: ${(err as Error).message}. Ownership data is stored in FCCS system accounts (FCCS_Percent Consol, FCCS_Percent Ownership, etc.) and retrieved via exportdataslice.`,
          data: { entity: args.entity, period: args.period, year: args.year, scenario: args.scenario },
        };
      }
    }
  );

  // ─── fcc_update_ownership ────────────────────────────────────────────────
  registerTool(
    "fcc_update_ownership",
    "Update ownership parameters for an entity: consolidation method, percent consolidation, percent ownership, and minority interest.",
    {
      type: "object",
      properties: {
        entity: { type: "string", description: "Entity name" },
        period: { type: "string", description: "Period" },
        year: { type: "string", description: "Year" },
        scenario: { type: "string", description: "Scenario" },
        consolidation_method: {
          type: "string",
          description: "Consolidation method (e.g., 'Proportional', 'Equity', 'Global', 'None')",
        },
        percent_consolidation: {
          type: "number",
          description: "Percent consolidation (0-100)",
        },
        percent_ownership: {
          type: "number",
          description: "Percent ownership (0-100)",
        },
        percent_minority_interest: {
          type: "number",
          description: "Percent minority interest (0-100)",
        },
        control: {
          type: "string",
          enum: ["Controlling", "NonControlling"],
          description: "Control status",
        },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["entity", "period", "year", "scenario"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);

      // Ownership updates in FCCS are done via importdataslice to write to system accounts
      // Build the data grid to write ownership values
      const dataGrid: Record<string, unknown> = {
        pov: {
          dimensions: ["Scenario", "Year", "Period", "View", "Value"],
          members: [
            [args.scenario as string],
            [args.year as string],
            [args.period as string],
            ["Periodic"],
            ["Entity Input"],
          ],
        },
        columns: [{ dimensions: ["Account"], members: [] as string[][] }],
        rows: [{ dimensions: ["Entity"], members: [[args.entity as string]] }],
        data: [] as number[][],
      };

      const accounts: string[] = [];
      const values: number[] = [];

      if (args.percent_consolidation !== undefined) {
        accounts.push("FCCS_Percent Consol");
        values.push(args.percent_consolidation as number);
      }
      if (args.percent_ownership !== undefined) {
        accounts.push("FCCS_Percent Ownership");
        values.push(args.percent_ownership as number);
      }
      if (args.percent_minority_interest !== undefined) {
        accounts.push("FCCS_Percent Minority Interest");
        values.push(args.percent_minority_interest as number);
      }

      if (accounts.length === 0) {
        return {
          success: false,
          message: "No numeric ownership values provided to update. Specify at least one of: percent_consolidation, percent_ownership, percent_minority_interest.",
          warnings: [
            "Consolidation method and control status are metadata properties that may need to be updated via the FCC UI or dimension metadata import.",
          ],
        };
      }

      (dataGrid.columns as Array<{ dimensions: string[]; members: string[][] }>)[0].members = [accounts];
      (dataGrid as Record<string, unknown>).data = [values];

      try {
        const payload = {
          aggregateEssbaseData: false,
          cellNotesOption: "Overwrite",
          dataGrid,
        };

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
          message: `Ownership updated for ${args.entity} in ${args.period} ${args.year} ${args.scenario}: ${accepted} cells accepted, ${rejected} rejected.`,
          data: res,
          warnings: rejected > 0 ? [`${rejected} cells were rejected. Check the entity name and period status.`] : undefined,
        };
      } catch (err) {
        return {
          success: false,
          message: `Ownership update failed: ${(err as Error).message}. Ownership values are written to FCCS system accounts via importdataslice.`,
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
          description: "Start browsing from this entity (optional — uses root if not specified)",
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
      const depth = (args.depth as number) ?? 1;
      const parentEntity = (args.parent_entity as string) || await client.discoverRootEntity();

      // First try: use the single-member GET endpoint to get the entity and its children
      try {
        const memberEncoded = encodeURIComponent(parentEntity);
        const res = await client.get<Record<string, unknown>>(
          client.appPath(`/dimensions/Entity/members/${memberEncoded}`)
        );

        const members: Array<Record<string, unknown>> = [res];
        if (Array.isArray(res.children)) {
          for (const child of res.children as Array<Record<string, unknown>>) {
            members.push(child);
          }
        }

        return {
          success: true,
          message: `Entity hierarchy from "${parentEntity}": ${members.length} entities found.`,
          data: members,
        };
      } catch {
        // Fallback: use exportdataslice with Entity on rows using member functions
        try {
          const memberFunc = depth === 0
            ? `IDescendants(${parentEntity})`
            : `IChildren(${parentEntity})`;

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
              rows: [{ dimensions: ["Entity"], members: [[memberFunc]] }],
            },
          };

          const sliceRes = await client.post<{ rows?: Array<{ headers?: string[] }> }>(
            client.planPath("Consol", "/exportdataslice"),
            gridDef
          );

          // Extract entity names from row headers
          const entities: Array<{ memberName: string; source: string }> = [];
          if (sliceRes.rows) {
            for (const row of sliceRes.rows) {
              if (row.headers && row.headers.length > 0) {
                entities.push({ memberName: row.headers[0], source: "exportdataslice" });
              }
            }
          }

          return {
            success: true,
            message: `Entity hierarchy from "${parentEntity}": ${entities.length} entities found (via data slice).`,
            data: entities,
            warnings: [
              "Entity hierarchy retrieved via exportdataslice fallback. Parent-child relationships are inferred from the member function used.",
            ],
          };
        } catch (fallbackErr) {
          return {
            success: false,
            message: `Could not retrieve entity hierarchy: ${(fallbackErr as Error).message}. Try specifying a known entity name in parent_entity.`,
            data: { parent_entity: parentEntity },
          };
        }
      }
    }
  );
}
