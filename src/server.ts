// MCP Server setup — registers all tools and starts stdio transport

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { FccClientManager } from "./fcc-client-manager.js";
import { ToolResult } from "./types.js";
import { registerConnectionTools } from "./tools/connection.js";
import { registerConsolidationTools } from "./tools/consolidation.js";
import { registerDataTools } from "./tools/data.js";
import { registerJournalTools } from "./tools/journals.js";
import { registerOwnershipTools } from "./tools/ownership.js";
import { registerIntercompanyTools } from "./tools/intercompany.js";
import { registerMetadataTools } from "./tools/metadata.js";
import { registerJobTools } from "./tools/jobs.js";
import { registerApprovalTools } from "./tools/approval.js";

interface RegisteredTool {
  name: string;
  description: string;
  inputSchema: object;
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
}

export async function createServer(manager: FccClientManager): Promise<Server> {
  const server = new Server(
    { name: "oracle-fcc-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  // Tool registry
  const tools: RegisteredTool[] = [];

  function registerTool(
    name: string,
    description: string,
    schema: object,
    handler: (args: Record<string, unknown>) => Promise<ToolResult>
  ): void {
    tools.push({ name, description, inputSchema: schema, handler });
  }

  // Register all tool groups
  registerConnectionTools(manager, registerTool);
  registerConsolidationTools(manager, registerTool);
  registerDataTools(manager, registerTool);
  registerJournalTools(manager, registerTool);
  registerOwnershipTools(manager, registerTool);
  registerIntercompanyTools(manager, registerTool);
  registerMetadataTools(manager, registerTool);
  registerJobTools(manager, registerTool);
  registerApprovalTools(manager, registerTool);

  // ─── List Tools Handler ──────────────────────────────────────────────────
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(
      (t): Tool => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema as Tool["inputSchema"],
      })
    ),
  }));

  // ─── Call Tool Handler ───────────────────────────────────────────────────
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = tools.find((t) => t.name === name);

    if (!tool) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    try {
      const result = await tool.handler((args as Record<string, unknown>) ?? {});
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: JSON.stringify({ success: false, message }) }],
        isError: true,
      };
    }
  });

  return server;
}

export async function startServer(manager: FccClientManager): Promise<void> {
  const server = await createServer(manager);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Oracle FCC MCP server started (stdio transport)");
}
