/**
 * Common types for MCP tool wrappers
 */

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Express } from 'express';

export interface MCPToolResponse<T = unknown> {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export type MCPToolInput = Record<string, unknown>;

/**
 * Server configuration
 */
export interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  transport?: 'stdio' | 'http' | 'sse';
}

export interface ServerRegistry {
  [serverName: string]: MCPServerConfig;
}

/**
 * Session management types
 */
export interface SessionInfo {
  serverName: string;
  port: number;
  mcpClient: Client;
  httpServer: Express;
  startedAt: Date;
}

/**
 * Session file persistence types
 */
export interface SessionFileEntry {
  port: number;
  pid: number;
  startedAt: string;
}

export interface SessionsFile {
  [serverName: string]: SessionFileEntry;
}
