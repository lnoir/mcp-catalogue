/**
 * Check Node.js version compatibility
 *
 * Many MCP servers (especially those using mcp-remote or modern dependencies)
 * require Node.js 20+ for features like the File API and modern fetch support.
 */

const REQUIRED_NODE_VERSION = 20;

export function checkNodeVersion(): void {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);

  if (majorVersion < REQUIRED_NODE_VERSION) {
    console.error(`
❌ Error: Node.js ${REQUIRED_NODE_VERSION}+ is required

Current version: ${nodeVersion}
Required version: >= ${REQUIRED_NODE_VERSION}.0.0

Many MCP servers require Node 20+ for modern APIs (File, fetch, etc.)

Please upgrade Node.js:
  - Using nvm: nvm install 20 && nvm use 20
  - Using fnm: fnm install 20 && fnm use 20
  - Download from: https://nodejs.org/
`);
    process.exit(1);
  }
}
