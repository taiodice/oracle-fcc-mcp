// Journal tools: fcc_manage_journal, fcc_get_journal
// Oracle FCCS Journal REST API:
//   GET  /applications/{app}/journals?q={json}&offset=N&limit=N
//   POST /applications/{app}/journals/{label}/actions  (submit/approve/post/unpost/reject)
//   POST /applications/{app}/journalPeriods/{period}/actions  (OPEN/CLOSE journal period)

import { FccClientManager } from "../fcc-client-manager.js";
import { ToolResult } from "../types.js";

type RegisterFn = (name: string, description: string, schema: object, handler: (args: Record<string, unknown>) => Promise<ToolResult>) => void;

const JOURNAL_ACTIONS = ["list", "submit", "approve", "post", "unpost", "reject"] as const;
type JournalAction = typeof JOURNAL_ACTIONS[number];

export function registerJournalTools(manager: FccClientManager, registerTool: RegisterFn): void {

  // ─── fcc_manage_journal ──────────────────────────────────────────────────
  registerTool(
    "fcc_manage_journal",
    "List journals or perform actions (submit/approve/post/unpost/reject) on FCC journals.",
    {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: JOURNAL_ACTIONS,
          description: "Action to perform",
        },
        // For list
        period: { type: "string", description: "Period (e.g., 'Jan')" },
        year: { type: "string", description: "Year (e.g., 'FY25')" },
        scenario: { type: "string", description: "Scenario (e.g., 'Actual')" },
        status: {
          type: "string",
          enum: ["WORKING", "SUBMITTED", "APPROVED", "POSTED"],
          description: "Journal status filter for list",
        },
        entity: { type: "string", description: "Entity filter" },
        label: { type: "string", description: "Journal label filter (for list) or target (for actions)" },
        group: { type: "string", description: "Journal group filter" },
        description: { type: "string", description: "Description filter" },
        consolidation: { type: "string", description: "Consolidation type (default: 'FCCS_Entity Input')" },
        offset: { type: "number", description: "Pagination offset (default: 0)" },
        limit: { type: "number", description: "Max journals to return (default: 25)" },
        // For submit/approve/post/unpost/reject
        journal_label: { type: "string", description: "Journal label (required for submit/approve/post/unpost/reject)" },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["action"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);
      const action = args.action as JournalAction;

      switch (action) {
        case "list": {
          if (!args.scenario || !args.year || !args.period || !args.status) {
            return {
              success: false,
              message: "List requires: scenario, year, period, status",
            };
          }
          // Oracle FCCS uses ?q={json} format for journal listing
          const queryFilter: Record<string, string> = {
            scenario: args.scenario as string,
            year: args.year as string,
            period: args.period as string,
            status: args.status as string,
          };
          if (args.entity) queryFilter.entity = args.entity as string;
          if (args.label) queryFilter.label = args.label as string;
          if (args.group) queryFilter.group = args.group as string;
          if (args.description) queryFilter.description = args.description as string;
          if (args.consolidation) queryFilter.consolidation = args.consolidation as string;

          const q = encodeURIComponent(JSON.stringify(queryFilter));
          const offset = (args.offset as number) || 0;
          const limit = (args.limit as number) || 25;

          const res = await client.get<{
            items?: Array<Record<string, unknown>>;
            totalResults?: number;
            hasMore?: boolean;
            count?: number;
          }>(
            client.appPath(`/journals?q=${q}&offset=${offset}&limit=${limit}`)
          );

          const items = res.items ?? [];
          return {
            success: true,
            message: `Found ${res.totalResults ?? items.length} journal(s). Showing ${items.length} (offset ${offset}).`,
            data: {
              journals: items,
              totalResults: res.totalResults,
              hasMore: res.hasMore,
              count: res.count,
            },
          };
        }

        case "submit":
        case "approve":
        case "post":
        case "unpost":
        case "reject": {
          const journalLabel = (args.journal_label || args.label) as string | undefined;
          if (!journalLabel || !args.scenario || !args.year || !args.period) {
            return {
              success: false,
              message: `${action} requires: journal_label, scenario, year, period`,
            };
          }
          const actionPayload = {
            parameters: {
              scenario: args.scenario as string,
              year: args.year as string,
              period: args.period as string,
              consolidation: (args.consolidation as string) || "FCCS_Entity Input",
              action: action.toUpperCase(),
            },
          };
          const labelEncoded = encodeURIComponent(journalLabel);
          const res = await client.post<{ actionDetail?: string; actionStatus?: number }>(
            client.appPath(`/journals/${labelEncoded}/actions`),
            actionPayload
          );
          const succeeded = res.actionStatus === 0;
          return {
            success: succeeded,
            message: succeeded
              ? `Journal "${journalLabel}" — ${res.actionDetail || action} succeeded.`
              : `Journal "${journalLabel}" — ${action} failed: ${res.actionDetail || "unknown error"}`,
            data: res,
          };
        }

        default:
          return { success: false, message: `Unknown action: ${action}` };
      }
    }
  );

  // ─── fcc_get_journal ─────────────────────────────────────────────────────
  registerTool(
    "fcc_get_journal",
    "Get the full details of a specific FCC journal including all line items, status, and audit trail.",
    {
      type: "object",
      properties: {
        journal_label: { type: "string", description: "Journal label" },
        scenario: { type: "string", description: "Scenario (e.g., 'Actual')" },
        year: { type: "string", description: "Year (e.g., 'FY25')" },
        period: { type: "string", description: "Period (e.g., 'Jan')" },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["journal_label"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);
      const label = encodeURIComponent(args.journal_label as string);

      // Build query string for context
      const params: string[] = [];
      if (args.scenario) params.push(`scenario=${encodeURIComponent(args.scenario as string)}`);
      if (args.year) params.push(`year=${encodeURIComponent(args.year as string)}`);
      if (args.period) params.push(`period=${encodeURIComponent(args.period as string)}`);
      const qs = params.length ? `?${params.join("&")}` : "";

      const res = await client.get<Record<string, unknown>>(
        client.appPath(`/journals/${label}${qs}`)
      );
      return {
        success: true,
        message: `Journal details for "${args.journal_label}".`,
        data: res,
      };
    }
  );

  // ─── fcc_manage_journal_period ─────────────────────────────────────────
  // This is the ACTUAL period management endpoint for FCCS (journal periods)
  registerTool(
    "fcc_manage_journal_period",
    "Open or close a journal period in FCC. This controls whether journals can be created/modified for a specific period. Uses the FCCS journalPeriods REST API.",
    {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["OPEN", "CLOSE"],
          description: "Action: OPEN or CLOSE the journal period",
        },
        period: { type: "string", description: "Period name (e.g., 'Jan')" },
        year: { type: "string", description: "Year (e.g., 'FY25')" },
        scenario: { type: "string", description: "Scenario (e.g., 'Actual')" },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["action", "period", "year", "scenario"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);
      const period = args.period as string;
      const year = args.year as string;
      const scenario = args.scenario as string;
      const action = (args.action as string).toUpperCase();

      const periodEncoded = encodeURIComponent(period);

      // Strategy 1: POST with body (per Oracle docs sample)
      try {
        const payload = { scenario, year, period, action };
        const res = await client.post<{ actionDetail?: string; actionStatus?: number }>(
          client.appPath(`/journalPeriods/${periodEncoded}/actions`),
          payload
        );
        const succeeded = res.actionStatus === 0;
        return {
          success: succeeded,
          message: succeeded
            ? `Journal period ${period} (${scenario} / ${year}) — ${res.actionDetail || action} succeeded.`
            : `Journal period action failed: ${res.actionDetail || "unknown error"}`,
          data: res,
        };
      } catch (err1) {
        // Strategy 2: POST with parameters in query string instead of body
        try {
          const qs = `?scenario=${encodeURIComponent(scenario)}&year=${encodeURIComponent(year)}&action=${encodeURIComponent(action)}`;
          const res = await client.postNoBody<{ actionDetail?: string; actionStatus?: number }>(
            client.appPath(`/journalPeriods/${periodEncoded}/actions${qs}`)
          );
          const succeeded = res.actionStatus === 0;
          return {
            success: succeeded,
            message: succeeded
              ? `Journal period ${period} (${scenario} / ${year}) — ${res.actionDetail || action} succeeded.`
              : `Journal period action failed: ${res.actionDetail || "unknown error"}`,
            data: res,
          };
        } catch (err2) {
          // Strategy 3: Try wrapping in "parameters" object like journal actions
          try {
            const payload = {
              parameters: { scenario, year, period, action },
            };
            const res = await client.post<{ actionDetail?: string; actionStatus?: number }>(
              client.appPath(`/journalPeriods/${periodEncoded}/actions`),
              payload
            );
            const succeeded = res.actionStatus === 0;
            return {
              success: succeeded,
              message: succeeded
                ? `Journal period ${period} (${scenario} / ${year}) — ${res.actionDetail || action} succeeded.`
                : `Journal period action failed: ${res.actionDetail || "unknown error"}`,
              data: res,
            };
          } catch (err3) {
            // All strategies failed — return the most informative error
            const errors = [err1, err2, err3].map((e) => (e as Error).message);
            return {
              success: false,
              message: `Journal period ${action} failed for ${period} / ${scenario} / ${year}. Tried 3 request formats.`,
              warnings: errors,
            };
          }
        }
      }
    }
  );
}
