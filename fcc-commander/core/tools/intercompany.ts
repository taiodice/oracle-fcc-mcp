// Intercompany tools:
// fcc_get_ic_transactions, fcc_manage_ic_matching
// Note: FCCS does not have a direct REST API endpoint for intercompany transactions.
// IC data is accessed via exportdataslice with the Intercompany dimension,
// and IC matching operations are performed via the Jobs API.

import { FccClientManager } from "../fcc-client-manager.js";
import { ToolResult } from "../types.js";
import { jobStatusLabel } from "../fcc-client.js";

type RegisterFn = (name: string, description: string, schema: object, handler: (args: Record<string, unknown>) => Promise<ToolResult>) => void;

const IC_ACTIONS = ["match", "unmatch", "dispute", "auto_match"] as const;
type IcAction = typeof IC_ACTIONS[number];

export function registerIntercompanyTools(manager: FccClientManager, registerTool: RegisterFn): void {

  // ─── fcc_get_ic_transactions ─────────────────────────────────────────────
  registerTool(
    "fcc_get_ic_transactions",
    "List and search intercompany transactions for a specific period. Filter by entity, partner entity, account, or matching status.",
    {
      type: "object",
      properties: {
        period: { type: "string", description: "Period (e.g., 'Jan')" },
        year: { type: "string", description: "Year (e.g., 'FY2024')" },
        entity: { type: "string", description: "Source entity filter (optional)" },
        partner: { type: "string", description: "Partner entity filter (optional)" },
        account: { type: "string", description: "Account filter (optional)" },
        scenario: { type: "string", description: "Scenario (optional)" },
        match_status: {
          type: "string",
          enum: ["Matched", "Unmatched", "Disputed", "AutoMatched"],
          description: "Filter by matching status (optional)",
        },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["period", "year"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);

      // FCCS does not have a direct /intercompany REST endpoint.
      // Retrieve IC data via exportdataslice with the Intercompany dimension.
      const scenario = (args.scenario as string) || "Actual";
      const entity = (args.entity as string) || "Total Geography";
      const partner = (args.partner as string) || "FCCS_Total Intercompany";
      const account = (args.account as string) || "FCCS_Total Assets";

      try {
        const gridDef = {
          exportPlanningData: false,
          gridDefinition: {
            suppressMissingBlocks: true,
            suppressMissingRows: true,
            suppressMissingColumns: true,
            pov: {
              dimensions: ["Scenario", "Year", "Period", "View", "Value", "Entity"],
              members: [
                [scenario],
                [args.year as string],
                [args.period as string],
                ["Periodic"],
                ["Entity Input"],
                [entity],
              ],
            },
            columns: [{ dimensions: ["Account"], members: [[account]] }],
            rows: [{ dimensions: ["Intercompany"], members: [[partner]] }],
          },
        };

        const res = await client.post<unknown>(
          client.planPath("Consol", "/exportdataslice"),
          gridDef
        );

        return {
          success: true,
          message: `Intercompany data retrieved for ${args.period} ${args.year} (Entity: ${entity}, Partner: ${partner}).`,
          data: res,
          warnings: args.match_status ? [
            "Match status filtering is not available via exportdataslice. Use the FCC UI for IC matching status details.",
          ] : undefined,
        };
      } catch (err) {
        return {
          success: false,
          message: `Could not retrieve IC transactions: ${(err as Error).message}. FCCS intercompany data is accessed via exportdataslice with the Intercompany dimension. Verify the entity and account names are correct.`,
          data: { period: args.period, year: args.year, entity, partner },
        };
      }
    }
  );

  // ─── fcc_manage_ic_matching ──────────────────────────────────────────────
  registerTool(
    "fcc_manage_ic_matching",
    "Match, unmatch, dispute, or run auto-match on intercompany transactions in FCC.",
    {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: IC_ACTIONS,
          description: "Matching action to perform",
        },
        period: { type: "string", description: "Period" },
        year: { type: "string", description: "Year" },
        scenario: { type: "string", description: "Scenario (optional)" },
        transaction_ids: {
          type: "array",
          items: { type: "string" },
          description: "List of transaction IDs to match/unmatch/dispute (not required for auto_match)",
        },
        entity: { type: "string", description: "Entity for auto_match scope (optional)" },
        tolerance: {
          type: "number",
          description: "Matching tolerance amount for auto_match (optional)",
        },
        dispute_reason: { type: "string", description: "Reason for disputing (used with dispute action)" },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["action", "period", "year"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);
      const action = args.action as IcAction;

      // FCCS does not have direct REST endpoints for IC matching operations.
      // Use the Jobs API to run IC matching reports/jobs instead.

      if (action === "auto_match") {
        // Run IC auto-match via the Jobs API
        try {
          const jobPayload = {
            jobType: "IC_AUTO_MATCH",
            jobName: "IC Auto Match",
            parameters: {
              period: args.period,
              year: args.year,
              scenario: args.scenario || "Actual",
              ...(args.entity ? { entity: args.entity } : {}),
              ...(args.tolerance !== undefined ? { tolerance: String(args.tolerance) } : {}),
            },
          };

          const submitRes = await client.post<{ jobId: number }>(
            client.appPath("/jobs"),
            jobPayload
          );

          const status = await client.pollJob(submitRes.jobId, 10 * 60 * 1000);

          return {
            success: status.status === 0 || status.status === 1,
            message: `IC auto-match for ${args.period} ${args.year}: ${jobStatusLabel(status.status)}`,
            data: status,
            jobId: submitRes.jobId,
          };
        } catch (err) {
          return {
            success: false,
            message: `IC auto-match failed: ${(err as Error).message}. The IC auto-match job type may need to be verified. Try running IC matching from the FCC UI under Intercompany > Matching.`,
            warnings: [
              "IC matching in FCCS is typically managed through the FCC UI or via business rules.",
              "The Jobs API job type for IC matching may vary by FCCS version.",
            ],
          };
        }
      }

      if (action === "match" || action === "unmatch" || action === "dispute") {
        const ids = args.transaction_ids as string[] | undefined;
        if (!ids || ids.length === 0) {
          return { success: false, message: `${action} requires transaction_ids` };
        }

        // IC match/unmatch/dispute operations via Jobs API
        try {
          const jobTypeMap: Record<string, string> = {
            match: "IC_MATCH",
            unmatch: "IC_UNMATCH",
            dispute: "IC_DISPUTE",
          };

          const jobPayload = {
            jobType: jobTypeMap[action],
            jobName: `IC ${action}`,
            parameters: {
              period: args.period,
              year: args.year,
              scenario: args.scenario || "Actual",
              transactionIds: ids.join(","),
              ...(action === "dispute" && args.dispute_reason ? { reason: args.dispute_reason } : {}),
            },
          };

          const submitRes = await client.post<{ jobId: number }>(
            client.appPath("/jobs"),
            jobPayload
          );

          const status = await client.pollJob(submitRes.jobId, 10 * 60 * 1000);

          return {
            success: status.status === 0 || status.status === 1,
            message: `IC ${action} applied to ${ids.length} transaction(s): ${jobStatusLabel(status.status)}`,
            data: status,
            jobId: submitRes.jobId,
          };
        } catch (err) {
          return {
            success: false,
            message: `IC ${action} failed: ${(err as Error).message}. IC matching operations may need to be performed through the FCC UI or custom business rules.`,
            warnings: [
              "FCCS does not expose direct REST endpoints for IC transaction-level matching.",
              "Consider using the FCC UI under Intercompany > Matching for individual transaction operations.",
            ],
          };
        }
      }

      return { success: false, message: `Unknown IC action: ${action}` };
    }
  );
}
