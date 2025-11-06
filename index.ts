#!/usr/bin/env node
/**
 * MCP Server Discovery CLI
 *
 * Explore available MCP servers and tools without loading them all into context.
 *
 * Usage:
 *   pnpm run discover                           # List all servers
 *   pnpm run discover -- list <server>          # List tools in a server
 *   pnpm run discover -- info <server> <tool>   # Get tool details
 *   pnpm run discover -- test <server>          # Test server connection
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import serverConfig from './servers.json' with { type: 'json' };
import { initializeServer, listServerTools, closeAllServers } from './mcp-client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Filter out the -- separator that pnpm adds
const args = process.argv.slice(2).filter(arg => arg !== '--');
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
 * Main CLI handler
 */
async function main() {
  try {
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
