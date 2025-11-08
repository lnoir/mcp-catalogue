# Progressive MCP Tool Discovery

A filesystem-based progressive discovery system for Model Context Protocol (MCP) tools. Tools are organized in a hierarchy and loaded on-demand instead of all at once.

## Architecture

```
~/.mcp-catalogue/
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
cd ~/.mcp-catalogue
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

## Session Manager

The session manager allows you to start persistent MCP servers that maintain state across multiple tool calls. This is essential for servers like `chrome-devtools` that require an active browser session.

### Why Use Sessions?

**Stateless servers** (like Coretx) can be called anytime via `pnpm run call`.

**Session-based servers** (like Chrome DevTools, databases, file watchers) need persistent connections:
- Browser automation requires maintaining browser state
- Database connections need transaction context
- File watchers need continuous monitoring

### Session Commands

```bash
# Start a persistent session
pnpm run session -- start <server-name>
# Returns: Session started on http://localhost:PORT

# Call a tool in the active session
pnpm run session -- call <server-name> <tool-name> '<json-params>'

# List all active sessions
pnpm run session -- list

# Stop a session and cleanup
pnpm run session -- stop <server-name>
```

### Example: Browser Automation Workflow

```bash
# Start Chrome DevTools session
pnpm run session -- start chrome-devtools
# → Session 'chrome-devtools' started on http://localhost:3978

# Navigate to a page
pnpm run session -- call chrome-devtools navigate_page '{"url":"https://example.com"}'

# Take a screenshot
pnpm run session -- call chrome-devtools take_screenshot '{"fullPage":true}'

# Check console messages
pnpm run session -- call chrome-devtools list_console_messages '{}'

# Stop the session when done
pnpm run session -- stop chrome-devtools
```

### Architecture

Each session:
1. Spawns the MCP server as a stdio process
2. Wraps it with a lightweight HTTP server on localhost
3. Maintains the connection across multiple tool calls
4. Provides graceful cleanup when stopped

```
AI Agent → CLI → Session Manager
                       ↓
          HTTP Wrapper (localhost:PORT)
                       ↓
          Stdio MCP Connection
                       ↓
          MCP Server (chrome, db, etc.)
```

### Use Cases

**Browser Testing & Debugging**
```bash
# Start session, navigate, interact, screenshot, debug - all maintaining browser state
pnpm run session -- start chrome-devtools
pnpm run session -- call chrome-devtools navigate_page '{"url":"https://myapp.com"}'
pnpm run session -- call chrome-devtools fill '{"selector":"#email","value":"test@example.com"}'
pnpm run session -- call chrome-devtools click '{"selector":"#submit"}'
pnpm run session -- call chrome-devtools take_screenshot '{}'
```

**Database Operations**
```bash
# Maintain transaction context across queries (when postgres-mcp is added)
pnpm run session -- start postgres
pnpm run session -- call postgres query '{"sql":"BEGIN"}'
pnpm run session -- call postgres query '{"sql":"INSERT ..."}'
pnpm run session -- call postgres query '{"sql":"COMMIT"}'
```

**File System Watching**
```bash
# Monitor build output over time (when file-watcher-mcp is added)
pnpm run session -- start file-watcher
pnpm run session -- call file-watcher watch '{"path":"./dist"}'
# ... make code changes ...
pnpm run session -- call file-watcher get_changes '{}'
```

## Adding New Servers

To add a new MCP server:

1. **Find the server's tool definitions**
   - Check the GitHub repository
   - Look in `src/index.ts` or similar files
   - Extract exact tool names and schemas

2. **Create server directory**
   ```bash
   mkdir ~/.mcp-catalogue/new-server
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

