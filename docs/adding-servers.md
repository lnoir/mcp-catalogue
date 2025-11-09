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

### 4. Define tool types inline

Keep each tool’s input/output interfaces next to its wrapper so people (and AI
agents) can see everything in one place. Document parameters with concise
inline comments:

```typescript
export interface ResolveLibraryInput {
  libraryName: string; // Exact library name (e.g. "react")
  version?: string; // Optional semver range, defaults to latest
}

export interface ResolveLibraryResponse {
  id: string;
  summary: string;
}
```

This makes the tool file self-contained—no need for a separate `types.ts`. **Do not
re-export these interfaces in `index.ts`**—keep them local to the tool file so
names don’t collide when other tools define similarly named shapes (e.g.
multiple `TimelineEntry` interfaces).

### 5. Create Tool Wrapper Files

Create one file per tool (e.g., `tool-1.ts`):

```typescript
/**
 * Brief description of what this tool does
 *
 * Add any gotchas or usage hints here; this block shows up in discovery output.
 */

import { callMCPTool } from '../../mcp-client.js';
import type { MCPToolResponse } from '../../types.js';

export interface ToolInput {
  param1: string; // Description of param1 and required format
  param2?: number; // Optional parameter, defaults to 10
}

export interface ToolResponse {
  result: string;
  success: boolean;
}

export async function toolName(
  input: ToolInput
): Promise<MCPToolResponse<ToolResponse>> {
  return callMCPTool<ToolResponse>('server-name', 'tool_name', input);
}
```

**Critical: Document Parameters Accurately**

Inline comments on each property replace the old `inputSchema` table. Make sure
you cover:
1. Exact parameter names
2. Whether they’re required or optional (and default values)
3. Format expectations (comma-separated, ISO date, etc.)
4. Any authentication requirements (e.g., `access_key` optional)  

**How to find accurate parameters:**
- Use `pnpm run discover -- test your-server-name` to inspect tool schemas
- Check the upstream server’s source code or docs
- Make test calls and watch for validation errors
- Document what you learn directly in the interface

**Important**:
- Function name: camelCase (`toolName`)
- MCP tool name: snake_case (`'tool_name'`)
- Server name: kebab-case (`'your-server-name'`)
- Keep everything in one file: JSDoc, interfaces, and the wrapper function
- Avoid `export *` re-exports of types in `index.ts`; import the tool function
  directly (`export { toolName } from './tool-name.js'`) so interfaces with the
  same name in different files don’t collide.

### 6. Create `index.ts`

Re-export all tools:

```typescript
/**
 * Your Server MCP Tools
 *
 * Brief description of what this server does
 */

export { tool1 } from './tool-1.js';
export { tool2 } from './tool-2.js';
// ... export all tool functions

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
├── navigate-page.ts
├── take-screenshot.ts
└── ... (18 more tools)
```

3. **Tool Wrapper** (`navigate-page.ts`):
```typescript
/**
 * Navigate to a URL
 */

import { callMCPTool } from '../../mcp-client.js';
import type { MCPToolResponse } from '../../types.js';

export interface NavigatePageInput {
  url: string; // Absolute URL to open
}

export interface NavigatePageResponse {
  success: boolean;
  url: string;
}

export async function navigatePage(
  input: NavigatePageInput
): Promise<MCPToolResponse<NavigatePageResponse>> {
  return callMCPTool<NavigatePageResponse>('chrome-devtools', 'navigate_page', input);
}
```

4. **Index** (`index.ts`):
```typescript
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
