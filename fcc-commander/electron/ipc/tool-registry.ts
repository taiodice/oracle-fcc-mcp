// Registers all FCC tools from the existing MCP server core modules
// This bridges the MCP tool pattern to the Electron IPC pattern

import { FccClientManager } from "../../core/fcc-client-manager.js";
import { ToolResult } from "../../core/types.js";
import { registerConnectionTools } from "../../core/tools/connection.js";
import { registerConsolidationTools } from "../../core/tools/consolidation.js";
import { registerDataTools } from "../../core/tools/data.js";
import { registerJournalTools } from "../../core/tools/journals.js";
import { registerOwnershipTools } from "../../core/tools/ownership.js";
import { registerIntercompanyTools } from "../../core/tools/intercompany.js";
import { registerMetadataTools } from "../../core/tools/metadata.js";
import { registerJobTools } from "../../core/tools/jobs.js";
import { registerApprovalTools } from "../../core/tools/approval.js";

export interface RegisteredTool {
  name: string;
  description: string;
  inputSchema: object;
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
}

export function registerAllTools(manager: FccClientManager): RegisteredTool[] {
  const tools: RegisteredTool[] = [];

  function registerTool(
    name: string,
    description: string,
    schema: object,
    handler: (args: Record<string, unknown>) => Promise<ToolResult>
  ): void {
    tools.push({ name, description, inputSchema: schema, handler });
  }

  // Register all tool groups — identical pattern to MCP server.ts
  registerConnectionTools(manager, registerTool);
  registerConsolidationTools(manager, registerTool);
  registerDataTools(manager, registerTool);
  registerJournalTools(manager, registerTool);
  registerOwnershipTools(manager, registerTool);
  registerIntercompanyTools(manager, registerTool);
  registerMetadataTools(manager, registerTool);
  registerJobTools(manager, registerTool);
  registerApprovalTools(manager, registerTool);

  return tools;
}
