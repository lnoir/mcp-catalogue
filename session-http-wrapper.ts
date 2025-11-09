/**
 * HTTP Wrapper for MCP Session
 *
 * Creates a lightweight Express server that proxies HTTP requests
 * to an underlying stdio MCP connection, maintaining state across calls.
 */

import express, { type Request, type Response } from 'express';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Server } from 'http';

/**
 * Create an HTTP wrapper for an MCP session
 *
 * @param serverName - Name of the MCP server
 * @param mcpClient - Connected MCP client
 * @param port - Port to listen on
 * @returns Express application
 */
export function createSessionHTTPWrapper(
  serverName: string,
  mcpClient: Client,
  port: number
): Server {
  const app = express();

  // Parse JSON bodies
  app.use(express.json());

  /**
   * Health check endpoint
   */
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      serverName,
      port,
      uptime: process.uptime(),
    });
  });

  /**
   * Call MCP tool endpoint
   * POST /tool/:toolName
   * Body: JSON parameters for the tool
   */
  app.post('/tool/:toolName', async (req: Request, res: Response) => {
    const { toolName } = req.params;
    const params = req.body || {};

    try {
      const result = await mcpClient.callTool({
        name: toolName,
        arguments: params,
      });

      res.json({
        success: true,
        result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Start listening
  const server = app.listen(port, () => {
    console.log(`Session '${serverName}' started on http://localhost:${port}`);
  });

  return server;
}
