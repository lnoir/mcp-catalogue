/**
 * MCP Session Manager
 *
 * Manages persistent MCP server sessions with HTTP wrappers,
 * allowing AI agents to spawn, control, and terminate sessions on-demand.
 */

import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import type { MCPServerConfig, SessionsFile, SessionFileEntry } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSIONS_FILE = join(__dirname, '.sessions.json');
const SESSION_WORKER = join(__dirname, 'session-worker.ts');
const TSX_BIN = join(
  __dirname,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsx.cmd' : 'tsx'
);

/**
 * Port allocation pool for sessions
 */
const PORT_POOL = [3978, 3979, 3980, 3981, 3982];

/**
 * MCP Session Manager Singleton
 */
class MCPSessionManager {
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
  private allocatePort(existingSessions: SessionsFile): number {
    for (const port of PORT_POOL) {
      const inUse = Object.values(existingSessions).some(session => session.port === port);
      if (!inUse) {
        return port;
      }
    }
    throw new Error('No available ports in pool. Stop a session first.');
  }

  /**
   * Start a persistent session for an MCP server
   *
   * @param serverName - Name of the server from servers.json
   * @param config - Server configuration
   * @returns URL of the HTTP wrapper
   */
  async start(serverName: string, config: MCPServerConfig): Promise<string> {
    const sessions = await this.loadSessionsFromFile();

    // Check if session already exists
    if (sessions[serverName]) {
      return `http://localhost:${sessions[serverName].port}`;
    }

    // Allocate port
    const port = this.allocatePort(sessions);

    try {
      const child = spawn(
        TSX_BIN,
        [SESSION_WORKER, serverName, String(port)],
        {
          detached: true,
          stdio: 'ignore',
          env: {
            ...process.env,
            MCP_SERVER_CONFIG: JSON.stringify(config),
          },
        }
      );

      if (!child.pid) {
        throw new Error('Failed to spawn session worker process');
      }

      child.unref();

      // Save to file for persistence across CLI invocations
      await this.addSessionToFile(serverName, {
        port,
        pid: child.pid,
        startedAt: new Date().toISOString(),
      });

      return `http://localhost:${port}`;
    } catch (error) {
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
    const sessionInfo = await this.getSessionFromFile(serverName);

    if (!sessionInfo) {
      throw new Error(`No active session found for '${serverName}'`);
    }

    try {
      process.kill(sessionInfo.pid, 'SIGTERM');
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'ESRCH') {
        throw new Error(
          `Failed to stop session '${serverName}': ${
            err.message || String(error)
          }`
        );
      }
      console.log(`Process ${sessionInfo.pid} not running, cleaning up session file`);
    }

    // Remove from file
    await this.removeSessionFromFile(serverName);

    console.log(`\n✓ Session '${serverName}' stopped successfully\n`);
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

    for (const serverName of Object.keys(sessions)) {
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
