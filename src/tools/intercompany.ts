// Intercompany tools:
// fcc_get_ic_transactions, fcc_manage_ic_matching
// No direct IC REST endpoint exists — use exportdataslice and Jobs API

import { FccClientManager } from "../fcc-client-manager.js";
import { ToolResult } from "../types.js";
import { jobStatusLabel } from "../fcc-client.js";

type RegisterFn = (name: string, description: string, schema: object, handler: (args: Record<string, unknown>) => Promise<ToolResult>) => void;

export function registerIntercompanyTools(manager: FccClientManager, registerTool: RegisterFn): void {

  // ─── fcc_get_ic_transactions ─────────────────────────────────────────────
  registerTool(
    "fcc_get_ic_transactions",
    "List intercompany transaction data for a specific period. Uses exportdataslice with the Intercompany dimension on rows to show IC balances by partner entity.",
    {
      type: "object",
      properties: {
        entity: { type: "string", description: "Source entity (e.g., 'US001')" },
        period: { type: "string", description: "Period (e.g., 'Jan')" },
        year: { type: "string", description: "Year (e.g., 'FY25')" },
        scenario: { type: "string", description: "Scenario (default: 'Actual')" },
        accounts: {
          type: "array",
          items: { type: "string" },
          description: "Account members to query (e.g., ['FCCS_Intercompany Receivables', 'FCCS_Intercompany Payables']). Optional — defaults to FCCS_Total Assets.",
        },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["entity", "period", "year"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);
      const scenario = (args.scenario as string) || "Actual";
      const accounts = (args.accounts as string[]) || ["FCCS_Total Assets"];

      // No /intercompany endpoint exists — use exportdataslice with Intercompany dim on rows
      const gridDef = {
        exportPlanningData: false,
        gridDefinition: {
          suppressMissingBlocks: true,
          suppressMissingRows: true,
          suppressMissingColumns: true,
          pov: {
            dimensions: ["Scenario", "Year", "Period", "Entity", "View", "Value"],
            members: [
              [scenario],
              [args.year as string],
              [args.period as string],
              [args.entity as string],
              ["Periodic"],
              ["Entity Input"],
            ],
          },
          columns: [{ dimensions: ["Account"], members: [accounts] }],
          rows: [{ dimensions: ["Intercompany"], members: [["IChildren(FCCS_Total Intercompany)"]] }],
        },
      };

      try {
        const res = await client.post<{ rows?: Array<{ headers: string[]; data: string[] }> }>(
          client.planPath("Consol", "/exportdataslice"),
          gridDef
        );

        const transactions = (res.rows ?? []).map((r) => ({
          partner: r.headers?.[0],
          values: r.data,
        }));

        return {
          success: true,
          message: `Found ${transactions.length} IC partner(s) with data for ${args.entity} in ${args.period} ${args.year}.`,
          data: {
            entity: args.entity,
            period: args.period,
            year: args.year,
            scenario,
            accounts,
            transactions,
          },
        };
      } catch (err) {
        return {
          success: false,
          message: `Could not retrieve IC transactions: ${(err as Error).message}. Try using fcc_query_mdx with Intercompany dimension for more flexible queries.`,
        };
      }
    }
  );

  // ─── fcc_manage_ic_matching ───────────────────────────���──────────────────
  registerTool(
    "fcc_manage_ic_matching",
    "Run IC matching operations via the Jobs API. Supports generating an IC matching report or running auto-match.",
    {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["report", "auto_match"],
          description: "Action: 'report' generates an IC matching report, 'auto_match' runs automatic matching",
        },
        period: { type: "string", description: "Period" },
        year: { type: "string", description: "Year" },
        scenario: { type: "string", description: "Scenario (default: 'Actual')" },
        entity: { type: "string", description: "Entity scope for matching (optional)" },
        timeout_minutes: { type: "number", description: "Max minutes to wait (default: 30)" },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["action", "period", "year"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);
      const action = args.action as string;
      const scenario = (args.scenario as string) || "Actual";
      const timeoutMs = ((args.timeout_minutes as number) || 30) * 60 * 1000;
      const startTime = Date.now();

      // Use Jobs API for IC operations — no direct IC matching endpoint exists
      const jobPayload: Record<string, unknown> = {
        jobType: action === "report" ? "RULES" : "RULES",
        jobName: action === "report" ? "IC Matching Report" : "IC Auto Match",
        parameters: {
          period: args.period,
          year: args.year,
          scenario,
        },
      };
      if (args.entity) {
        (jobPayload.parameters as Record<string, unknown>).entity = args.entity;
      }

      try {
        const submitRes = await client.post<{ jobId: number }>(
          client.appPath("/jobs"),
          jobPayload
        );

        const jobId = submitRes.jobId;
        const status = await client.pollJob(jobId, timeoutMs);
        const duration_ms = Date.now() - startTime;

        return {
          success: status.status === 0 || status.status === 1,
          message: `IC ${action} for ${args.period} ${args.year}: ${jobStatusLabel(status.status)}`,
          data: status,
          jobId,
          duration_ms,
        };
      } catch (err) {
        return {
          success: false,
          message: `IC ${action} failed: ${(err as Error).message}. IC matching operations may need to be performed via the FCC Cloud UI.`,
        };
      }
    }
  );
}
