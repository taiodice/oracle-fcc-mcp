// Intercompany tools:
// fcc_get_ic_transactions, fcc_manage_ic_matching
// FCC Intercompany endpoint: verify from Oracle FCC REST API docs
// Likely: /HyperionPlanning/rest/v3/applications/{app}/intercompany
//      or /fcm/rest/v1/intercompany

import { FccClientManager } from "../fcc-client-manager.js";
import { ToolResult } from "../types.js";

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

      const params = new URLSearchParams({
        period: args.period as string,
        year: args.year as string,
      });
      if (args.entity) params.set("entity", args.entity as string);
      if (args.partner) params.set("partner", args.partner as string);
      if (args.account) params.set("account", args.account as string);
      if (args.scenario) params.set("scenario", args.scenario as string);
      if (args.match_status) params.set("matchStatus", args.match_status as string);

      // FCC intercompany endpoint — verify from Oracle docs
      const icPath = client.appPath(`/intercompany?${params.toString()}`);

      try {
        const res = await client.get<{ items: unknown[]; totalCount?: number }>(icPath);
        return {
          success: true,
          message: `Found ${res.items?.length ?? 0} intercompany transaction(s) for ${args.period} ${args.year}.`,
          data: res,
        };
      } catch (err) {
        return {
          success: false,
          message: `Could not retrieve IC transactions: ${(err as Error).message}. Note: The intercompany endpoint path must be verified from Oracle FCC REST API documentation. It may be at /fcm/rest/v1/intercompany instead.`,
          data: { period: args.period, year: args.year },
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

      const baseIcPath = client.appPath("/intercompany");

      switch (action) {
        case "auto_match": {
          const autoMatchPayload: Record<string, unknown> = {
            period: args.period,
            year: args.year,
          };
          if (args.scenario) autoMatchPayload.scenario = args.scenario;
          if (args.entity) autoMatchPayload.entity = args.entity;
          if (args.tolerance !== undefined) autoMatchPayload.tolerance = args.tolerance;

          try {
            const res = await client.post<unknown>(`${baseIcPath}/automatch`, autoMatchPayload);
            return {
              success: true,
              message: `Auto-match completed for ${args.period} ${args.year}.`,
              data: res,
            };
          } catch (err) {
            return {
              success: false,
              message: `Auto-match failed: ${(err as Error).message}. Verify the IC auto-match endpoint from Oracle FCC REST API docs.`,
            };
          }
        }

        case "match":
        case "unmatch":
        case "dispute": {
          const ids = args.transaction_ids as string[] | undefined;
          if (!ids || ids.length === 0) {
            return { success: false, message: `${action} requires transaction_ids` };
          }

          const actionPayload: Record<string, unknown> = {
            transactionIds: ids,
            period: args.period,
            year: args.year,
          };
          if (action === "dispute" && args.dispute_reason) {
            actionPayload.reason = args.dispute_reason;
          }

          try {
            const res = await client.post<unknown>(`${baseIcPath}/${action}`, actionPayload);
            return {
              success: true,
              message: `${action} applied to ${ids.length} transaction(s).`,
              data: res,
            };
          } catch (err) {
            return {
              success: false,
              message: `IC ${action} failed: ${(err as Error).message}. Verify the IC matching endpoint from Oracle FCC REST API docs.`,
            };
          }
        }

        default:
          return { success: false, message: `Unknown IC action: ${action}` };
      }
    }
  );
}
