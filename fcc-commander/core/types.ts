// Shared TypeScript interfaces for the Oracle FCC MCP server

export interface TenantConfig {
  url: string;
  app: string;
  auth: "basic" | "oauth";
  // Basic auth
  username?: string;
  password?: string;
  // OAuth
  idcs_url?: string;
  client_id?: string;
  client_secret?: string;
}

export interface TenantsFile {
  default: string;
  tenants: Record<string, TenantConfig>;
}

export interface ToolResult {
  success: boolean;
  message: string;
  data?: unknown;
  warnings?: string[];
  jobId?: number;
  duration_ms?: number;
}

export interface JobStatus {
  jobId: number;
  status: number; // -1=processing, 0=success, 1=warnings, 2=errors, 3=not started
  statusMessage?: string;
  jobName?: string;
  jobType?: string;
  startTime?: string;
  endTime?: string;
  details?: unknown;
}

export const JOB_STATUS_LABELS: Record<number, string> = {
  [-1]: "In Progress",
  0: "Completed Successfully",
  1: "Completed with Warnings",
  2: "Completed with Errors",
  3: "Not Started",
};

export interface GridPov {
  dimensions?: string[];
  members: string[][];
}

export interface GridSegment {
  dimensions?: string[];
  members: string[][];
}

export interface GridDefinition {
  pov: GridPov;
  rows: GridSegment[];
  columns: GridSegment[];
  suppressMissingBlocks?: boolean;
  suppressMissingRows?: boolean;
  suppressMissingColumns?: boolean;
}

export interface OracleError {
  status?: number;
  message?: string;
  detail?: string;
  localizedMessage?: string;
}

// ─── Approval / Process Control Types ─────────────────────────────────────────

export interface ApprovalUnitRecord {
  entity: string;
  scenario: string;
  year: string;
  period: string;
  status: string; // "Not Started" | "Under Review" | "First Pass" | "Approved" | "Published" | "Locked"
  currentOwner: string;
  promotionLevel: number;
  parent?: string;
}

export interface ApprovalTreeNode {
  entity: string;
  status: string;
  currentOwner: string;
  promotionLevel: number;
  children: ApprovalTreeNode[];
}

export interface BulkApprovalResult {
  period: string;
  entity: string;
  success: boolean;
  message: string;
  jobId?: number;
}
