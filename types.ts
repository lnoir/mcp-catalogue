/**
 * Common types for MCP tool wrappers
 */

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
