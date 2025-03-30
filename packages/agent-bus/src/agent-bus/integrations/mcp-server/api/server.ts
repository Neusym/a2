import 'dotenv/config';
import { z } from "zod";
import { IncomingMessage, ServerResponse } from "http";

// Use dynamic import for MCP SDK
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');

// Type definitions - Since imports are having issues, define minimal versions here
interface InitialTaskRequest {
  requesterId: string;
  taskDescription: string;
}

interface DialogueTurn {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
}

interface DialogueState {
  taskId?: string;
  requesterId?: string;
  currentState: DialogueStage;
  history: DialogueTurn[];
  extractedParams?: any;
}

enum DialogueStage {
  INITIAL = "INITIAL",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED"
}

// Simplified logger implementation
const logger = {
  info: (message: string, meta?: any) => console.log(`[INFO] ${message}`, meta || ''),
  error: (message: string, meta?: any) => console.error(`[ERROR] ${message}`, meta || ''),
  child: () => logger
};

// Mock implementation of the IntakeClarificationService for demonstration
class MockIntakeClarificationService {
  async initiateTaskClarification(initialRequest: InitialTaskRequest): Promise<DialogueState> {
    logger.info(`Initiating task clarification for requester: ${initialRequest.requesterId}`);

    // In a real implementation, this would call your DialogueManager and other services
    return {
      taskId: `task-${Date.now()}`,
      requesterId: initialRequest.requesterId,
      currentState: DialogueStage.IN_PROGRESS,
      history: [
        {
          role: 'assistant',
          content: `Thanks for your task: "${initialRequest.taskDescription}". Could you provide more details about the timeline and requirements?`,
          timestamp: new Date(),
        },
      ],
    };
  }

  async continueClarification(dialogueId: string, userResponse: string): Promise<DialogueState> {
    logger.info(`Continuing clarification for dialogue: ${dialogueId}`);

    // In a real implementation, this would process the response through LLMs and DialogueManager
    if (userResponse.toLowerCase().includes("urgent") || userResponse.toLowerCase().includes("asap")) {
      return {
        taskId: dialogueId,
        currentState: DialogueStage.COMPLETED,
        history: [
          {
            role: 'assistant',
            content: "I understand this is urgent. I've created a high-priority task based on your requirements.",
            timestamp: new Date(),
          },
        ],
        extractedParams: {
          priority: "high",
          timeline: "urgent",
          description: userResponse
        }
      };
    }

    return {
      taskId: dialogueId,
      currentState: DialogueStage.IN_PROGRESS,
      history: [
        {
          role: 'user',
          content: userResponse,
          timestamp: new Date(),
        },
        {
          role: 'assistant',
          content: "Thank you for those details. Do you have any specific technologies or frameworks that should be used?",
          timestamp: new Date(),
        },
      ],
    };
  }
}

// Create mock service
const intakeService = new MockIntakeClarificationService();

// --- Tool Schemas ---
const InitiateClarificationSchema = z.object({
  requesterId: z.string().describe("The unique identifier for the user initiating the task."),
  taskDescription: z.string().describe("The initial, potentially vague, description of the task."),
});

const ContinueClarificationSchema = z.object({
  dialogueId: z.string().describe("The unique identifier for the ongoing dialogue."),
  userResponse: z.string().describe("The user's response to the assistant's last message."),
});

// Define tool input interfaces
interface InitiateClarificationInput {
  requesterId: string;
  taskDescription: string;
}

interface ContinueClarificationInput {
  dialogueId: string;
  userResponse: string;
}

