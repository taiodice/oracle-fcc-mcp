// Journal tools: fcc_manage_journal, fcc_get_journal
// FCC Journal REST API: verify endpoint from Oracle FCC REST API docs
// Likely: /HyperionPlanning/rest/v3/applications/{app}/journals
//      or /fcm/rest/v1/journals

import { FccClientManager } from "../fcc-client-manager.js";
import { ToolResult } from "../types.js";

type RegisterFn = (name: string, description: string, schema: object, handler: (args: Record<string, unknown>) => Promise<ToolResult>) => void;

// FCC journal actions and their HTTP methods
const JOURNAL_ACTIONS = ["create", "list", "submit", "approve", "post", "reject", "delete"] as const;
type JournalAction = typeof JOURNAL_ACTIONS[number];

export function registerJournalTools(manager: FccClientManager, registerTool: RegisterFn): void {

  // ─── fcc_manage_journal ──────────────────────────────────────────────────
  registerTool(
    "fcc_manage_journal",
    "Create, list, submit, approve, post, or reject FCC journals. Journals are used to record manual adjustments during the consolidation process.",
    {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: JOURNAL_ACTIONS,
          description: "Action to perform on journals",
        },
        // For list
        period: { type: "string", description: "Period filter (e.g., 'Jan'). Used for list action." },
        year: { type: "string", description: "Year filter (e.g., 'FY2024'). Used for list action." },
        scenario: { type: "string", description: "Scenario filter (e.g., 'Actual'). Used for list action." },
        status: {
          type: "string",
          enum: ["Working", "Submitted", "Approved", "Posted", "Rejected"],
          description: "Journal status filter for list action",
        },
        // For create
        journal_label: { type: "string", description: "Unique journal label/name (required for create)" },
        journal_type: {
          type: "string",
          enum: ["Regular", "Balanced", "Unbalanced"],
          description: "Journal type for create (default: Regular)",
        },
        entity: { type: "string", description: "Entity for the journal entry (required for create)" },
        description: { type: "string", description: "Journal description" },
        line_items: {
          type: "array",
          description: "Journal line items for create. Each item: { account, value, entity? }",
          items: {
            type: "object",
            properties: {
              account: { type: "string" },
              value: { type: "number" },
              entity: { type: "string" },
            },
          },
        },
        // For submit/approve/post/reject/delete
        journal_id: { type: "string", description: "Journal ID or label (required for submit/approve/post/reject/delete)" },
        reject_reason: { type: "string", description: "Reason for rejection (used with reject action)" },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["action"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);
      const action = args.action as JournalAction;

      // Build the journals base path — verify from Oracle FCC REST API docs
      // The exact endpoint may be /HyperionPlanning/rest/v3/applications/{app}/journals
      // or a different FCC-specific path
      const journalsPath = client.appPath("/journals");

      switch (action) {
        case "list": {
          const params = new URLSearchParams();
          if (args.period) params.set("period", args.period as string);
          if (args.year) params.set("year", args.year as string);
          if (args.scenario) params.set("scenario", args.scenario as string);
          if (args.status) params.set("status", args.status as string);
          const query = params.toString() ? `?${params.toString()}` : "";
          const res = await client.get<{ items: unknown[] }>(`${journalsPath}${query}`);
          return {
            success: true,
            message: `Found ${res.items?.length ?? 0} journal(s).`,
            data: res.items,
          };
        }

        case "create": {
          if (!args.journal_label || !args.period || !args.year || !args.scenario) {
            return {
              success: false,
              message: "Create requires: journal_label, period, year, scenario",
            };
          }
          const createPayload = {
            label: args.journal_label,
            type: args.journal_type || "Regular",
            period: args.period,
            year: args.year,
            scenario: args.scenario,
            entity: args.entity,
            description: args.description,
            lineItems: args.line_items || [],
          };
          const res = await client.post<unknown>(journalsPath, createPayload);
          return {
            success: true,
            message: `Journal "${args.journal_label}" created successfully.`,
            data: res,
          };
        }

        case "submit":
        case "approve":
        case "post":
        case "reject": {
          if (!args.journal_id) {
            return { success: false, message: `${action} requires journal_id` };
          }
          const actionPath = `${journalsPath}/${encodeURIComponent(args.journal_id as string)}/${action}`;
          const actionPayload = action === "reject" ? { reason: args.reject_reason } : {};
          const res = await client.post<unknown>(actionPath, actionPayload);
          return {
            success: true,
            message: `Journal "${args.journal_id}" ${action}ed successfully.`,
            data: res,
          };
        }

        case "delete": {
          if (!args.journal_id) {
            return { success: false, message: "delete requires journal_id" };
          }
          await client.delete(`${journalsPath}/${encodeURIComponent(args.journal_id as string)}`);
          return {
            success: true,
            message: `Journal "${args.journal_id}" deleted.`,
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
        journal_id: { type: "string", description: "Journal ID or label" },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["journal_id"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);
      const journalId = encodeURIComponent(args.journal_id as string);
      const res = await client.get<unknown>(client.appPath(`/journals/${journalId}`));
      return {
        success: true,
        message: `Journal details for "${args.journal_id}".`,
        data: res,
      };
    }
  );
}
