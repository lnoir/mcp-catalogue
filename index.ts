#!/usr/bin/env node
/**
 * MCP CLI - Discovery and Session Management
 *
 * Discovery - Explore available MCP servers and tools:
 *   pnpm run discover                           # List all servers
 *   pnpm run discover -- list <server>          # List tools in a server
 *   pnpm run discover -- info <server> <tool>   # Get tool details
 *   pnpm run discover -- test <server>          # Test server connection
 *
 * Session Management - Start persistent MCP servers:
 *   pnpm run session -- start <server>          # Start session
 *   pnpm run session -- stop <server>           # Stop session
 *   pnpm run session -- call <server> <tool> <params>  # Call tool
 *   pnpm run session -- list                    # List active sessions
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { checkNodeVersion } from './check-node-version.js';
import type { ServerRegistry } from './types.js';
import serverConfigRaw from './servers.json' with { type: 'json' };
import { initializeServer, listServerTools, closeAllServers } from './mcp-client.js';
import { sessionManager } from './session-manager.js';

const serverConfig = serverConfigRaw as ServerRegistry;

// Check Node version before doing anything
checkNodeVersion();

const __dirname = dirname(fileURLToPath(import.meta.url));

// Filter out the -- separator that pnpm adds
const rawArgs = process.argv.slice(2).filter(arg => arg !== '--');

// Detect if we're in session mode (first arg is "session")
const isSessionMode = rawArgs[0] === 'session';
const args = isSessionMode ? rawArgs.slice(1) : rawArgs;
const command = args[0];

/**
 * Count TypeScript files in a directory (excluding index.ts and types.ts)
 */
async function countTools(serverDir: string): Promise<number> {
  try {
    const files = await readdir(serverDir);
    const tsFiles = files.filter(
      f => f.endsWith('.ts') && f !== 'index.ts' && f !== 'types.ts'
    );
    return tsFiles.length;
  } catch {
    return 0;
  }
}

/**
 * Get available server names from filesystem
 */
async function getServerNames(): Promise<string[]> {
  const serversDir = join(__dirname, 'servers');
  const entries = await readdir(serversDir, { withFileTypes: true });
  const servers = entries
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => e.name);
  return servers;
}

/**
 * Extract JSDoc comment from a tool file
 */
async function extractDescription(filePath: string): Promise<string> {
  const content = await readFile(filePath, 'utf-8');
  const match = content.match(/\/\*\*\s*\n\s*\*\s*(.+?)\n/);
  return match ? match[1].trim() : 'No description available';
}

/**
 * List all available servers
 */
async function listServers() {
  console.log('\nAvailable MCP Servers:\n');

  const servers = await getServerNames();

  for (const server of servers) {
    const toolCount = await countTools(join(__dirname, 'servers', server));
    console.log(`  ${server} (${toolCount} tools)`);
  }

  console.log('\nUsage: pnpm run discover -- list <server-name>');
  console.log('       pnpm run discover -- info <server> <tool>\n');
}

/**
 * List tools in a specific server
 */
async function listToolsInServer(serverName: string) {
  const serverDir = join(__dirname, 'servers', serverName);

  try {
    await stat(serverDir);
  } catch {
    console.error(`\nError: Server "${serverName}" not found.\n`);
    return;
  }

  console.log(`\nTools in ${serverName}:\n`);

  const files = await readdir(serverDir);
  const toolFiles = files.filter(
    f => f.endsWith('.ts') && f !== 'index.ts' && f !== 'types.ts'
  );

  for (const file of toolFiles.sort()) {
    const toolName = file.replace('.ts', '');
    const filePath = join(serverDir, file);
    const description = await extractDescription(filePath);
    console.log(`  ${toolName}`);
    console.log(`    ${description}\n`);
  }
}

/**
 * Show detailed info about a specific tool
 */
