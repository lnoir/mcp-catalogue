# Adding New Servers

This guide shows you how to add a new MCP server to the catalogue.

## Prerequisites

1. Know the server's npm package name or command to run it
2. Have access to the server's tool definitions (check its GitHub repo)
3. Understand the tool names and their input/output schemas

## Step-by-Step Guide

### 1. Find the Server's Tool Definitions

Check the server's GitHub repository, usually in:
- `src/index.ts` or `src/server.ts`
- Look for `server.setRequestHandler(ListToolsRequestSchema, ...)`
- Extract exact tool names and their schemas

### 2. Add Server Configuration

Edit `servers.json` to add your server:

```json
{
  "your-server-name": {
    "command": "npx",
    "args": ["your-package-name@latest"],
    "transport": "stdio"
  }
}
```

For local development:
```json
{
  "your-server-name": {
    "command": "node",
    "args": ["/path/to/server/build/index.js"],
    "transport": "stdio"
  }
}
```

### 3. Create Server Directory

```bash
mkdir ~/.mcp-catalogue/servers/your-server-name
```

### 4. Create `types.ts`

Define TypeScript interfaces for all tool inputs and outputs:

```typescript
/**
 * Type definitions for Your Server MCP tools
 */

// Tool 1
export interface Tool1Input {
  param1: string;
  param2?: number;
}

export interface Tool1Response {
  result: string;
  success: boolean;
}

// Tool 2
export interface Tool2Input {
  query: string;
}

export interface Tool2Response {
  data: any[];
  count: number;
}

// Add more tools...
```

**Naming Convention**:
- Inputs: `ToolNameInput`
- Responses: `ToolNameResponse`

### 5. Create Tool Wrapper Files

Create one file per tool (e.g., `tool-1.ts`):

```typescript
/**
 * Brief description of what this tool does
 *
 * Parameters:
 * - param1: string (required) - Description of param1
 * - param2: number (optional) - Description of param2, defaults to 10
 *
 * Example:
 * ```json
 * {
 *   "param1": "example-value",
 *   "param2": 42
 * }
 * ```
 */

export const description = 'Brief description of what this tool does';

export const inputSchema = {
  param1: { type: 'string', required: true, description: 'Description of param1' },
  param2: { type: 'number', required: false, description: 'Description of param2, defaults to 10' },
};
```

**Critical: Document Parameters Accurately**

The parameter documentation is **essential** for usability. Without it, users (including AI agents) have to guess parameter names and types through trial-and-error.

For each parameter, document:
1. **Name** - Exact parameter name the server expects
2. **Type** - string, number, boolean, array, object
3. **Required** - Whether it's required or optional
4. **Description** - What it does, format requirements, valid values
5. **Example** - Show a complete, working example

**How to find accurate parameters:**
- Use `pnpm run discover -- test your-server-name` to connect and see what the server expects
- Check the server's source code or documentation
- Make test calls and observe error messages about missing/invalid fields
- For remote servers, trial-and-error may be necessary - document what you learn!

**Important**:
- Function name: camelCase (`tool1`)
- MCP tool name: snake_case (`'tool_1'`)
- Server name: kebab-case (`'your-server-name'`)
- Include comprehensive JSDoc with parameters and examples

### 6. Create `index.ts`

Re-export all tools:

```typescript
/**
 * Your Server MCP Tools
 *
 * Brief description of what this server does
 */

export * from './types.js';
export * from './tool-1.js';
export * from './tool-2.js';
// ... export all tools

export const YOUR_SERVER_TOOLS = [
  'tool-1',
  'tool-2',
  // ... list all tool names
] as const;
```

### 7. Test the Server

Test connectivity:
```bash
pnpm run discover -- test your-server-name
```

List tools:
```bash
pnpm run discover -- list your-server-name
```

Get tool details:
```bash
pnpm run discover -- info your-server-name tool-1
```

### 8. Test Tool Calls

For stateless servers:
```bash
pnpm run call your-server-name tool_1 '{"param1":"value"}'
```

For session-based servers:
```bash
pnpm run session -- start your-server-name
pnpm run session -- call your-server-name tool_1 '{"param1":"value"}'
pnpm run session -- stop your-server-name
```

## Example: Chrome DevTools Server

Here's how chrome-devtools was added:

1. **Configuration** (`servers.json`):
```json
{
  "chrome-devtools": {
    "command": "npx",
    "args": ["chrome-devtools-mcp@latest"],
    "transport": "stdio"
  }
}
```

2. **Directory Structure**:
```
servers/chrome-devtools/
├── index.ts
├── types.ts
├── navigate-page.ts
├── take-screenshot.ts
└── ... (18 more tools)
```

3. **Type Definition** (`types.ts`):
```typescript
export interface NavigatePageInput {
  url: string;
}

export interface NavigatePageResponse {
  success: boolean;
  url: string;
}
```

4. **Tool Wrapper** (`navigate-page.ts`):
```typescript
/**
 * Navigate to a URL
 */

import { callMCPTool } from '../../mcp-client.js';
import type { NavigatePageInput, NavigatePageResponse } from './types.js';
import type { MCPToolResponse } from '../../types.js';

export async function navigatePage(
  input: NavigatePageInput
): Promise<MCPToolResponse<NavigatePageResponse>> {
  return callMCPTool<NavigatePageResponse>('chrome-devtools', 'navigate_page', input);
}
```

5. **Index** (`index.ts`):
```typescript
export * from './types.js';
export * from './navigate-page.js';
export * from './take-screenshot.js';
// ... all 20 tools

export const CHROME_DEVTOOLS_TOOLS = [
  'navigate-page',
  'take-screenshot',
  // ... all 20 tool names
] as const;
```

## Tips

- **Start small**: Add a few tools first, test them, then add more
- **Check schemas**: Make sure your TypeScript types match the server's actual schemas
- **Use discovery**: Run `pnpm run discover -- test` after adding to verify everything works
- **Document well**: JSDoc comments are important for discovery listings
- **Be selective**: You don't need to add ALL tools - just the ones you'll use (progressive discovery!)

## Common Issues

### Tool Name Mismatch
- Ensure the string passed to `callMCPTool()` matches the exact tool name the server expects
- Check the server's source code for the exact names

### Type Errors
- Make sure input/response types match what the server actually returns
- Use `any` temporarily if you're unsure, then refine later

### Connection Failures
- Verify `servers.json` has the correct command and args
- Check the server's package is installed: `npx your-package-name --version`
- Ensure Node version meets the server's requirements (usually Node 20+)

## Next Steps

After adding a server:
1. Test all tools work correctly
2. Consider contributing your implementation back to the catalogue
3. Document any quirks or special requirements in the server's `README.md`
