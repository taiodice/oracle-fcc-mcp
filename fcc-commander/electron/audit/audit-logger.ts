/**
 * Audit Logger — Persistent activity log for FCC Commander
 *
 * Captures tool executions (direct + chat-driven), stores them locally
 * via electron-store, and supports querying/export.
 */

import Store from "electron-store";
import { randomUUID } from "crypto";

// ── Types ────────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  timestamp: string; // ISO 8601
  source: "direct" | "chat"; // How the tool was invoked
  toolName: string;
  category: AuditCategory;
  args: Record<string, unknown>;
  resultSummary: string; // Short human-readable outcome
  success: boolean;
  durationMs: number;
  tenant?: string;
  user?: string;
}

export type AuditCategory =
  | "approval"
  | "period"
  | "data"
  | "substitution_variable"
  | "consolidation"
  | "journal"
  | "ownership"
  | "intercompany"
  | "metadata"
  | "connection"
  | "job"
  | "other";

export interface AuditQuery {
  category?: AuditCategory;
  toolName?: string;
  success?: boolean;
  fromDate?: string; // ISO 8601
  toDate?: string; // ISO 8601
  search?: string; // Free-text search across resultSummary and args
  limit?: number;
  offset?: number;
}

export interface AuditQueryResult {
  entries: AuditEntry[];
  total: number;
}

// ── Category mapping ─────────────────────────────────────────────────────────

const TOOL_CATEGORY_MAP: Record<string, AuditCategory> = {
  // Approval / process control
  fcc_get_approval_status: "approval",
  fcc_manage_approval: "approval",

  // Period management
  fcc_get_period_status: "period",
  fcc_manage_period: "period",

  // Data operations
  fcc_export_data: "data",
  fcc_query_mdx: "data",
  fcc_write_data: "data",
  fcc_import_data: "data",

  // Substitution variables
  fcc_get_substitution_variables: "substitution_variable",
  fcc_set_substitution_variables: "substitution_variable",

  // Consolidation
  fcc_run_consolidation: "consolidation",
  fcc_get_consolidation_status: "consolidation",
  fcc_run_calculation: "consolidation",

  // Journals
  fcc_manage_journal: "journal",
  fcc_get_journal: "journal",
  fcc_manage_journal_period: "journal",

  // Ownership
  fcc_get_ownership: "ownership",
  fcc_update_ownership: "ownership",
  fcc_get_entity_hierarchy: "ownership",

  // Intercompany
  fcc_get_ic_transactions: "intercompany",
  fcc_manage_ic_matching: "intercompany",

  // Metadata
  fcc_list_dimensions: "metadata",
  fcc_get_members: "metadata",

  // Connection
  fcc_list_tenants: "connection",
  fcc_test_connection: "connection",
  fcc_get_app_info: "connection",

  // Jobs
  fcc_run_job: "job",
};

// ── Logger class ─────────────────────────────────────────────────────────────

class AuditLogger {
  private store: Store;

  constructor() {
    this.store = new Store({
      name: "fcc-commander-audit",
      defaults: {
        entries: [] as AuditEntry[],
      },
    });
  }

  /**
   * Log a tool execution. Call this after tool.handler() completes.
   */
  log(params: {
    source: "direct" | "chat";
    toolName: string;
    args: Record<string, unknown>;
    result: unknown;
    success: boolean;
    durationMs: number;
    tenant?: string;
    user?: string;
  }): AuditEntry {
    const entry: AuditEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      source: params.source,
      toolName: params.toolName,
      category: TOOL_CATEGORY_MAP[params.toolName] || "other",
      args: this.sanitizeArgs(params.args),
      resultSummary: this.extractSummary(params.result),
      success: params.success,
      durationMs: params.durationMs,
      tenant: params.tenant,
      user: params.user,
    };

    const entries = this.store.get("entries") as AuditEntry[];
    entries.push(entry);

    // Keep max 10,000 entries (rotate oldest)
    if (entries.length > 10000) {
      entries.splice(0, entries.length - 10000);
    }

    this.store.set("entries", entries);
    return entry;
  }

  /**
   * Query audit log with filters.
   */
  query(query: AuditQuery = {}): AuditQueryResult {
    let entries = this.store.get("entries") as AuditEntry[];

    // Apply filters
    if (query.category) {
      entries = entries.filter((e) => e.category === query.category);
    }
    if (query.toolName) {
      entries = entries.filter((e) => e.toolName === query.toolName);
    }
    if (query.success !== undefined) {
      entries = entries.filter((e) => e.success === query.success);
    }
    if (query.fromDate) {
      entries = entries.filter((e) => e.timestamp >= query.fromDate!);
    }
    if (query.toDate) {
      entries = entries.filter((e) => e.timestamp <= query.toDate!);
    }
    if (query.search) {
      const term = query.search.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.resultSummary.toLowerCase().includes(term) ||
          e.toolName.toLowerCase().includes(term) ||
          JSON.stringify(e.args).toLowerCase().includes(term)
      );
    }

    // Sort newest first
    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    const total = entries.length;
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    entries = entries.slice(offset, offset + limit);

    return { entries, total };
  }

  /**
   * Get all entries for export (no pagination).
   */
  getAllEntries(query: AuditQuery = {}): AuditEntry[] {
    const result = this.query({ ...query, limit: 10000, offset: 0 });
    return result.entries;
  }

  /**
   * Clear all audit entries.
   */
  clear(): void {
    this.store.set("entries", []);
  }

  /**
   * Get audit stats summary.
   */
  getStats(): {
    totalEntries: number;
    successCount: number;
    failureCount: number;
    byCategory: Record<string, number>;
    lastActivity?: string;
  } {
    const entries = this.store.get("entries") as AuditEntry[];
    const byCategory: Record<string, number> = {};
    let successCount = 0;
    let failureCount = 0;

    for (const e of entries) {
      byCategory[e.category] = (byCategory[e.category] || 0) + 1;
      if (e.success) successCount++;
      else failureCount++;
    }

    return {
      totalEntries: entries.length,
      successCount,
      failureCount,
      byCategory,
      lastActivity: entries.length > 0 ? entries[entries.length - 1].timestamp : undefined,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...args };
    // Remove sensitive fields
    delete sanitized.password;
    delete sanitized.apiKey;
    delete sanitized.token;
    return sanitized;
  }

  private extractSummary(result: unknown): string {
    if (!result) return "No result";

    // MCP tool result format: { content: [{ text: "..." }] }
    if (typeof result === "object" && result !== null) {
      const r = result as Record<string, unknown>;
      if (Array.isArray(r.content)) {
        const firstText = r.content.find(
          (c: unknown) => typeof c === "object" && c !== null && (c as Record<string, unknown>).type === "text"
        );
        if (firstText) {
          const text = (firstText as Record<string, unknown>).text as string;
          // Truncate long results
          return text.length > 300 ? text.substring(0, 300) + "..." : text;
        }
      }
      // Generic object — try message field
      if (typeof r.message === "string") return r.message;
    }

    if (typeof result === "string") {
      return result.length > 300 ? result.substring(0, 300) + "..." : result;
    }

    return "Completed";
  }
}

// Singleton
export const auditLogger = new AuditLogger();
