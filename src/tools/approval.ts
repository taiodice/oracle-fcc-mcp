// Approval / Process Control tools:
// fcc_get_approval_status, fcc_manage_approval

import { FccClientManager } from "../fcc-client-manager.js";
import { ToolResult, ApprovalTreeNode } from "../types.js";
import { jobStatusLabel } from "../fcc-client.js";

type RegisterFn = (name: string, description: string, schema: object, handler: (args: Record<string, unknown>) => Promise<ToolResult>) => void;

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface RawApprovalUnit {
  entity?: string;
  name?: string;
  status?: string;
  approvalStatus?: string;
  currentOwner?: string;
  owner?: string;
  promotionLevel?: number;
  level?: number;
  parent?: string;
  parentName?: string;
  id?: number;
  planningUnitId?: number;
  [key: string]: unknown;
}

/** Normalize varying API response shapes into a consistent record. */
function normalizeUnit(raw: RawApprovalUnit): {
  entity: string;
  status: string;
  currentOwner: string;
  promotionLevel: number;
  parent?: string;
  id?: number;
} {
  return {
    entity: raw.entity ?? raw.name ?? "Unknown",
    status: raw.status ?? raw.approvalStatus ?? "Unknown",
    currentOwner: raw.currentOwner ?? raw.owner ?? "Unknown",
    promotionLevel: raw.promotionLevel ?? raw.level ?? 0,
    parent: raw.parent ?? raw.parentName,
    id: raw.id ?? raw.planningUnitId,
  };
}

