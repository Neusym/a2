# MCP Server Integration for Task Clarification

This integration implements the [Model Context Protocol (MCP)](https://modelcontextprotocol.ai/) server that allows MCP-compatible clients (like Cursor IDE) to communicate with the task clarification service.

## What is MCP?

The Model Context Protocol (MCP) lets you build servers that expose data and functionality to LLM applications in a secure, standardized way. Think of it like a web API, but specifically designed for LLM interactions. This integration allows MCP clients to:

- Start a task clarification dialogue (`initiateClarification` tool)
- Continue a dialogue with follow-up messages (`continueClarification` tool)

## Quick Start

### Installation

1. Install dependencies:
   ```bash
   cd src/agent-bus/integrations/mcp-server
   pnpm install
   ```

2. Set up environment variables (create a `.env` file or set in your environment):
   ```
   REDIS_URL=redis://your-redis-instance
   ```

3. Run the server (development mode):
   ```bash
   pnpm dev
   ```

### Testing

Use the included test client to interact with the MCP server:

```bash
cd src/agent-bus/integrations/mcp-server
pnpm test-client http://localhost:3000
```

## Implementation Details

### Components

- **`api/server.ts`**: Main MCP server implementation with task clarification tools
- **`lib/mcp-api-handler.ts`**: Helper functions for the Vercel serverless environment
- **`scripts/test-client.mjs`**: Test client for interacting with the MCP server

### MCP Tools

1. **`initiateClarification`**
   - **Purpose**: Start a new task clarification dialogue
   - **Parameters**:
     - `requesterId`: Unique ID for the user initiating the task
     - `taskDescription`: Initial task description
   - **Returns**: Initial assistant response with dialogue ID

2. **`continueClarification`**
   - **Purpose**: Continue an existing dialogue
   - **Parameters**:
     - `dialogueId`: ID of the ongoing dialogue (obtained from initiateClarification)
     - `userResponse`: User's response to the assistant's last message
   - **Returns**: Next assistant response or completion message

### API Endpoints

- **`/api/mcp/sse`**: Server-Sent Events endpoint for MCP connections
- **`/api/mcp/message`**: Endpoint for receiving messages from MCP clients
- **`/api/mcp/`**: Simple documentation page

## Integration Structure

1. **MCP Server Layer**: Handles MCP protocol communication with clients
2. **Core Logic Layer**: Interfaces with the main task clarification service
3. **Storage Layer**: Uses Redis for state management in the serverless environment

## Production Deployment

For deploying to production on Vercel:

1. Ensure you have a Redis instance accessible from your deployment
2. Set `REDIS_URL` in your Vercel project environment variables
3. Configure `vercel.json` with appropriate function settings
4. Deploy your project

For improved performance on Vercel Pro/Enterprise accounts:
- Enable [Fluid Compute](https://vercel.com/docs/functions/fluid-compute)
- Increase `maxDuration` in `vercel.json` up to 800 seconds

## Extending

To add more functionality to the MCP server:

1. Implement new methods in the task clarification service
2. Add corresponding tools in `api/server.ts` using `server.tool()`
3. Update the capabilities object to document your new tools
4. Test with the test client or MCP-compatible applications 