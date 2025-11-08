#!/usr/bin/env node
/**
 * Generic MCP Tool Caller CLI
 *
 * Call any MCP tool without writing boilerplate code.
 *
 * Usage:
 *   pnpm run call <server> <tool> [params]
 *
 * Params can be:
 *   - JSON string: '{"key":"value"}'
 *   - File: @params.json
 *   - Stdin: - (read from stdin)
 *   - Omitted: {} (empty params)
 *
 * Examples:
 *   pnpm run call atlassian getJiraIssue '{"cloudId":"...","issueIdOrKey":"API-86"}'
 *   pnpm run call coretx getAiNotes '{"category":"","tags":"","limit":5,"offset":0}'
 *   echo '{"cloudId":"..."}' | pnpm run call atlassian getJiraIssue -
 *   pnpm run call atlassian createJiraIssue @params.json
 */

import { readFile } from 'fs/promises';
import { stdin } from 'process';
import { checkNodeVersion } from './check-node-version.js';
import { initializeServer, callMCPTool, closeAllServers } from './mcp-client.js';
import type { ServerRegistry } from './types.js';
import serverConfigRaw from './servers.json' with { type: 'json' };

const serverConfig = serverConfigRaw as ServerRegistry;

// Check Node version before doing anything
checkNodeVersion();

/**
 * Read data from stdin
 */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Parse params from various sources
 */
async function parseParams(paramsArg?: string): Promise<Record<string, any>> {
  if (!paramsArg) {
    return {};
  }

  // Read from stdin
  if (paramsArg === '-') {
    const input = await readStdin();
    return JSON.parse(input.trim());
  }

  // Read from file
  if (paramsArg.startsWith('@')) {
    const filePath = paramsArg.slice(1);
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  // Parse JSON string
  return JSON.parse(paramsArg);
}

/**
 * Main CLI handler
 */
async function main() {
  const args = process.argv.slice(2);
  const [serverName, toolName, paramsArg] = args;

  // Validate arguments
  if (!serverName || !toolName) {
    console.error('\nUsage: pnpm run call <server> <tool> [params]\n');
    console.error('Examples:');
    console.error('  pnpm run call atlassian getJiraIssue \'{"cloudId":"...","issueIdOrKey":"API-86"}\'');
    console.error('  pnpm run call coretx getAiNotes \'{"category":"","tags":"","limit":5}\'');
    console.error('  echo \'{"cloudId":"..."}\' | pnpm run call atlassian getJiraIssue -');
    console.error('  pnpm run call atlassian createJiraIssue @params.json\n');
    process.exit(1);
  }

  // Check if server exists in config
  const config = serverConfig[serverName as keyof typeof serverConfig];
  if (!config) {
    console.error(`\nError: Server "${serverName}" not found in servers.json\n`);
    console.error('Available servers:', Object.keys(serverConfig).join(', '));
    console.error('\nRun "pnpm run discover" to see all available servers.\n');
    process.exit(1);
  }

  try {
    // Parse parameters
    const params = await parseParams(paramsArg);

    // Initialize server
    await initializeServer(serverName, config);

    // Call tool
    const result = await callMCPTool(serverName, toolName, params);

    // Output result as JSON
    console.log(JSON.stringify(result, null, 2));

    // Cleanup
    await closeAllServers();
  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : String(error));
    console.error('\nTip: Run "pnpm run discover -- list ' + serverName + '" to see available tools.\n');
    await closeAllServers();
    process.exit(1);
  }
}

main();
