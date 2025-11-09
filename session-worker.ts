/**
 * Detached worker that hosts the MCP session HTTP wrapper.
 */

import { initializeServer } from './mcp-client.js';
import { createSessionHTTPWrapper } from './session-http-wrapper.js';
import type { MCPServerConfig } from './types.js';

async function main() {
  const [serverName, portArg] = process.argv.slice(2);
  const configEnv = process.env.MCP_SERVER_CONFIG;

  if (!serverName || !portArg || !configEnv) {
    console.error('Missing required arguments for session worker');
    process.exit(1);
  }

  const port = Number(portArg);
  if (Number.isNaN(port)) {
    console.error('Invalid port for session worker');
    process.exit(1);
  }

  let config: MCPServerConfig;
  try {
    config = JSON.parse(configEnv) as MCPServerConfig;
  } catch {
    console.error('Invalid MCP server configuration payload');
    process.exit(1);
  }

  try {
    const client = await initializeServer(serverName, config);
    const server = createSessionHTTPWrapper(serverName, client, port);

    let shuttingDown = false;
    const shutdown = async (signal: NodeJS.Signals) => {
      if (shuttingDown) {
        return;
      }
      shuttingDown = true;
      console.log(`Session worker '${serverName}' received ${signal}, shutting down`);
      await client.close();
      await new Promise<void>(resolve => server.close(() => resolve()));
      process.exit(0);
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  } catch (error) {
    console.error(`Failed to start session worker for '${serverName}':`, error);
    process.exit(1);
  }
}

main();
