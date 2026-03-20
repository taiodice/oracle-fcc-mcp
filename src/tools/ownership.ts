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

      // FCC ownership endpoint — verify from Oracle FCC REST API docs
      // Likely: /HyperionPlanning/rest/v3/applications/{app}/ownership
      // with query parameters for entity/period/year/scenario
      const params = new URLSearchParams({
        entity: args.entity as string,
        period: args.period as string,
        year: args.year as string,
        scenario: args.scenario as string,
      });

      try {
        const res = await client.get<unknown>(
          client.appPath(`/ownership?${params.toString()}`)
        );
        return {
          success: true,
          message: `Ownership data for ${args.entity} in ${args.period} ${args.year} ${args.scenario}.`,
          data: res,
        };
      } catch (err) {
        // Ownership may be retrieved via exportdataslice with ownership dimensions
        return {
          success: false,
          message: `Could not retrieve ownership data: ${(err as Error).message}. Note: The ownership endpoint path must be verified from Oracle FCC REST API documentation.`,
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

      const updatePayload: Record<string, unknown> = {
        entity: args.entity,
        period: args.period,
        year: args.year,
        scenario: args.scenario,
      };

      if (args.consolidation_method !== undefined) updatePayload.consolidationMethod = args.consolidation_method;
      if (args.percent_consolidation !== undefined) updatePayload.percentConsolidation = args.percent_consolidation;
      if (args.percent_ownership !== undefined) updatePayload.percentOwnership = args.percent_ownership;
      if (args.percent_minority_interest !== undefined) updatePayload.percentMinorityInterest = args.percent_minority_interest;
      if (args.control !== undefined) updatePayload.control = args.control;

      try {
        const res = await client.put<unknown>(
          client.appPath("/ownership"),
          updatePayload
        );
        return {
          success: true,
          message: `Ownership updated for ${args.entity} in ${args.period} ${args.year} ${args.scenario}.`,
          data: res,
        };
      } catch (err) {
        return {
          success: false,
          message: `Ownership update failed: ${(err as Error).message}. Note: Verify the ownership update endpoint from Oracle FCC REST API documentation.`,
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
      const includeDescendants = depth === 0;

      // Use standard dimension members API for Entity dimension
      const parent = args.parent_entity as string | undefined;
      const params = new URLSearchParams({
        memberName: parent || "Total Geography",
        fields: "memberName,alias,parent,generation,consolidation",
      });
      if (includeDescendants) {
        params.set("descendants", "true");
      }

      const res = await client.get<{ items: unknown[] }>(
        client.appPath(`/dimensions/Entity/members?${params.toString()}`)
      );

      return {
        success: true,
        message: `Entity hierarchy from "${parent || "root"}": ${res.items?.length ?? 0} entities found.`,
        data: res.items,
      };
    }
  );
}
