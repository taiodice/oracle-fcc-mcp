// Data Management tools:
// fcc_export_data, fcc_query_mdx, fcc_write_data, fcc_import_data

import { FccClientManager } from "../fcc-client-manager.js";
import { ToolResult } from "../types.js";
import { jobStatusLabel } from "../fcc-client.js";

type RegisterFn = (name: string, description: string, schema: object, handler: (args: Record<string, unknown>) => Promise<ToolResult>) => void;

export function registerDataTools(manager: FccClientManager, registerTool: RegisterFn): void {

  // ─── fcc_export_data ──────────────────────────────────────────────────────
  registerTool(
    "fcc_export_data",
    "Export data from FCC using a grid definition. Specify the FCC dimensions: Entity (consolidation entity), Scenario (Actual/Budget), Period, Year, View (Periodic/YTD/CYTD), Value (Entity Input/Parent Currency Total/etc.), and Accounts. Returns tabular JSON.",
    {
      type: "object",
      properties: {
        entity: { type: "string", description: "Entity member name (e.g., 'US Holdings', 'Total Geography')" },
        scenario: { type: "string", description: "Scenario (e.g., 'Actual', 'Budget')" },
        period: {
          oneOf: [
            { type: "string" },
            { type: "array", items: { type: "string" } },
          ],
          description: "Period or list of periods (e.g., 'Jan' or ['Jan', 'Feb', 'Mar'])",
        },
        year: { type: "string", description: "Year (e.g., 'FY2024')" },
        view: { type: "string", description: "View dimension (e.g., 'Periodic', 'YTD', 'CYTD'). Optional." },
        value: { type: "string", description: "Value dimension (e.g., 'Entity Input', 'Parent Currency Total', 'Entity Currency Total'). Optional." },
        accounts: {
          type: "array",
          items: { type: "string" },
          description: "Account members to retrieve (e.g., ['Revenue', 'Expenses', 'NetIncome'])",
        },
        plan_type: { type: "string", description: "FCC plan type (e.g., 'FCM', 'Consol'). Auto-detected if not specified." },
        suppress_missing: { type: "boolean", description: "Suppress rows with missing data (default: true)" },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["entity", "scenario", "period", "year", "accounts"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);
      const suppressMissing = args.suppress_missing !== false;

      // Resolve plan type
      const planType = (args.plan_type as string) || await getDefaultPlanType(client);

      // Build FCC-specific POV dimensions
      const povDimensions: string[] = ["Scenario", "Year", "Entity"];
      const povMembers: string[][] = [[args.scenario as string], [args.year as string], [args.entity as string]];

      if (args.view) { povDimensions.push("View"); povMembers.push([args.view as string]); }
      if (args.value) { povDimensions.push("Value"); povMembers.push([args.value as string]); }

      // Periods as columns
      const periods = Array.isArray(args.period) ? args.period as string[] : [args.period as string];

      const gridDef = {
        exportPlanningData: false,
        gridDefinition: {
          pov: { dimensions: povDimensions, members: povMembers },
          columns: [{ dimensions: ["Period"], members: [periods] }],
          rows: [{ dimensions: ["Account"], members: [args.accounts as string[]] }],
        },
        suppressMissingBlocks: suppressMissing,
        suppressMissingRows: suppressMissing,
      };

      const res = await client.post<unknown>(
        client.planPath(planType, "/exportdataslice"),
        gridDef
      );

      return {
        success: true,
        message: `Data exported for ${args.entity} / ${args.scenario} / ${args.year} / ${Array.isArray(args.period) ? args.period.join(", ") : args.period}`,
        data: res,
      };
    }
  );

  // ─── fcc_query_mdx ────────────────────────────────────────────────────────
  registerTool(
    "fcc_query_mdx",
    "Execute an MDX query against the FCC cube. This is the most flexible way to retrieve complex consolidation data. FCC dimensions: Entity, Scenario, Period, Year, View (Periodic/YTD), Value (Entity Input/Parent Currency Total), Account, Currency, Intercompany. Supports IDescendants(), IChildren(), TopCount(), and other MDX member functions.",
    {
      type: "object",
      properties: {
        mdx_query: {
          type: "string",
          description: "Full MDX query string. Example: SELECT {[Jan],[Feb]} ON COLUMNS, {IDescendants([Total Geography])} ON ROWS FROM FCM WHERE ([Actual],[FY2024],[Entity Input],[Periodic])",
        },
        plan_type: { type: "string", description: "FCC plan type (e.g., 'FCM'). Auto-detected if not specified." },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["mdx_query"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);
      const planType = (args.plan_type as string) || await getDefaultPlanType(client);

      const payload = {
        exportPlanningData: false,
        mdxQuery: args.mdx_query,
      };

      const res = await client.post<unknown>(
        client.planPath(planType, "/exportdataslice"),
        payload
      );

      return {
        success: true,
        message: "MDX query executed successfully.",
        data: res,
      };
    }
  );

  // ─── fcc_write_data ───────────────────────────────────────────────────────
  registerTool(
    "fcc_write_data",
    "Write cell-level data back to FCC (importdataslice). Best for targeted updates to specific cells. Returns count of accepted, updated, and rejected cells. For bulk loads use fcc_import_data instead.",
    {
      type: "object",
      properties: {
        data_grid: {
          type: "object",
          description: "Grid definition with POV, rows, columns, and data values. Same structure as exportdataslice grid.",
        },
        aggregate: {
          type: "boolean",
          description: "Whether to aggregate (roll up) the data after import (default: false)",
        },
        cell_notes_option: {
          type: "string",
          enum: ["Overwrite", "Append", "Skip"],
          description: "How to handle existing cell notes (default: Overwrite)",
        },
        plan_type: { type: "string", description: "FCC plan type. Auto-detected if not specified." },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["data_grid"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);
      const planType = (args.plan_type as string) || await getDefaultPlanType(client);

      const payload = {
        aggregateEssbaseData: args.aggregate ?? false,
        cellNotesOption: args.cell_notes_option || "Overwrite",
        dateFormat: "MM/DD/YYYY",
        strictDateValidation: true,
        customParams: {
          IncludeRejectedCells: true,
          IncludeRejectedCellsWithDetails: false,
        },
        dataGrid: args.data_grid,
      };

      const res = await client.post<{
        numAcceptedCells?: number;
        numUpdateCells?: number;
        numRejectedCells?: number;
        rejectedCells?: unknown[];
      }>(
        client.planPath(planType, "/importdataslice"),
        payload
      );

      const accepted = res.numAcceptedCells ?? 0;
      const rejected = res.numRejectedCells ?? 0;

      return {
        success: rejected === 0,
        message: `Data write complete: ${accepted} cells accepted, ${rejected} cells rejected.`,
        data: res,
        warnings: rejected > 0 ? [`${rejected} cells were rejected. Check data.rejectedCells for details.`] : undefined,
      };
    }
  );

  // ─── fcc_import_data ──────────────────────────────────────────────────────
  registerTool(
    "fcc_import_data",
    "Upload a data file and run a bulk IMPORT_DATA job in FCC. For small targeted updates use fcc_write_data instead. Accepts either a local file path or base64-encoded file content (for remote LLM clients).",
    {
      type: "object",
      properties: {
        file_path: { type: "string", description: "Local path to the data file to upload" },
        file_content: { type: "string", description: "Base64-encoded file content (alternative to file_path for remote clients)" },
        file_name: { type: "string", description: "Name for the uploaded file in EPM Cloud (e.g., 'import_data.csv')" },
        import_mode: {
          type: "string",
          enum: ["REPLACE", "MERGE", "ACCUMULATE"],
          description: "Import mode (default: MERGE)",
        },
        timeout_minutes: { type: "number", description: "Max minutes to wait for job completion (default: 30)" },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["file_name"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);
      const startTime = Date.now();
      const timeoutMs = ((args.timeout_minutes as number) || 30) * 60 * 1000;

      if (!args.file_path && !args.file_content) {
        return { success: false, message: "Either file_path or file_content (base64) must be provided." };
      }

      // Get file content
      let fileBuffer: Buffer;
      if (args.file_content) {
        fileBuffer = Buffer.from(args.file_content as string, "base64");
      } else {
        const { readFileSync } = await import("fs");
        fileBuffer = readFileSync(args.file_path as string);
      }

      // Upload file
      const fileName = args.file_name as string;
      await client.uploadFile(fileName, fileBuffer);

      // Submit import job
      const jobPayload = {
        jobType: "IMPORT_DATA",
        jobName: `Import_${fileName}`,
        parameters: {
          importMode: args.import_mode || "MERGE",
          fileName,
        },
      };

      const submitRes = await client.post<{ jobId: number }>(
        client.appPath("/jobs"),
        jobPayload
      );

      const jobId = submitRes.jobId;
      const status = await client.pollJob(jobId, timeoutMs);
      const duration_ms = Date.now() - startTime;

      return {
        success: status.status === 0 || status.status === 1,
        message: `Import of "${fileName}": ${jobStatusLabel(status.status)}`,
        data: status,
        jobId,
        duration_ms,
      };
    }
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getDefaultPlanType(client: import("../fcc-client.js").FccClient): Promise<string> {
  try {
    const res = await client.get<{ items: Array<{ name: string }> }>(
      client.appPath("/plantypes")
    );
    return res.items?.[0]?.name || "FCM";
  } catch {
    return "FCM"; // FCC default plan type
  }
}
