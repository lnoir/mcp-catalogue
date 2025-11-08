/**
 * MCP Session Manager
 *
 * Manages persistent MCP server sessions with HTTP wrappers,
 * allowing AI agents to spawn, control, and terminate sessions on-demand.
 */

import { initializeServer, closeAllServers } from './mcp-client.js';
import { createSessionHTTPWrapper } from './session-http-wrapper.js';
import type { SessionInfo, MCPServerConfig } from './types.js';

/**
 * Port allocation pool for sessions
 */
const PORT_POOL = [3978, 3979, 3980, 3981, 3982];

/**
 * MCP Session Manager Singleton
 */
class MCPSessionManager {
  private sessions = new Map<string, SessionInfo>();
  private usedPorts = new Set<number>();

  /**
   * Allocate an available port from the pool
   */
  private allocatePort(): number {
    for (const port of PORT_POOL) {
      if (!this.usedPorts.has(port)) {
        this.usedPorts.add(port);
        return port;
      }
    }
    throw new Error('No available ports in pool. Stop a session first.');
  }

  /**
   * Release a port back to the pool
   */
  private releasePort(port: number): void {
    this.usedPorts.delete(port);
  }

  /**
   * Start a persistent session for an MCP server
   *
   * @param serverName - Name of the server from servers.json
   * @param config - Server configuration
   * @returns URL of the HTTP wrapper
   */
  async start(serverName: string, config: MCPServerConfig): Promise<string> {
    // Check if session already exists
    if (this.sessions.has(serverName)) {
      const existing = this.sessions.get(serverName)!;
      return `http://localhost:${existing.port}`;
    }

    // Allocate port
    const port = this.allocatePort();

    try {
      // Initialize MCP client
      const mcpClient = await initializeServer(serverName, config);

      // Create HTTP wrapper
      const httpServer = createSessionHTTPWrapper(serverName, mcpClient, port);

      // Store session info
      const sessionInfo: SessionInfo = {
        serverName,
        port,
        mcpClient,
        httpServer,
        startedAt: new Date(),
      };

      this.sessions.set(serverName, sessionInfo);

      return `http://localhost:${port}`;
    } catch (error) {
      // Release port on failure
      this.releasePort(port);
      throw new Error(
        `Failed to start session '${serverName}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Stop a session and cleanup resources
   *
   * @param serverName - Name of the server session to stop
   */
  async stop(serverName: string): Promise<void> {
    const session = this.sessions.get(serverName);

    if (!session) {
      throw new Error(`No active session found for '${serverName}'`);
    }

    try {
      // Close HTTP server
      await new Promise<void>((resolve, reject) => {
        const server = (session.httpServer as any).listen?.();
        if (server) {
          server.close((err: Error | undefined) => {
            if (err) reject(err);
            else resolve();
          });
        } else {
          resolve();
        }
      });

      // Close MCP client
      await session.mcpClient.close();

      // Release port
      this.releasePort(session.port);

      // Remove session
      this.sessions.delete(serverName);

      console.log(`Session '${serverName}' stopped successfully`);
    } catch (error) {
      throw new Error(
        `Failed to stop session '${serverName}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Call a tool in an active session
   *
   * @param serverName - Name of the server session
   * @param toolName - Name of the tool to call
   * @param params - Tool parameters
   * @returns Tool result
   */
  async call(
    serverName: string,
    toolName: string,
    params: Record<string, any>
  ): Promise<any> {
    const session = this.sessions.get(serverName);

    if (!session) {
      throw new Error(
        `No active session found for '${serverName}'. Start one with: pnpm run session -- start ${serverName}`
      );
    }

    try {
      const result = await session.mcpClient.callTool({
        name: toolName,
        arguments: params,
      });

      return result;
    } catch (error) {
      throw new Error(
        `Failed to call tool '${toolName}' on session '${serverName}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * List all active sessions
   *
   * @returns Array of session information
   */
  list(): Array<{ serverName: string; port: number; uptime: string }> {
    return Array.from(this.sessions.values()).map((session) => {
      const uptimeMs = Date.now() - session.startedAt.getTime();
      const uptimeSec = Math.floor(uptimeMs / 1000);
      const uptimeMin = Math.floor(uptimeSec / 60);

      return {
        serverName: session.serverName,
        port: session.port,
        uptime: uptimeMin > 0 ? `${uptimeMin}m ${uptimeSec % 60}s` : `${uptimeSec}s`,
      };
    });
  }

  /**
   * Stop all sessions
   */
  async stopAll(): Promise<void> {
    const serverNames = Array.from(this.sessions.keys());

    for (const serverName of serverNames) {
      try {
        await this.stop(serverName);
      } catch (error) {
        console.error(`Error stopping session '${serverName}':`, error);
      }
    }
  }
}

// Export singleton instance
export const sessionManager = new MCPSessionManager();
