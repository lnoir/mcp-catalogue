/**
 * MCP Client wrapper for calling tools
 *
 * This module provides a unified interface for calling MCP tools
 * across different servers using the Model Context Protocol SDK.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { MCPToolResponse, MCPToolInput, MCPServerConfig } from './types.js';

/**
 * Active MCP client connections
 */
const clients = new Map<string, Client>();

/**
 * Initialize a connection to an MCP server
 */
export async function initializeServer(
  serverName: string,
  config: MCPServerConfig
): Promise<Client> {
  // Return existing client if already initialized
  if (clients.has(serverName)) {
    return clients.get(serverName)!;
  }

  // Create transport based on config
  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    env: config.env,
  });

  // Create and connect client
  const client = new Client(
    {
      name: `mcp-client-${serverName}`,
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  await client.connect(transport);
  clients.set(serverName, client);

  return client;
}

/**
 * Call an MCP tool
 *
 * @param serverName - Name of the MCP server
 * @param toolName - Name of the tool to call
 * @param input - Input parameters for the tool
 * @returns Tool response
 */
export async function callMCPTool<T = unknown, TInput extends Record<string, any> = Record<string, any>>(
  serverName: string,
  toolName: string,
  input: TInput = {} as TInput
): Promise<MCPToolResponse<T>> {
  const client = clients.get(serverName);

  if (!client) {
    throw new Error(
      `Server "${serverName}" not initialized. Call initializeServer() first.`
    );
  }

  try {
    const result = await client.callTool({
      name: toolName,
      arguments: input,
    });

    return result as MCPToolResponse<T>;
  } catch (error) {
    throw new Error(
      `Failed to call tool "${toolName}" on server "${serverName}": ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * List all available tools from a server
 */
export async function listServerTools(serverName: string): Promise<any[]> {
  const client = clients.get(serverName);

  if (!client) {
    throw new Error(
      `Server "${serverName}" not initialized. Call initializeServer() first.`
    );
  }

  const result = await client.listTools();
  return result.tools;
}

/**
 * Cleanup: close all server connections
 */
export async function closeAllServers(): Promise<void> {
  for (const [name, client] of clients.entries()) {
    await client.close();
    clients.delete(name);
  }
}
