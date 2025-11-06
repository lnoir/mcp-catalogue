# Progressive MCP Tool Discovery

A filesystem-based progressive discovery system for Model Context Protocol (MCP) tools. Tools are organized in a hierarchy and loaded on-demand instead of all at once.

## Architecture

```
~/.mcp-servers/
├── package.json              # Project configuration
├── tsconfig.json             # TypeScript config
├── servers.json              # MCP server configurations
├── types.ts                  # Shared type definitions
├── mcp-client.ts             # MCP client wrapper
├── index.ts                  # Discovery CLI
├── servers/                  # MCP server implementations
│   └── example-server/       # Each server has its own directory
│       ├── index.ts          # Re-exports all tools
│       ├── types.ts          # Server-specific types
│       ├── tool-name.ts      # Individual tool wrapper
│       └── ...               # More tool files
└── README.md                 # This file
```

## Installation

Dependencies are already installed. If you need to reinstall:

```bash
cd ~/.mcp-servers
pnpm install
```

## Usage

### Discovery CLI

Explore available tools without loading them all into context:

```bash
# List all available MCP servers
pnpm run discover

# List tools in a specific server
pnpm run discover -- list coretx

# Get detailed information about a tool
pnpm run discover -- info coretx get-ai-notes

# Test server connection (requires server to be running)
pnpm run discover -- test coretx
```

## Available Servers

Run `pnpm run discover` to see all available servers and their tool counts. The discovery CLI is the source of truth - server availability depends on your environment.

## Adding New Servers

To add a new MCP server:

1. **Find the server's tool definitions**
   - Check the GitHub repository
   - Look in `src/index.ts` or similar files
   - Extract exact tool names and schemas

2. **Create server directory**
   ```bash
   mkdir ~/.mcp-servers/new-server
   ```

3. **Create types.ts**
   - Define TypeScript interfaces for all inputs/outputs
   - Follow naming convention: `ToolNameInput`, `ToolNameResponse`

4. **Create tool wrapper files**
   - One file per tool (e.g., `tool-name.ts`)
   - Include JSDoc comments
   - Import and call `callMCPTool()`

5. **Create index.ts**
   - Re-export all tools
   - Export `SERVER_TOOLS` array with tool names

6. **Add to servers.json**
   - Include server configuration

7. **Test**
   ```bash
   pnpm run discover -- list new-server
   pnpm run discover -- test new-server
   ```

