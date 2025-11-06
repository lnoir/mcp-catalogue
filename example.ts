/**
 * Example usage of Progressive MCP Discovery
 *
 * This demonstrates how to use the MCP tools programmatically
 * without loading all tools into context.
 */

import { initializeServer, closeAllServers } from './mcp-client.js';
import { getAiNotes, createSession, sessionAddEntry } from './servers/coretx/index.js';
import { getDesignContext } from './servers/figma/index.js';
import { takeSnapshot, navigatePage } from './servers/chrome-devtools/index.js';
import { resolveLibraryId, getLibraryDocs } from './servers/context7/index.js';
import { getCollections, createWorkspace } from './servers/postman/index.js';
import serverConfig from './servers.json' with { type: 'json' };

async function exampleCoretxUsage() {
  console.log('=== Coretx Example ===\n');

  // Initialize the Coretx server
  await initializeServer('coretx', serverConfig.coretx);

  // Create a new session
  const session = await createSession({
    title: 'Progressive MCP Discovery Example',
    category: 'development',
  });
  console.log('Created session:', session);

  // Add an entry to the session
  await sessionAddEntry({
    content: 'Implemented progressive MCP tool discovery system',
    category: 'milestone',
    tags: 'mcp,typescript,progressive-discovery',
  });

  // Get AI notes (with proper typed parameters)
  const notes = await getAiNotes({
    category: '',        // Empty string for all categories
    tags: '',            // Empty string for all tags
    limit: 5,
    offset: 0,
  });
  console.log('Retrieved notes:', notes);
}

async function exampleFigmaUsage() {
  console.log('\n=== Figma Example ===\n');

  // Initialize the Figma server
  await initializeServer('figma', serverConfig.figma);

  // Get design context for the currently selected node
  const designContext = await getDesignContext({
    clientLanguages: 'typescript',
    clientFrameworks: 'react',
  });
  console.log('Design context:', designContext);
}

async function exampleChromeDevToolsUsage() {
  console.log('\n=== Chrome DevTools Example ===\n');

  // Initialize the Chrome DevTools server
  await initializeServer('chrome-devtools', serverConfig['chrome-devtools']);

  // Navigate to a URL
  await navigatePage({
    type: 'url',
    url: 'https://example.com',
  });

  // Take a snapshot of the page
  const snapshot = await takeSnapshot({
    verbose: false,
  });
  console.log('Page snapshot:', snapshot);
}

async function exampleContext7Usage() {
  console.log('\n=== Context7 Example ===\n');

  // Initialize the Context7 server
  await initializeServer('context7', serverConfig.context7);

  // Resolve a library ID
  const librarySearch = await resolveLibraryId({
    libraryName: 'react',
  });
  console.log('Library search results:', librarySearch);

  // Get documentation for React hooks
  const docs = await getLibraryDocs({
    context7CompatibleLibraryID: '/facebook/react',
    topic: 'hooks',
    tokens: 3000,
  });
  console.log('React hooks documentation:', docs);
}

async function examplePostmanUsage() {
  console.log('\n=== Postman Example ===\n');

  // Initialize the Postman server
  await initializeServer('postman', serverConfig.postman);

  // Get collections in a workspace (replace with your workspace ID)
  const collections = await getCollections({
    workspace: 'YOUR_WORKSPACE_ID',
    limit: 10,
  });
  console.log('Collections:', collections);

  // Create a new workspace
  const newWorkspace = await createWorkspace({
    workspace: {
      name: 'Progressive MCP Discovery',
      type: 'personal',
      description: 'Testing Postman MCP server',
    },
  });
  console.log('Created workspace:', newWorkspace);
}

async function main() {
  try {
    // Run examples
    // Note: Uncomment the examples you want to run
    // Make sure the respective servers are configured and running

    // await exampleCoretxUsage();
    // await exampleFigmaUsage();
    // await exampleChromeDevToolsUsage();
    // await exampleContext7Usage();
    // await examplePostmanUsage();

    console.log('\n✓ All examples completed successfully\n');
  } catch (error) {
    console.error('Error running examples:', error);
  } finally {
    // Always cleanup
    await closeAllServers();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
