# Session Manager

The session manager allows you to start persistent MCP servers that maintain state across multiple tool calls. This is essential for servers that require active connections like browsers, databases, or file watchers.

## Why Use Sessions?

### Stateless Servers
Servers like Coretx can be called anytime via `pnpm run call` - they don't require persistent state.

### Session-Based Servers
Servers like Chrome DevTools require persistent connections:
- **Browser automation** - Needs to maintain browser state across navigation, interactions, screenshots
- **Database connections** - Needs transaction context across queries
- **File watchers** - Needs continuous monitoring over time

## Commands

### Start a Session

```bash
pnpm run session -- start <server-name>
```

Example:
```bash
pnpm run session -- start chrome-devtools
# → Session 'chrome-devtools' started on http://localhost:3978
```

This:
1. Spawns the MCP server process
2. Creates an HTTP wrapper on a local port (3978-3982)
3. Saves session info to `.sessions.json` for persistence

### Call a Tool

```bash
pnpm run session -- call <server-name> <tool-name> '<json-params>'
```

Example:
```bash
pnpm run session -- call chrome-devtools navigate_page '{"url":"https://example.com"}'
```

This reads the session info from `.sessions.json` and makes an HTTP request to the session's wrapper.

### List Active Sessions

```bash
pnpm run session -- list
```

Shows all currently running sessions with their ports and uptimes.

### Stop a Session

```bash
pnpm run session -- stop <server-name>
```

Example:
```bash
pnpm run session -- stop chrome-devtools
```

This gracefully shuts down the HTTP wrapper, closes the MCP connection, and removes the session from `.sessions.json`.

## Architecture

Each session consists of:

```
AI Agent → CLI Command
           ↓
    Session Manager
           ↓
    HTTP Wrapper (localhost:PORT)
           ↓
    Stdio MCP Connection
           ↓
    MCP Server (chrome, db, etc.)
```

### How It Works

1. **Session Start**: The session manager spawns the MCP server as a stdio process and wraps it with a lightweight Express HTTP server
2. **Persistence**: Session info (port, PID, start time) is saved to `.sessions.json`
3. **Tool Calls**: CLI commands read `.sessions.json` to find the port and make HTTP requests
4. **State Maintenance**: The HTTP wrapper keeps the MCP connection alive across multiple calls
5. **Cleanup**: Stopping a session closes the HTTP server, MCP client, and removes the entry from `.sessions.json`

## HTTP API

Sessions expose a simple HTTP API:

### Health Check
```bash
GET http://localhost:{port}/health
```

Returns:
```json
{
  "status": "healthy",
  "serverName": "chrome-devtools",
  "port": 3978,
  "uptime": 123.456
}
```

### Call Tool
```bash
POST http://localhost:{port}/tool/{toolName}
Content-Type: application/json

{"param": "value"}
```

Returns:
```json
{
  "success": true,
  "result": { /* MCP tool response */ }
}
```

## Example Workflows

### Browser Automation

```bash
# Start Chrome DevTools session
pnpm run session -- start chrome-devtools

# Navigate to a page
pnpm run session -- call chrome-devtools navigate_page '{"url":"https://example.com"}'

# Fill a form
pnpm run session -- call chrome-devtools fill '{"selector":"#email","value":"test@example.com"}'

# Click submit button
pnpm run session -- call chrome-devtools click '{"selector":"#submit-btn"}'

# Take a screenshot
pnpm run session -- call chrome-devtools take_screenshot '{"fullPage":true}'

# Check console for errors
pnpm run session -- call chrome-devtools list_console_messages '{"level":"error"}'

# Stop when done
pnpm run session -- stop chrome-devtools
```

### Database Operations

```bash
# Start database session (example with hypothetical postgres-mcp)
pnpm run session -- start postgres

# Begin transaction
pnpm run session -- call postgres query '{"sql":"BEGIN"}'

# Insert data
pnpm run session -- call postgres query '{"sql":"INSERT INTO users (name) VALUES ($1)","params":["Alice"]}'

# Commit transaction
pnpm run session -- call postgres query '{"sql":"COMMIT"}'

# Stop session
pnpm run session -- stop postgres
```

### File System Watching

```bash
# Start file watcher (example with hypothetical file-watcher-mcp)
pnpm run session -- start file-watcher

# Start watching a directory
pnpm run session -- call file-watcher watch '{"path":"./dist","recursive":true}'

# ... make code changes ...

# Check what files changed
pnpm run session -- call file-watcher get_changes '{}'

# Stop watching
pnpm run session -- stop file-watcher
```

## Troubleshooting

### Session Not Found

If you get "No active session found":
- Check `.sessions.json` exists and contains your session
- Verify the session process is still running
- Try starting a fresh session

### Port Conflicts

Sessions use ports 3978-3982. If all ports are in use:
- Stop unused sessions with `pnpm run session -- stop <server-name>`
- Check for stale processes: `lsof -i :3978`

### Stale Sessions

If `.sessions.json` references a dead process:
- Manually edit `.sessions.json` to remove the entry
- Or delete `.sessions.json` entirely (sessions will be lost)

## Notes

- Session state is stored in-memory and `.sessions.json`
- Restarting your machine will kill all sessions (remove stale entries from `.sessions.json`)
- Maximum 5 concurrent sessions (limited by port pool)
- Sessions can be accessed via HTTP directly without the CLI
