// Generic job runner: fcc_run_job

import { FccClientManager } from "../fcc-client-manager.js";
import { ToolResult } from "../types.js";
import { jobStatusLabel } from "../fcc-client.js";

type RegisterFn = (name: string, description: string, schema: object, handler: (args: Record<string, unknown>) => Promise<ToolResult>) => void;

// Common FCC job types for reference
const KNOWN_JOB_TYPES = [
  "CONSOLIDATE", "TRANSLATE", "CONSOLIDATE_ALL", "CALCULATE_CONTRIBUTIONS",
  "RULES", "IMPORT_DATA", "EXPORT_DATA", "IMPORT_METADATA", "EXPORT_METADATA",
  "CUBE_REFRESH", "SMART_PUSH", "CLEAR_CUBE", "MERGE_DATA_SLICES",
  "ADMINISTRATION_MODE", "COMPACT_CUBE", "RESTRUCTURE_CUBE",
];

export function registerJobTools(manager: FccClientManager, registerTool: RegisterFn): void {

  // ─── fcc_run_job ─────────────────────────────────────────────────────────
  registerTool(
    "fcc_run_job",
    `Submit and monitor any FCC job type. Use this for operations not covered by other tools. Known job types: ${KNOWN_JOB_TYPES.join(", ")}.`,
    {
      type: "object",
      properties: {
        job_type: {
          type: "string",
          description: `Job type to execute. Common types: ${KNOWN_JOB_TYPES.join(", ")}`,
        },
        job_name: {
          type: "string",
          description: "Name of the specific job definition (required for RULES, IMPORT_DATA, EXPORT_DATA, etc.)",
        },
        parameters: {
          type: "object",
          description: "Job-specific parameters (key-value pairs, varies by job type)",
          additionalProperties: true,
        },
        poll: {
          type: "boolean",
          description: "Whether to wait for job completion (default: true). Set false to fire-and-forget.",
        },
        timeout_minutes: {
          type: "number",
          description: "Max minutes to wait for completion if polling (default: 30)",
        },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["job_type"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);
      const startTime = Date.now();
      const shouldPoll = args.poll !== false;
      const timeoutMs = ((args.timeout_minutes as number) || 30) * 60 * 1000;

      const jobPayload: Record<string, unknown> = {
        jobType: args.job_type,
      };
      if (args.job_name) jobPayload.jobName = args.job_name;
      if (args.parameters) jobPayload.parameters = args.parameters;

      const submitRes = await client.post<{ jobId: number; status?: number }>(
        client.appPath("/jobs"),
        jobPayload
      );

      const jobId = submitRes.jobId;

      if (!shouldPoll) {
        return {
          success: true,
          message: `Job submitted (ID: ${jobId}). Not polling for completion — check EPM Cloud for status.`,
          jobId,
        };
      }

      const status = await client.pollJob(jobId, timeoutMs);
      const duration_ms = Date.now() - startTime;

      return {
        success: status.status === 0 || status.status === 1,
        message: `Job ${args.job_type}${args.job_name ? ` (${args.job_name})` : ""}: ${jobStatusLabel(status.status)}`,
        data: status,
        warnings: status.status === 1 ? ["Completed with warnings — check EPM Cloud for details"] : undefined,
        jobId,
        duration_ms,
      };
    }
  );
}