/** Build a tree structure from a flat list of approval unit records. */
function buildApprovalTree(
  records: ReturnType<typeof normalizeUnit>[],
  rootEntity?: string
): ApprovalTreeNode[] {
  const nodeMap = new Map<string, ApprovalTreeNode>();
  const roots: ApprovalTreeNode[] = [];

  // Create nodes
  for (const rec of records) {
    nodeMap.set(rec.entity, {
      entity: rec.entity,
      status: rec.status,
      currentOwner: rec.currentOwner,
      promotionLevel: rec.promotionLevel,
      children: [],
    });
  }

  // Wire parent-child relationships
  for (const rec of records) {
    const node = nodeMap.get(rec.entity)!;
    if (rec.parent && nodeMap.has(rec.parent)) {
      nodeMap.get(rec.parent)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // If a root entity was specified, return just that subtree
  if (rootEntity && nodeMap.has(rootEntity)) {
    return [nodeMap.get(rootEntity)!];
  }

  return roots;
}

/** Format the tree as a human-readable indented string. */
function formatTree(nodes: ApprovalTreeNode[], depth: number = 0): string {
  const lines: string[] = [];
  const indent = "  ".repeat(depth);
  for (const node of nodes) {
    lines.push(
      `${indent}${node.entity}  [${node.status}]  Owner: ${node.currentOwner}  Level: ${node.promotionLevel}`
    );
    if (node.children.length > 0) {
      lines.push(formatTree(node.children, depth + 1));
    }
  }
  return lines.join("\n");
}

// ─── Tool Registration ────────────────────────────────────────────────────────

export function registerApprovalTools(manager: FccClientManager, registerTool: RegisterFn): void {

  // ─── fcc_get_approval_status ──────────────────────────────────────────────
  registerTool(
    "fcc_get_approval_status",
    "Get the approval / process control status for entities in a tree view. Shows which entities have been promoted, who currently owns them, and their approval status (Not Started, Under Review, Approved, Published, Locked). Equivalent to the HFM Process Control table — provides visibility into which OpCo entities are ready for Group Finance review.",
    {
      type: "object",
      properties: {
        scenario: { type: "string", description: "Scenario name (e.g., 'Actual')" },
        year: { type: "string", description: "Year (e.g., 'FY2024')" },
        period: { type: "string", description: "Period name (e.g., 'Jan')" },
        parent_entity: {
          type: "string",
          description: "Root entity for tree view (optional — shows full hierarchy if not specified)",
        },
        include_descendants: {
          type: "boolean",
          description: "Include all descendants in the tree (default: true)",
        },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["scenario", "year", "period"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);
      const scenario = args.scenario as string;
      const year = args.year as string;
      const period = args.period as string;
      const parentEntity = args.parent_entity as string | undefined;

      try {
        // Use the Planning Units API (correct FCCS endpoint)
        // POST /HyperionPlanning/rest/v3/applications/{app}/planningunits?q={...}
        const queryFilter: Record<string, string> = {
          scenario,
          version: year,
        };
        if (period) {
          queryFilter.period = period;
        }
        if (parentEntity) {
          queryFilter.entity = parentEntity;
        }

        const query = encodeURIComponent(JSON.stringify(queryFilter));
        const res = await client.post<{
          items?: RawApprovalUnit[];
          planningUnits?: RawApprovalUnit[];
        }>(
          client.appPath(`/planningunits?q=${query}`),
          {} // POST body can be empty; filter is in query string
        );

        const rawUnits = res.items ?? res.planningUnits ?? [];
        if (rawUnits.length === 0) {
          return {
            success: true,
            message: `No planning units found for ${scenario} / ${year} / ${period}. The period may not have planning units configured, or approval may not be enabled.`,
            data: [],
            warnings: [
              "If approval is enabled, verify that planning units are configured for this scenario/year/period combination.",
              "Planning units are configured in the FCC UI under Workflow > Manage Approval.",
            ],
          };
        }

        const normalized = rawUnits.map(normalizeUnit);
        const tree = buildApprovalTree(normalized, parentEntity);
        const treeText = formatTree(tree);

        return {
          success: true,
          message: `Approval status for ${scenario} / ${year} / ${period}:\n\n${treeText}`,
          data: {
            tree,
            totalEntities: normalized.length,
            summary: {
              byStatus: Object.entries(
                normalized.reduce((acc, u) => {
                  acc[u.status] = (acc[u.status] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([status, count]) => ({ status, count })),
            },
          },
        };
      } catch (primaryErr) {
        // Fallback: try GET on planningunits for history
        try {
          const queryFilter: Record<string, string> = { scenario, version: year };
          if (period) queryFilter.period = period;
          const query = encodeURIComponent(JSON.stringify(queryFilter));

          const res = await client.get<{
            items?: RawApprovalUnit[];
            planningUnits?: RawApprovalUnit[];
          }>(
            client.appPath(`/planningunits?q=${query}`)
          );

          const rawUnits = res.items ?? res.planningUnits ?? [];
          if (rawUnits.length > 0) {
            const normalized = rawUnits.map(normalizeUnit);
            const tree = buildApprovalTree(normalized, parentEntity);
            const treeText = formatTree(tree);

            return {
              success: true,
              message: `Approval status for ${scenario} / ${year} / ${period} (via GET):\n\n${treeText}`,
              data: {
                tree,
                totalEntities: normalized.length,
              },
            };
          }
        } catch {
          // Both attempts failed
        }

        // Final fallback: get entity hierarchy without approval status
        try {
          const memberEncoded = encodeURIComponent(parentEntity || "Total Geography");
          const entityRes = await client.get<Record<string, unknown>>(
            client.appPath(`/dimensions/Entity/members/${memberEncoded}`)
          );

          const members: Array<Record<string, unknown>> = [entityRes];
          if (Array.isArray(entityRes.children)) {
            for (const child of entityRes.children as Array<Record<string, unknown>>) {
              members.push(child);
            }
          }

          return {
            success: true,
            message: `Could not retrieve approval status (${(primaryErr as Error).message}). Showing entity hierarchy without approval status.`,
            data: members,
            warnings: [
              "Approval status could not be retrieved from the Planning Units API.",
              "Entity hierarchy is shown without approval status. Check Workflow > Manage Approval in FCC Cloud UI for status details.",
            ],
          };
        } catch (fallbackErr) {
          return {
            success: false,
            message: `Failed to retrieve approval status: ${(primaryErr as Error).message}. Entity hierarchy fallback also failed: ${(fallbackErr as Error).message}.`,
            warnings: [
              "Verify that the application name is correct and approval is enabled.",
              "The Planning Units API endpoint is: POST /applications/{app}/planningunits?q={filter}",
            ],
          };
        }
      }
    }
  );

  // ─── fcc_manage_approval ──────────────────────────────────────────────────
  registerTool(
    "fcc_manage_approval",
    "Promote, reject, approve, sign off, or start approval units for entities across one or more periods. Supports bulk multi-period operations — pass multiple periods (e.g., ['Jan','Feb',...,'Dec']) to process 12 months at once. This is the FCC equivalent of HFM Submit/Reject, solving the one-month-at-a-time limitation.",
    {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["promote", "reject", "approve", "sign_off", "start"],
          description: "Approval action to perform",
        },
        entities: {
          type: "array",
          items: { type: "string" },
          description: "Entity names to act on (e.g., ['US001', 'US002', 'UK001'])",
        },
        scenario: { type: "string", description: "Scenario name (e.g., 'Actual')" },
        year: { type: "string", description: "Year (e.g., 'FY2024')" },
        periods: {
          type: "array",
          items: { type: "string" },
          description: "Periods to process (e.g., ['Jan','Feb','Mar'] for multi-month bulk operation)",
        },
        comment: {
          type: "string",
          description: "Comment or reason (recommended for reject, optional for others)",
        },
        timeout_minutes: {
          type: "number",
          description: "Max minutes to wait per operation (default: 10)",
        },
        tenant: { type: "string", description: "Tenant name (optional)" },
      },
      required: ["action", "entities", "scenario", "year", "periods"],
    },
    async (args) => {
      const client = manager.getClient(args.tenant as string | undefined);
      const action = args.action as string;
      const entities = args.entities as string[];
      const periods = args.periods as string[];
      const scenario = args.scenario as string;
      const year = args.year as string;
      const comment = args.comment as string | undefined;
      const startTime = Date.now();
      const timeoutMs = ((args.timeout_minutes as number) || 10) * 60 * 1000;

      const results: Array<{
        period: string;
        entity: string;
        success: boolean;
        message: string;
        jobId?: number;
      }> = [];
      const warnings: string[] = [];

      for (const period of periods) {
        for (const entity of entities) {
          try {
            let operationSuccess = false;
            let operationMessage = "";
            let operationJobId: number | undefined;

            try {
              // Primary approach: Use Planning Units actions API
              // First, find the planning unit ID for this entity/period
              const queryFilter = JSON.stringify({
                scenario,
                version: year,
                period,
                entity,
              });
              const query = encodeURIComponent(queryFilter);

              const puRes = await client.post<{
                items?: Array<{ id?: number; planningUnitId?: number }>;
                planningUnits?: Array<{ id?: number; planningUnitId?: number }>;
              }>(
                client.appPath(`/planningunits?q=${query}`),
                {}
              );

              const units = puRes.items ?? puRes.planningUnits ?? [];
              if (units.length > 0) {
                const puId = units[0].id ?? units[0].planningUnitId;

                if (puId) {
                  // Use the actions endpoint
                  const actionPayload: Record<string, unknown> = { action };
                  if (comment) actionPayload.comment = comment;

                  const actionRes = await client.post<{ status?: string; message?: string; jobId?: number }>(
                    client.appPath(`/planningunits/${puId}/actions`),
                    actionPayload
                  );

                  if (actionRes.jobId) {
                    const jobStatus = await client.pollJob(actionRes.jobId, timeoutMs);
                    operationSuccess = jobStatus.status === 0 || jobStatus.status === 1;
                    operationMessage = jobStatusLabel(jobStatus.status);
                    operationJobId = actionRes.jobId;
                    if (jobStatus.status === 1) {
                      warnings.push(`${entity}/${period}: completed with warnings`);
                    }
                  } else {
                    operationSuccess = true;
                    operationMessage = actionRes.status ?? actionRes.message ?? "Success";
                  }
                } else {
                  throw new Error("Planning unit found but no ID returned");
                }
              } else {
                throw new Error(`No planning unit found for ${entity} in ${period}`);
              }
            } catch {
              // Fallback: try via Jobs API with approval-style job type
              const jobTypeMap: Record<string, string> = {
                promote: "PROMOTE",
                reject: "REJECT",
                approve: "APPROVE",
                sign_off: "SIGN_OFF",
                start: "START",
              };

              const jobPayload = {
                jobType: jobTypeMap[action] || action.toUpperCase(),
                parameters: { scenario, year, period, entity, comment },
              };

              const submitRes = await client.post<{ jobId: number }>(
                client.appPath("/jobs"),
                jobPayload
              );

              const jobStatus = await client.pollJob(submitRes.jobId, timeoutMs);
              operationSuccess = jobStatus.status === 0 || jobStatus.status === 1;
              operationMessage = `(via Jobs API) ${jobStatusLabel(jobStatus.status)}`;
              operationJobId = submitRes.jobId;

              if (jobStatus.status === 1) {
                warnings.push(`${entity}/${period}: completed with warnings (Jobs API fallback)`);
              }
            }

            results.push({
              period,
              entity,
              success: operationSuccess,
              message: operationMessage,
              jobId: operationJobId,
            });
          } catch (err) {
            results.push({
              period,
              entity,
              success: false,
              message: (err as Error).message,
            });
            warnings.push(`${entity}/${period}: ${(err as Error).message}`);
          }
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.length - successCount;
      const duration_ms = Date.now() - startTime;

      if (failCount > 0 && warnings.length === 0) {
        warnings.push(
          "Some operations failed. The Planning Units API endpoint is: POST /applications/{app}/planningunits/{id}/actions"
        );
      }

      return {
        success: failCount === 0,
        message: `${action} completed: ${successCount} succeeded, ${failCount} failed across ${periods.length} period(s) and ${entities.length} entity/entities.`,
        data: {
          summary: { total: results.length, succeeded: successCount, failed: failCount },
          details: results,
        },
        warnings: warnings.length > 0 ? warnings : undefined,
        duration_ms,
      };
    }
  );
}
