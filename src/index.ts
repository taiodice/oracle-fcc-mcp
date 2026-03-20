// Oracle FCC MCP Server — Entry Point

import { loadConfig } from "./config.js";
import { FccClientManager } from "./fcc-client-manager.js";
import { startServer } from "./server.js";

async function main(): Promise<void> {
  try {
    const config = loadConfig();
    const manager = new FccClientManager(config);
    await startServer(manager);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to start Oracle FCC MCP server: ${message}`);
    process.exit(1);
  }
}

main();