// --- MCP Handler Function ---
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || "", `http://${req.headers.host || 'localhost'}`);

  // Handle SSE connections for persistent protocol connection
  if (url.pathname === "/api/mcp/sse") {
    logger.info("New SSE connection initiated");

    // Setup SSE response headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Create transport and server
    const transport = new SSEServerTransport("/api/mcp/message", res);
    const server = new McpServer(
      {
        name: "task-clarification-mcp-server",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {
            initiateClarification: {
              description: "Starts a new task clarification dialogue based on an initial description.",
            },
            continueClarification: {
              description: "Continues an existing task clarification dialogue by providing the user's response.",
            },
          }
        }
      }
    );

    // Register tools
    server.tool(
      "initiateClarification",
      "Starts a new task clarification dialogue based on an initial description.",
      {
        requesterId: z.string().describe("The unique identifier for the user initiating the task."),
        taskDescription: z.string().describe("The initial, potentially vague, description of the task."),
      },
      async (input: InitiateClarificationInput) => {
        logger.info(`Received 'initiateClarification' for requester ${input.requesterId}`);
        try {
          const initialRequest: InitialTaskRequest = {
            requesterId: input.requesterId,
            taskDescription: input.taskDescription,
          };

          const initialState = await intakeService.initiateTaskClarification(initialRequest);
          logger.info(`Dialogue ${initialState.taskId} initiated. First response: ${initialState.history[0]?.content || ''}`);

          return {
            content: [
              { 
                type: "text", 
                text: `Dialogue started (ID: ${initialState.taskId}).\nAssistant: ${initialState.history[0]?.content || ''}`
              }
            ],
          };
        } catch (error: any) {
          logger.error(`Error in 'initiateClarification': ${error.message}`, { error });
          return {
            content: [{ 
              type: "error", 
              error: { message: `Failed to initiate clarification: ${error.message}` } 
            }]
          };
        }
      }
    );

    server.tool(
      "continueClarification",
      "Continues an existing task clarification dialogue by providing the user's response.",
      {
        dialogueId: z.string().describe("The unique identifier for the ongoing dialogue."),
        userResponse: z.string().describe("The user's response to the assistant's last message."),
      },
      async (input: ContinueClarificationInput) => {
        logger.info(`Received 'continueClarification' for dialogue ${input.dialogueId}`);
        try {
          const updatedState = await intakeService.continueClarification(input.dialogueId, input.userResponse);
          logger.info(`Dialogue ${input.dialogueId} continued. Current stage: ${updatedState.currentState}`);

          let responseText = "";
          const lastMessage = updatedState.history.length > 0 ? updatedState.history[updatedState.history.length - 1]?.content : '';
          
          if (updatedState.currentState === DialogueStage.COMPLETED) {
            responseText = `Dialogue completed (ID: ${input.dialogueId}). Task finalization initiated.\nAssistant: ${lastMessage || 'Thank you!'}`;
          } else if (updatedState.currentState === DialogueStage.FAILED) {
            responseText = `Dialogue failed (ID: ${input.dialogueId}).\nReason: ${lastMessage || 'An error occurred during clarification.'}`;
            return {
              content: [{ 
                type: "error", 
                error: { message: responseText } 
              }]
            };
          } else {
            responseText = `Dialogue continuing (ID: ${input.dialogueId}).\nAssistant: ${lastMessage || ''}`;
          }

          return {
            content: [
              { type: "text", text: responseText }
            ],
          };
        } catch (error: any) {
          logger.error(`Error in 'continueClarification' for dialogue ${input.dialogueId}: ${error.message}`, { error });
          return {
            content: [{ 
              type: "error", 
              error: { message: `Failed to continue clarification: ${error.message}` } 
            }]
          };
        }
      }
    );

    // Connect server to transport
    try {
      await server.connect(transport);
      
      // Keep the connection alive until client disconnects
      req.on("close", () => {
        logger.info("SSE connection closed by client");
        server.close();
      });
      
    } catch (error) {
      logger.error(`Error connecting MCP server: ${error}`);
      res.end();
    }
    
  } 
  // Handle message endpoints (where clients send requests)
  else if (url.pathname === "/api/mcp/message") {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method Not Allowed');
      return;
    }
    
    // In a real implementation, this would use your Redis-based message handling
    // For now, return a simple error to guide clients
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: "This is a simplified MCP implementation. Please use a full implementation with Redis for production."
    }));
  } 
  // Handle documentation endpoint
  else if (url.pathname === "/api/mcp" || url.pathname === "/api/mcp/") {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <head><title>Task Clarification MCP Server</title></head>
        <body>
          <h1>Task Clarification MCP Server</h1>
          <p>This server implements the Model Context Protocol (MCP) for task clarification.</p>
          <p>Endpoints:</p>
          <ul>
            <li><code>/api/mcp/sse</code> - SSE endpoint for MCP connections</li>
            <li><code>/api/mcp/message</code> - Message endpoint for MCP requests</li>
          </ul>
          <p>Available tools:</p>
          <ul>
            <li><code>initiateClarification</code> - Start a new task clarification dialogue</li>
            <li><code>continueClarification</code> - Continue an existing dialogue</li>
          </ul>
        </body>
      </html>
    `);
  } 
  // Handle 404
  else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
} 

// Only run the server directly when this file is executed directly (not imported)
if (require.main === module) {
  const http = require('http');
  const PORT = process.env.MCP_PORT || 3005;
  
  // Create the HTTP server
  const server = http.createServer(handler);
  
  // Start listening
  server.listen(PORT, () => {
    console.log(`MCP Server listening on port ${PORT}`);
    console.log(`Documentation: http://localhost:${PORT}/api/mcp/`);
    console.log(`SSE endpoint: http://localhost:${PORT}/api/mcp/sse`);
  });
  
  // Handle shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down MCP server...');
    server.close(() => {
      console.log('MCP Server shutdown complete.');
      process.exit(0);
    });
  });
} 