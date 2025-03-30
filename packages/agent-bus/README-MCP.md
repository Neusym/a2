# Agent Bus with MCP Integration

This guide explains how to run the Agent Bus with both standard REST API and Model Context Protocol (MCP) server support. This configuration allows clients to connect to Agent Bus using either direct API calls or through the MCP protocol.

## What is MCP?

The Model Context Protocol (MCP) is a communication protocol designed for AI agents and tools to interact efficiently. It provides a structured way for clients (like Cursor IDE) to discover and use the capabilities of AI services.

## Running Both Servers

We've set up the system to run both standard REST API and MCP servers simultaneously, allowing clients to choose their preferred connection method.

### Prerequisites

1. Make sure you have all required environment variables set up (see `.env.example`)
2. Ensure you have proper access to all required third-party services:
   - Neon PostgreSQL database
   - Upstash Redis
   - Upstash QStash
   - Pinecone Vector Database
   - Vercel Blob Storage

### Configuration Options

```
PORT=3001       # Regular API server port
MCP_PORT=3002   # MCP server port
```

You can customize these ports in your `.env` file.

### Starting In Development Mode

To start both servers in development mode:

```bash
pnpm dev:all
```

This will start:
1. The regular REST API server at `http://localhost:3001/api/*`
2. The MCP server at `http://localhost:3002/api/mcp/*`

### Starting In Production Mode

For production, first build the TypeScript files:

```bash
pnpm build
```

Then start both servers:

```bash
pnpm start:all
```

### MCP Endpoints

The MCP server exposes the following endpoints:

- **SSE Connection Endpoint**: `http://localhost:3002/api/mcp/sse`  
  This is the main entry point for MCP clients to establish a Server-Sent Events (SSE) connection.

- **Message Endpoint**: `http://localhost:3002/api/mcp/message`  
  Used by MCP clients to send messages to the server.

- **Documentation**: `http://localhost:3002/api/mcp/`  
  Provides a simple HTML page with information about the MCP server.

### Available MCP Tools

The MCP server exposes the following tools:

1. `initiateClarification`: Starts a new task clarification dialogue
   - Parameters:
     - `requesterId`: The ID of the requester
     - `description`: The task description
     - `tags`: (optional) Array of tags for categorizing the task
     - `budget`: (optional) Budget for the task
     - `deadline`: (optional) Deadline for the task

2. `continueClarification`: Continues an existing dialogue
   - Parameters:
     - `dialogueId`: The ID of the dialogue to continue
     - `userResponse`: The user's response to the assistant's last message

## Architecture

This integration uses a shared dependency container to ensure both the REST API and MCP servers use the same underlying services and state. This means:

- Both servers share the same database connections
- The state is synchronized between both interfaces
- Business logic is reused across both servers

## Troubleshooting

If you encounter issues:

1. Check the logs for both servers
2. Verify all environment variables are correctly set
3. Ensure all third-party services are accessible

For further assistance, please contact the development team. 