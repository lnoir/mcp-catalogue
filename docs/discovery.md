# Discovery CLI

The discovery CLI lets you explore available MCP servers and tools without loading them all into context.

## Commands

### List All Servers

```bash
pnpm run discover
```

Shows all available servers with their tool counts.

### List Tools in a Server

```bash
pnpm run discover -- list <server-name>
```

Example:
```bash
pnpm run discover -- list coretx
```

Shows all tools available in the specified server with descriptions.

### Get Tool Details

```bash
pnpm run discover -- info <server-name> <tool-name>
```

Example:
```bash
pnpm run discover -- info coretx get-ai-notes
```

Shows detailed information about a specific tool including its JSDoc comment and file location.

### Test Server Connection

```bash
pnpm run discover -- test <server-name>
```

Example:
```bash
pnpm run discover -- test coretx
```

Tests connection to the MCP server and lists all tools it provides.

## How It Works

The discovery system organizes tools in a hierarchical filesystem structure:

```
~/.mcp-catalogue/
└── servers/
    └── example-server/
        ├── index.ts              # Re-exports all tools
        ├── example_tool.ts       # Individual tool wrapper (with types inline)
        └── ...                   # More tool files
```

Each tool wrapper is a small file that calls `callMCPTool()` with the appropriate parameters. This keeps individual tools discoverable without loading everything into memory.

## Tool File Structure

Each tool file follows a consistent pattern:

```typescript
/**
 * Brief description of what the tool does
 */

import { callMCPTool } from '../../mcp-client.js';
import type { MCPToolResponse } from '../../types.js';

export interface ToolInput {
  query: string; // Exact parameter name & explanation
  limit?: number; // Optional parameter details inline
}

export interface ToolResponse {
  success: boolean;
}

export async function toolName(
  input: ToolInput
): Promise<MCPToolResponse<ToolResponse>> {
  return callMCPTool<ToolResponse>('server-name', 'tool_name', input);
}
```

Document inputs/outputs directly on the interface properties—the discovery CLI
will surface the top-of-file JSDoc comment, and the inline comments keep
parameter guidance close to the code.

> Tip: keep these interfaces local to the tool file and avoid re-exporting them
> from `index.ts`. When every tool owns names like `TimelineEntry`, re-exporting
> all symbols would cause conflicts for downstream consumers.

## Available Servers

Run `pnpm run discover` to see the current list. Server availability depends on what's configured in your `servers.json` file.
