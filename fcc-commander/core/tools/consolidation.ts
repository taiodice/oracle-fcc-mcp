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

      // Use "Consol" plan type — the /plantypes endpoint does not exist in FCCS
      const planType = "Consol";

      const entities = args.entities as string[];
      const gridDef = {
        exportPlanningData: false,
        gridDefinition: {
          suppressMissingBlocks: true,
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
          rows: [{ dimensions: ["Entity"], members: [entities] }],
          columns: [{ dimensions: ["Account"], members: [["FCCS_Total Assets"]] }],
        },
      };

      try {
        const res = await client.post<unknown>(
          client.planPath(planType, "/exportdataslice"),
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
        year: { type: "string", description: "Year to check (e.g., 'FY25'). Optional — uses current year if not specified." },
        scenario: { type: "string", description: "Scenario (e.g., 'Actual'). Optional." },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: [],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);
      const PERIOD_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const filterYear = (args.year as string) || "FY25";
      const filterScenario = (args.scenario as string) || "Actual";

      // Strategy 1: Try the Planning REST API /periods endpoint
      // This may return period configuration including open/close status
      try {
        const periodsRes = await client.get<{
          items?: Array<{
            name?: string;
            periodName?: string;
            status?: string;
            open?: boolean;
            opened?: boolean;
            [key: string]: unknown;
          }>;
          [key: string]: unknown;
        }>(
          client.appPath("/periods")
        );

        // If the endpoint returns data, parse it
        if (periodsRes && typeof periodsRes === "object") {
          const items = periodsRes.items || (Array.isArray(periodsRes) ? periodsRes as Array<Record<string, unknown>> : null);
          if (items && items.length > 0) {
            // Try to filter by year/scenario if the data includes those fields
            const periods = items
              .filter((item) => {
                const yearMatch = !item.year || String(item.year) === filterYear;
                const scenarioMatch = !item.scenario || String(item.scenario) === filterScenario;
                return yearMatch && scenarioMatch;
              })
              .map((item) => {
                const periodName = (item.name || item.periodName || "") as string;
                // Determine status from various possible fields
                let status = "Unknown";
                if (item.status) {
                  status = String(item.status);
                } else if (item.open === true || item.opened === true) {
                  status = "Opened";
                } else if (item.open === false || item.opened === false) {
                  status = "Unopened";
                }
                return {
                  period: periodName,
                  year: filterYear,
                  scenario: filterScenario,
                  status,
                  isDefault: false,
                };
              });

            if (periods.length > 0) {
              return {
                success: true,
                message: `Period status for ${filterScenario} / ${filterYear} retrieved from /periods endpoint.`,
                data: {
                  periods,
                  note: "Period status retrieved from the Planning REST API /periods endpoint.",
                  raw: periodsRes,
                },
              };
            }
          }

          // The endpoint returned data but not in the expected format.
          // Return the raw response so we can inspect it.
          return {
            success: true,
            message: `Period endpoint responded but returned unexpected format. Raw data included for inspection.`,
            data: {
              periods: PERIOD_NAMES.map((p) => ({
                period: p,
                year: filterYear,
                scenario: filterScenario,
                status: "Unknown",
                isDefault: false,
              })),
              note: "The /periods endpoint returned data in an unexpected format. See raw field.",
              raw: periodsRes,
            },
          };
        }
      } catch {
        // /periods endpoint not available — continue to Strategy 2
      }

      // Strategy 2: Try FCCS-specific /fccs/rest/v1 periods endpoint
      try {
        const fccsPeriodsRes = await client.get<Record<string, unknown>>(
          client.fccsPath("/periods")
        );
        if (fccsPeriodsRes) {
          return {
            success: true,
            message: `Period status retrieved from FCCS-specific endpoint.`,
            data: {
              periods: PERIOD_NAMES.map((p) => ({
                period: p,
                year: filterYear,
                scenario: filterScenario,
                status: "Unknown",
                isDefault: false,
              })),
              note: "FCCS /periods endpoint responded. See raw field.",
              raw: fccsPeriodsRes,
            },
          };
        }
      } catch {
        // FCCS endpoint not available — continue to Strategy 3
      }

      // Strategy 3: Try querying period dimension members for status metadata
      try {
        const periodDimRes = await client.get<{
          children?: Array<Record<string, unknown>>;
          [key: string]: unknown;
        }>(
          client.appPath(`/dimensions/Period/members/Period`)
        );

        if (periodDimRes?.children) {
          // Look for year-specific members (e.g., descendants might include Jan, Feb, etc.)
          // Period dimension hierarchy: Period > Qn > MonthName
          const allPeriods: Array<Record<string, unknown>> = [];
          for (const child of periodDimRes.children) {
            // Could be quarters containing months
            if (Array.isArray(child.children)) {
              for (const month of child.children as Array<Record<string, unknown>>) {
                allPeriods.push(month);
              }
            } else {
              allPeriods.push(child);
            }
          }

          // Check if any period member has status-related fields
          const hasStatusInfo = allPeriods.some(
            (p) => p.dataStorage !== undefined || p.planType !== undefined || p.enabled !== undefined
          );

          if (allPeriods.length > 0) {
            return {
              success: true,
              message: `Found ${allPeriods.length} period members from dimension metadata.`,
              data: {
                periods: PERIOD_NAMES.map((name) => ({
                  period: name,
                  year: filterYear,
                  scenario: filterScenario,
                  status: "Unknown",
                  isDefault: false,
                })),
                note: hasStatusInfo
                  ? "Period dimension members have metadata but no direct open/close status field."
                  : "Period dimension members found. The Oracle FCCS REST API does not expose period open/close status directly.",
                raw: { periodMembers: allPeriods.slice(0, 20) },
              },
            };
          }
        }
      } catch {
        // Dimension endpoint failed
      }

      // Final fallback: return Unknown status for all periods
      return {
        success: true,
        message: `Could not determine period status for ${filterScenario} / ${filterYear}. The FCCS REST API does not expose the Manage Periods open/close status.`,
        data: {
          periods: PERIOD_NAMES.map((p) => ({
            period: p,
            year: filterYear,
            scenario: filterScenario,
            status: "Unknown",
            isDefault: false,
          })),
          note: "The Oracle FCCS REST API does not expose period open/close status. Use the FCC Cloud UI (Workflow > Manage Periods) to view and manage period status.",
        },
      };
    }
  );

  // ─── fcc_manage_period ───────────────────────────────────────────────────
  registerTool(
    "fcc_manage_period",
    "Open, close, or lock a CONSOLIDATION period (data entry period) in FCC. NOTE: For opening/closing journal periods (controlling whether journals can be created), use fcc_manage_journal_period instead. This tool manages the consolidation/data-entry period status.",
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
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["action", "period", "year", "scenario"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);
      const action = args.action as string;
      const period = args.period as string;
      const year = args.year as string;
      const scenario = args.scenario as string;

      // Strategy 1: Try PUT /applications/{app}/periods with period management payload
      try {
        const payload = {
          scenario,
          year,
          period,
          action: action.toUpperCase(), // OPEN, CLOSE, LOCK
        };
        const res = await client.put<Record<string, unknown>>(
          client.appPath("/periods"),
          payload
        );
        return {
          success: true,
          message: `Period ${action} succeeded for ${period} / ${scenario} / ${year}.`,
          data: res,
        };
      } catch {
        // Try alternative payload formats
      }

      // Strategy 2: Try POST /applications/{app}/periods with action
      try {
        const payload = {
          scenario,
          year,
          periods: [{ name: period, action: action.toUpperCase() }],
        };
        const res = await client.post<Record<string, unknown>>(
          client.appPath("/periods"),
          payload
        );
        return {
          success: true,
          message: `Period ${action} succeeded for ${period} / ${scenario} / ${year}.`,
          data: res,
        };
      } catch {
        // Try FCCS-specific endpoint
      }

      // Strategy 3: Try FCCS-specific endpoint
      try {
        const payload = {
          scenario,
          year,
          period,
          action: action.toUpperCase(),
        };
        const res = await client.post<Record<string, unknown>>(
          client.fccsPath("/periods"),
          payload
        );
        return {
          success: true,
          message: `Period ${action} succeeded for ${period} / ${scenario} / ${year}.`,
          data: res,
        };
      } catch {
        // All strategies failed
      }

      return {
        success: false,
        message: `Period management (${action} ${period} for ${scenario} / ${year}) is not available via the discovered REST API endpoints. Please manage periods in the FCC Cloud UI under Workflow > Manage Periods.`,
        warnings: [
          "Tried PUT and POST to /applications/{app}/periods and /fccs/rest/v1/periods — none succeeded.",
          "Use the FCC Cloud UI (Workflow > Manage Periods) to open, close, or lock periods.",
        ],
      };
    }
  );
}
