# Progressive MCP Tool Discovery

A filesystem-based progressive discovery system for Model Context Protocol (MCP) tools. Load tools on-demand instead of all at once.

## Quick Start

- **[Discovery CLI](docs/discovery.md)** - Explore servers and tools without loading everything
- **[Session Manager](docs/sessions.md)** - Run persistent MCP servers for browsers, databases, etc.
- **[Adding Servers](docs/adding-servers.md)** - Extend the catalogue with new MCP servers

## Installation

Dependencies should already be installed. If needed:

```bash
cd ~/.mcp-catalogue
pnpm install
```

**Requirements**: Node.js 20+ (many MCP servers require modern Node features)

## Usage Examples

### Discover Tools

```bash
# List all servers
pnpm run discover

# List tools in a server
pnpm run discover -- list chrome-devtools

# Get tool details
pnpm run discover -- info chrome-devtools navigate-page
```

### Use Sessions

```bash
# Start a browser session
pnpm run session -- start chrome-devtools

# Navigate and screenshot
pnpm run session -- call chrome-devtools navigate_page '{"url":"https://example.com"}'
pnpm run session -- call chrome-devtools take_screenshot '{}'

# Stop when done
pnpm run session -- stop chrome-devtools
```

## Architecture

```
~/.mcp-catalogue/
├── servers.json          # Server configurations
├── index.ts              # CLI entry point
├── session-manager.ts    # Persistent sessions
├── mcp-client.ts         # MCP client wrapper
├── docs/                 # Documentation
│   ├── discovery.md
│   ├── sessions.md
│   └── adding-servers.md
└── servers/              # Server implementations
    ├── coretx/
    │   ├── coretx_get_ai_notes.ts
    │   ├── coretx_create_session.ts
    │   └── index.ts
    └── chrome-devtools/
        ├── navigate-page.ts
        ├── take-screenshot.ts
        └── index.ts
```

Each tool file documents its own input/output interfaces right next to the
`callMCPTool()` wrapper, keeping discovery metadata, validation notes, and types
co-located. To avoid duplicate type names leaking through a barrel, re-export
only the callable wrappers (e.g., `export { createSession } from './coretx_create_session.js'`)
and keep the interfaces local to their files.

## Available Servers

Run `pnpm run discover` to see all configured servers and their tool counts. Availability depends on your `servers.json` configuration.

## How It Works

1. **Progressive Discovery**: Tools are organized in files but not all loaded into memory
2. **On-Demand Loading**: Import only the tools you need when you need them
3. **Session Persistence**: Maintain stateful connections for tools that need them
4. **HTTP Wrappers**: Session-based servers expose local HTTP endpoints for tool calls

## Contributing

To add a new server, see [Adding Servers](docs/adding-servers.md).

## License

[Add your license here]
