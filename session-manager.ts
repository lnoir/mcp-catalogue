/**
 * MCP Session Manager
 *
 * Manages persistent MCP server sessions with HTTP wrappers,
 * allowing AI agents to spawn, control, and terminate sessions on-demand.
 */

import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initializeServer, closeAllServers } from './mcp-client.js';
import { createSessionHTTPWrapper } from './session-http-wrapper.js';
import type { SessionInfo, MCPServerConfig, SessionsFile, SessionFileEntry } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSIONS_FILE = join(__dirname, '.sessions.json');

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
   * Load sessions from file
   */
  private async loadSessionsFromFile(): Promise<SessionsFile> {
    try {
      const content = await readFile(SESSIONS_FILE, 'utf-8');
      return JSON.parse(content) as SessionsFile;
    } catch (error) {
      // File doesn't exist or is invalid, return empty
      return {};
    }
  }

  /**
   * Save sessions to file
   */
  private async saveSessionsToFile(sessions: SessionsFile): Promise<void> {
    try {
      await writeFile(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save sessions file:', error);
    }
  }

  /**
   * Add session to file
   */
  private async addSessionToFile(serverName: string, entry: SessionFileEntry): Promise<void> {
    const sessions = await this.loadSessionsFromFile();
    sessions[serverName] = entry;
    await this.saveSessionsToFile(sessions);
  }

  /**
   * Remove session from file
   */
  private async removeSessionFromFile(serverName: string): Promise<void> {
    const sessions = await this.loadSessionsFromFile();
    delete sessions[serverName];
    await this.saveSessionsToFile(sessions);
  }

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

      // Save to file for persistence across CLI invocations
      await this.addSessionToFile(serverName, {
        port,
        pid: process.pid,
        startedAt: sessionInfo.startedAt.toISOString(),
      });

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
    // Check if session exists in file
    const sessionInfo = await this.getSessionFromFile(serverName);

    if (!sessionInfo) {
      throw new Error(`No active session found for '${serverName}'`);
    }

    const session = this.sessions.get(serverName);

    if (session) {
      // Session is in memory, clean up resources
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
      } catch (error) {
        throw new Error(
          `Failed to stop session '${serverName}': ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    } else {
      // Session exists in file but not in memory (different process)
      // Try to kill the process if it's still running
      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        // Check if process is still running
        try {
          await execAsync(`kill -0 ${sessionInfo.pid} 2>/dev/null`);
          // Process exists, kill it
          await execAsync(`kill ${sessionInfo.pid}`);
          console.log(`Killed process ${sessionInfo.pid} for session '${serverName}'`);
        } catch {
          // Process doesn't exist, just clean up the file
          console.log(`Process ${sessionInfo.pid} not running, cleaning up session file`);
        }
      } catch (error) {
        console.warn(`Warning: Could not kill process ${sessionInfo.pid}:`, error);
      }
    }

    // Remove from file
    await this.removeSessionFromFile(serverName);

    console.log(`\n✓ Session '${serverName}' stopped successfully\n`);
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
   * Get session info from file (for CLI commands)
   *
   * @param serverName - Name of the server
   * @returns Session file entry or null if not found
   */
  async getSessionFromFile(serverName: string): Promise<SessionFileEntry | null> {
    const sessions = await this.loadSessionsFromFile();
    return sessions[serverName] || null;
  }

  /**
   * List all active sessions
   *
   * @returns Array of session information
   */
  async list(): Promise<Array<{ serverName: string; port: number; uptime: string; pid: number }>> {
    const sessions = await this.loadSessionsFromFile();

    return Object.entries(sessions).map(([serverName, session]) => {
      const startedAt = new Date(session.startedAt);
      const uptimeMs = Date.now() - startedAt.getTime();
      const uptimeSec = Math.floor(uptimeMs / 1000);
      const uptimeMin = Math.floor(uptimeSec / 60);

      return {
        serverName,
        port: session.port,
        pid: session.pid,
        uptime: uptimeMin > 0 ? `${uptimeMin}m ${uptimeSec % 60}s` : `${uptimeSec}s`,
      };
    });
  }

  /**
   * Stop all sessions
   */
  async stopAll(): Promise<void> {
    const sessions = await this.loadSessionsFromFile();
    const serverNames = Object.keys(sessions);

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