async function showToolInfo(serverName: string, toolName: string) {
  const serverDir = join(__dirname, 'servers', serverName);
  const toolFile = join(serverDir, `${toolName}.ts`);

  try {
    await stat(toolFile);
  } catch {
    console.error(`\nError: Tool "${toolName}" not found in server "${serverName}".\n`);
    return;
  }

  const content = await readFile(toolFile, 'utf-8');

  // Extract full JSDoc comment
  const jsdocMatch = content.match(/\/\*\*\s*\n([\s\S]*?)\*\//);
  const description = jsdocMatch
    ? jsdocMatch[1]
        .split('\n')
        .map(line => line.replace(/^\s*\*\s?/, ''))
        .join('\n')
        .trim()
    : 'No description available';

  console.log(`\nTool: ${serverName}/${toolName}\n`);
  console.log('Description:');
  console.log(description);
  console.log(`\nFile: ${toolFile}\n`);
  console.log('See types.ts in the same directory for input/output type definitions.\n');
}

/**
 * Test connection to a server
 */
async function testServerConnection(serverName: string) {
  const config = serverConfig[serverName as keyof typeof serverConfig];

  if (!config) {
    console.error(`\nError: No configuration found for server "${serverName}".\n`);
    console.log('Available servers:', Object.keys(serverConfig).join(', '));
    return;
  }

  console.log(`\nTesting connection to ${serverName}...\n`);
  console.log('Config:', JSON.stringify(config, null, 2));

  try {
    await initializeServer(serverName, config);
    const tools = await listServerTools(serverName);

    console.log(`\n✓ Successfully connected to ${serverName}`);
    console.log(`\nTools available from server (${tools.length}):\n`);

    tools.forEach((tool: any) => {
      console.log(`  - ${tool.name}`);
      if (tool.description) {
        console.log(`    ${tool.description}`);
      }
    });

    await closeAllServers();
  } catch (error) {
    console.error(`\n✗ Failed to connect to ${serverName}:`);
    console.error(error instanceof Error ? error.message : String(error));
  }

  console.log();
}

/**
 * Session Management Commands
 */

/**
 * Start a persistent MCP session
 */
async function sessionStart(serverName: string) {
  const config = serverConfig[serverName as keyof typeof serverConfig];

  if (!config) {
    console.error(`\nError: Server "${serverName}" not found in servers.json\n`);
    console.error('Available servers:', Object.keys(serverConfig).join(', '));
    process.exit(1);
  }

  try {
    const url = await sessionManager.start(serverName, config);
    console.log(`\n✓ Session '${serverName}' started successfully`);
    console.log(`  URL: ${url}`);
    console.log(`\nCall tools with:`);
    console.log(`  pnpm run session -- call ${serverName} <tool-name> '<json-params>'\n`);
  } catch (error) {
    console.error(`\n✗ Failed to start session '${serverName}':`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Stop a persistent MCP session
 */
async function sessionStop(serverName: string) {
  try {
    await sessionManager.stop(serverName);
  } catch (error) {
    console.error(`\n✗ Failed to stop session '${serverName}':`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Call a tool in an active session
 */
async function sessionCall(serverName: string, toolName: string, paramsJson: string) {
  let params: Record<string, any> = {};

  // Parse parameters
  if (paramsJson) {
    try {
      params = JSON.parse(paramsJson);
    } catch (error) {
      console.error('\n✗ Failed to parse parameters as JSON');
      console.error('Expected format: \'{"key":"value"}\'');
      process.exit(1);
    }
  }

  try {
    // Get session info from file
    const sessionInfo = await sessionManager.getSessionFromFile(serverName);

    if (!sessionInfo) {
      console.error(`\n✗ No active session found for '${serverName}'`);
      console.error(`\nStart a session with: pnpm run session -- start ${serverName}\n`);
      process.exit(1);
    }

    // Make HTTP request to session's HTTP wrapper
    const url = `http://localhost:${sessionInfo.port}/tool/${toolName}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json() as { success: boolean; result?: any; error?: string };

    if (!result.success) {
      throw new Error(result.error || 'Unknown error');
    }

    console.log(JSON.stringify(result.result, null, 2));
  } catch (error) {
    console.error(`\n✗ Failed to call tool '${toolName}':`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * List all active sessions
 */
async function sessionList() {
  const sessions = await sessionManager.list();

  if (sessions.length === 0) {
    console.log('\nNo active sessions.');
    console.log('\nStart a session with: pnpm run session -- start <server-name>\n');
    return;
  }

  console.log('\nActive Sessions:\n');

  for (const session of sessions) {
    console.log(`  ${session.serverName}`);
    console.log(`    Port: ${session.port}`);
    console.log(`    PID: ${session.pid}`);
    console.log(`    URL: http://localhost:${session.port}`);
    console.log(`    Uptime: ${session.uptime}\n`);
  }

  console.log('Call tools with: pnpm run session -- call <server> <tool> \'<params>\'\n');
}

/**
 * Handle session commands
 */
async function handleSessionCommand() {
  const subcommand = args[0];

  if (!subcommand || subcommand === 'help') {
    console.log('\nSession Management Commands:\n');
    console.log('  pnpm run session -- start <server>           Start a persistent session');
    console.log('  pnpm run session -- stop <server>            Stop a session');
    console.log('  pnpm run session -- call <server> <tool> <params>  Call a tool');
    console.log('  pnpm run session -- list                     List active sessions');
    console.log('\nExample:');
    console.log('  pnpm run session -- start chrome-devtools');
    console.log('  pnpm run session -- call chrome-devtools navigate_page \'{"url":"https://example.com"}\'');
    console.log('  pnpm run session -- stop chrome-devtools\n');
    return;
  }

  switch (subcommand) {
    case 'start': {
      const serverName = args[1];
      if (!serverName) {
        console.error('\nError: Please specify a server name.\n');
        console.log('Usage: pnpm run session -- start <server-name>\n');
        process.exit(1);
      }
      await sessionStart(serverName);
      break;
    }

    case 'stop': {
      const serverName = args[1];
      if (!serverName) {
        console.error('\nError: Please specify a server name.\n');
        console.log('Usage: pnpm run session -- stop <server-name>\n');
        process.exit(1);
      }
      await sessionStop(serverName);
      break;
    }

    case 'call': {
      const serverName = args[1];
      const toolName = args[2];
      const paramsJson = args[3];

      if (!serverName || !toolName) {
        console.error('\nError: Please specify server and tool names.\n');
        console.log('Usage: pnpm run session -- call <server> <tool> \'<json-params>\'\n');
        process.exit(1);
      }

      await sessionCall(serverName, toolName, paramsJson);
      break;
    }

    case 'list': {
      await sessionList();
      break;
    }

    default:
      console.error(`\nError: Unknown session command "${subcommand}"\n`);
      console.log('Run "pnpm run session" for help.\n');
      process.exit(1);
  }
}

/**
 * Main CLI handler
 */
async function main() {
  try {
    // Route to session manager if in session mode
    if (isSessionMode) {
      await handleSessionCommand();
      return;
    }

    // Otherwise, handle discovery commands
    if (!command || command === 'help') {
      await listServers();
    } else if (command === 'list') {
      const serverName = args[1];
      if (!serverName) {
        console.error('\nError: Please specify a server name.\n');
        console.log('Usage: pnpm run discover -- list <server-name>\n');
        return;
      }
      await listToolsInServer(serverName);
    } else if (command === 'info') {
      const serverName = args[1];
      const toolName = args[2];
      if (!serverName || !toolName) {
        console.error('\nError: Please specify both server and tool names.\n');
        console.log('Usage: pnpm run discover -- info <server> <tool>\n');
        return;
      }
      await showToolInfo(serverName, toolName);
    } else if (command === 'test') {
      const serverName = args[1];
      if (!serverName) {
        console.error('\nError: Please specify a server name.\n');
        console.log('Usage: pnpm run discover -- test <server-name>\n');
        return;
      }
      await testServerConnection(serverName);
    } else {
      console.error(`\nError: Unknown command "${command}"\n`);
      await listServers();
    }
  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
