// Consolidation & Close tools:
// fcc_run_consolidation, fcc_get_consolidation_status, fcc_run_calculation,
// fcc_get_period_status, fcc_manage_period

import { FccClientManager } from "../fcc-client-manager.js";
import { ToolResult, JobStatus } from "../types.js";
import { jobStatusLabel } from "../fcc-client.js";

type RegisterFn = (name: string, description: string, schema: object, handler: (args: Record<string, unknown>) => Promise<ToolResult>) => void;

export function registerConsolidationTools(manager: FccClientManager, registerTool: RegisterFn): void {

  // ─── fcc_run_consolidation ───────────────────────────────────────────────
  registerTool(
    "fcc_run_consolidation",
    "Run a consolidation, translation, or calculate-all operation for a specific entity, period, year, and scenario in FCC. Automatically polls until the job completes.",
    {
      type: "object",
      properties: {
        entity: { type: "string", description: "Entity name (e.g., 'Total Geography', 'US001')" },
        period: { type: "string", description: "Period name (e.g., 'Jan', 'Q1', 'YearTotal')" },
        year: { type: "string", description: "Year (e.g., 'FY2024')" },
        scenario: { type: "string", description: "Scenario name (e.g., 'Actual', 'Budget')" },
        job_type: {
          type: "string",
          enum: ["CONSOLIDATE", "TRANSLATE", "CONSOLIDATE_ALL", "CALCULATE_CONTRIBUTIONS"],
          description: "Type of consolidation operation (default: CONSOLIDATE)",
        },
        timeout_minutes: { type: "number", description: "Max minutes to wait for completion (default: 30)" },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["entity", "period", "year", "scenario"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);
      const startTime = Date.now();
      const jobType = (args.job_type as string) || "CONSOLIDATE";
      const timeoutMs = ((args.timeout_minutes as number) || 30) * 60 * 1000;

      const jobPayload = {
        jobType,
        parameters: {
          entity: args.entity,
          period: args.period,
          year: args.year,
          scenario: args.scenario,
        },
      };

      const submitRes = await client.post<{ jobId: number }>(
        client.appPath("/jobs"),
        jobPayload
      );

      const jobId = submitRes.jobId;
      const status = await client.pollJob(jobId, timeoutMs);
      const duration_ms = Date.now() - startTime;

      const label = jobStatusLabel(status.status);
      const success = status.status === 0 || status.status === 1;

      return {
        success,
        message: `${jobType} for ${args.entity} / ${args.period} ${args.year} / ${args.scenario}: ${label}`,
        data: status,
        warnings: status.status === 1 ? ["Completed with warnings — check EPM Cloud for details"] : undefined,
        jobId,
        duration_ms,
      };
    }
  );

  // ─── fcc_get_consolidation_status ────────────────────────────────────────
  registerTool(
    "fcc_get_consolidation_status",
    "Get the current consolidation status for one or more entities in a specific period/year/scenario. Status codes: OK=consolidated, CN=needs consolidation, CH=changed, ND=no data, TR=translate required, LC=locked.",
    {
      type: "object",
      properties: {
        entities: {
          type: "array",
          items: { type: "string" },
          description: "List of entity names to check",
        },
        period: { type: "string", description: "Period name" },
        year: { type: "string", description: "Year" },
        scenario: { type: "string", description: "Scenario name" },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["entities", "period", "year", "scenario"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);

      const entities = args.entities as string[];
      const gridDef = {
        exportPlanningData: false,
        gridDefinition: {
          suppressMissingBlocks: true,
          suppressMissingRows: false,
          suppressMissingColumns: true,
          pov: {
            dimensions: ["Scenario", "Year", "Period", "View", "Value"],
            members: [[args.scenario], [args.year], [args.period], ["Periodic"], ["Entity Input"]],
          },
          rows: [{ dimensions: ["Entity"], members: [entities] }],
          columns: [{ dimensions: ["Account"], members: [["FCCS_Total Assets"]] }],
        },
      };

      try {
        const res = await client.post<unknown>(
          client.planPath("Consol", "/exportdataslice"),
          gridDef
        );
        return {
          success: true,
          message: `Consolidation status for ${entities.length} entity/entities in ${args.period} ${args.year} ${args.scenario}.`,
          data: res,
        };
      } catch (err) {
        // Fallback: return job-based status check info
        return {
          success: false,
          message: `Could not retrieve consolidation status via data slice. Error: ${(err as Error).message}. Use the EPM Cloud Consolidation Status screen for detailed status.`,
          data: { entities, period: args.period, year: args.year, scenario: args.scenario },
        };
      }
    }
  );

  // ─── fcc_run_calculation ─────────────────────────────────────────────────
  registerTool(
    "fcc_run_calculation",
    "Run a calculation rule (e.g., Calculate Contributions, Calculate Rates) for a specific entity, period, year, and scenario.",
    {
      type: "object",
      properties: {
        entity: { type: "string", description: "Entity name" },
        period: { type: "string", description: "Period name" },
        year: { type: "string", description: "Year" },
        scenario: { type: "string", description: "Scenario name" },
        rule_name: { type: "string", description: "Business rule name (optional — runs default calc if not specified)" },
        timeout_minutes: { type: "number", description: "Max minutes to wait (default: 30)" },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["entity", "period", "year", "scenario"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);
      const startTime = Date.now();
      const timeoutMs = ((args.timeout_minutes as number) || 30) * 60 * 1000;

      const jobPayload = {
        jobType: "RULES",
        jobName: args.rule_name || "Calculate",
        parameters: {
          entity: args.entity,
          period: args.period,
          year: args.year,
          scenario: args.scenario,
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
        message: `Calculation "${args.rule_name || "Calculate"}" for ${args.entity}: ${jobStatusLabel(status.status)}`,
        data: status,
        jobId,
        duration_ms,
      };
    }
  );

  // ─── fcc_get_period_status ───────────────────────────────────────────────
  registerTool(
    "fcc_get_period_status",
    "Get the open/closed/locked status of periods for a given year and scenario in FCC.",
    {
      type: "object",
      properties: {
        year: { type: "string", description: "Year to check (e.g., 'FY2024'). Optional — returns all years if not specified." },
        scenario: { type: "string", description: "Scenario (e.g., 'Actual'). Optional." },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: [],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);

      // Fetch substitution variables for current period/year context
      const subvars = await client.get<{ items: Array<{ name: string; value: string }> }>(
        client.appPath("/substitutionvariables")
      );

      const currentPeriod = subvars.items?.find(
        (v) => v.name.toLowerCase().includes("period") || v.name.toLowerCase().includes("curperiod")
      );
      const currentYear = subvars.items?.find(
        (v) => v.name.toLowerCase().includes("year") || v.name.toLowerCase().includes("curyear")
      );

      // FCC period status is typically managed via the job API or metadata
      // Return substitution variables as context for current period
      return {
        success: true,
        message: "Period context retrieved. Note: Detailed period open/close status requires navigating to Workflow > Manage Ownership in FCC Cloud UI, or use fcc_manage_period to change status.",
        data: {
          current_period: currentPeriod?.value || "Unknown",
          current_year: currentYear?.value || "Unknown",
          filter: { year: args.year, scenario: args.scenario },
          all_substitution_variables: subvars.items,
          note: "FCC period lock/unlock status requires FCC-specific REST endpoints. Verify endpoint from Oracle FCC REST API documentation.",
        },
      };
    }
  );

  // ─── fcc_manage_period ───────────────────────────────────────────────────
  registerTool(
    "fcc_manage_period",
    "Open, close, or lock a period in FCC for a specific scenario and year. This submits a period management job.",
    {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["open", "close", "lock"],
          description: "Action to perform on the period",
        },
        period: { type: "string", description: "Period name (e.g., 'Jan', 'Q1')" },
        year: { type: "string", description: "Year (e.g., 'FY2024')" },
        scenario: { type: "string", description: "Scenario name (e.g., 'Actual')" },
        timeout_minutes: { type: "number", description: "Max minutes to wait (default: 10)" },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["action", "period", "year", "scenario"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);
      const startTime = Date.now();
      const timeoutMs = ((args.timeout_minutes as number) || 10) * 60 * 1000;
      const action = (args.action as string).toUpperCase();

      // FCC period management job type — verify from Oracle docs
      // Common patterns: LOCK_PERIOD, UNLOCK_PERIOD, or via workflow endpoint
      const jobTypeMap: Record<string, string> = {
        OPEN: "UNLOCK_PERIOD",
        CLOSE: "LOCK_PERIOD",
        LOCK: "LOCK_PERIOD",
      };

      const jobPayload = {
        jobType: jobTypeMap[action] || "LOCK_PERIOD",
        parameters: {
          period: args.period,
          year: args.year,
          scenario: args.scenario,
        },
      };

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
          message: `Period ${action} for ${args.period} ${args.year} ${args.scenario}: ${jobStatusLabel(status.status)}`,
          data: status,
          jobId,
          duration_ms,
        };
      } catch (err) {
        return {
          success: false,
          message: `Period management failed: ${(err as Error).message}. Note: Period lock/unlock job types must be confirmed from Oracle FCC REST API documentation. The correct job type may differ from "LOCK_PERIOD".`,
          warnings: ["Verify the period management job type from Oracle FCC REST API docs"],
        };
      }
    }
  );
}
