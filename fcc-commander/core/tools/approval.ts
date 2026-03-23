// Approval / Process Control tools:
// fcc_get_approval_status, fcc_manage_approval

import { FccClientManager } from "../fcc-client-manager.js";
import { ToolResult, ApprovalTreeNode } from "../types.js";

type RegisterFn = (name: string, description: string, schema: object, handler: (args: Record<string, unknown>) => Promise<ToolResult>) => void;

// ─── Troubleshooting ─────────────────────────────────────────────────────────

/** Build context-aware troubleshooting hints from HTTP error messages. */
function buildTroubleshooting(errorMsg: string): string[] {
  const hints: string[] = [];
  const lower = errorMsg.toLowerCase();

  if (lower.includes("401") || lower.includes("unauthorized")) {
    hints.push("Authentication failed — verify your username and password are correct.");
    hints.push("If using Basic Auth, confirm the account is not locked or expired.");
  }
  if (lower.includes("403") || lower.includes("forbidden")) {
    hints.push("Access denied — your user account does not have permission to access this resource.");
    hints.push("Ensure the user has the Service Administrator or Approval Administrator role assigned in the FCC environment.");
    hints.push("Contact your EPM administrator to verify role assignments under Access Control > Manage Roles.");
  }
  if (lower.includes("404") || lower.includes("not found")) {
    hints.push("The API endpoint was not found — verify the Environment URL and Application Name are correct.");
    hints.push("Confirm the application name in Settings matches exactly (case-sensitive) — e.g., 'ELEMPROD' not 'elemprod' or a typo.");
  }
  if (lower.includes("405") || lower.includes("method not allowed")) {
    hints.push("The API endpoint does not support this request method — the FCC REST API version may differ from expected.");
    hints.push("Check that the Environment URL points to an Oracle FCCS (Financial Consolidation and Close) instance, not PBCS or another EPM application.");
  }
  if (lower.includes("500") || lower.includes("internal server error")) {
    hints.push("The FCC server returned an internal error — this may be a temporary issue. Try again in a few minutes.");
    hints.push("If the issue persists, check the FCC environment status in the Oracle Cloud console.");
  }
  if (lower.includes("timeout") || lower.includes("econnrefused") || lower.includes("enotfound")) {
    hints.push("Could not reach the FCC server — check your network connection and VPN status.");
    hints.push("Verify the Environment URL is correct and accessible from this machine.");
  }

  if (hints.length === 0) {
    hints.push(`Unexpected error: ${errorMsg}`);
    hints.push("Check your Environment URL, credentials, and network connectivity in Settings > FCC Tenants.");
  }

  return hints;
}

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
        // POST /planningunits?q={filter} with NO body — Oracle returns 415 if Content-Type is sent
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
        const res = await client.postNoBody<{
          items?: RawApprovalUnit[];
          planningUnits?: RawApprovalUnit[];
        }>(
          client.appPath(`/planningunits?q=${query}`)
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
        const primaryMsg = (primaryErr as Error).message || String(primaryErr);
        const troubleshooting = buildTroubleshooting(primaryMsg);

        // Fallback: try GET with query string on planningunits
        try {
          const fallbackFilter: Record<string, string> = { scenario, version: year };
          if (period) fallbackFilter.period = period;
          const query = encodeURIComponent(JSON.stringify(fallbackFilter));

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
          const rootEntity = parentEntity || await client.discoverRootEntity();
          const memberEncoded = encodeURIComponent(rootEntity);
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
            message: `Could not retrieve approval status (${primaryMsg}). Showing entity hierarchy without approval status.`,
            data: members,
            warnings: troubleshooting,
          };
        } catch (fallbackErr) {
          const fallbackMsg = (fallbackErr as Error).message || String(fallbackErr);
          const fallbackHints = buildTroubleshooting(fallbackMsg);

          return {
            success: false,
            message: `Connection Failed — Unable to load entity data.`,
            data: {
              primaryError: primaryMsg,
              fallbackError: fallbackMsg,
            },
            warnings: [
              ...troubleshooting,
              ...fallbackHints.filter((h) => !troubleshooting.includes(h)),
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

      const actionIdMap: Record<string, string> = {
        promote: "PROMOTE",
        reject: "REJECT",
        approve: "APPROVE",
        sign_off: "SIGN_OFF",
        start: "ORIGINATE",
      };
      const actionId = actionIdMap[action] ?? action.toUpperCase();

      // pmMembers: comma-separated quoted entity names, e.g. "Entity_A","Entity_B"
      const pmMembersStr = entities.map((e) => `"${e}"`).join(",");

      const results: Array<{
        period: string;
        success: boolean;
        message: string;
      }> = [];
      const warnings: string[] = [];

      for (const period of periods) {
        // The puhIdentifier uses the encoded Scenario::"Year" format
        // Oracle encoding: space→%20, quote→%22, colons stay as ::
        const puId = client.encodePuId(scenario, year);
        const formParts = [`actionId=${actionId}`, `pmMembers=${pmMembersStr}`];
        if (comment) formParts.push(`comments=${encodeURIComponent(comment)}`);
        // Also pass period if the FCC application needs it
        formParts.push(`period=${encodeURIComponent(period)}`);
        const formBody = formParts.join("&");

        try {
          await client.postForm<unknown>(
            client.appPath(`/planningunits/${puId}/actions`),
            formBody
          );
          results.push({ period, success: true, message: "Success" });
        } catch (err) {
          const msg = (err as Error).message;
          results.push({ period, success: false, message: msg });
          warnings.push(`${period}: ${msg}`);
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.length - successCount;
      const duration_ms = Date.now() - startTime;

      return {
        success: failCount === 0,
        message: `${action} completed: ${successCount} of ${periods.length} period(s) succeeded across ${entities.length} entity/entities.`,
        data: {
          summary: { total: results.length, succeeded: successCount, failed: failCount },
          details: results.map((r) => ({ ...r, entities, scenario, year })),
        },
        warnings: warnings.length > 0 ? warnings : undefined,
        duration_ms,
      };
    }
  );
}
