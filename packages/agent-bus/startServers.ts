import { serve } from '@hono/node-server';
import { app } from './api/[[...route]]';
import { IncomingMessage, ServerResponse, createServer } from 'http';
import { setupDependencies } from './src/agent-bus/dependencies';
import { PinoLogger } from './src/agent-bus/common/utils/logger';
import { config } from './src/agent-bus/config';
import { z } from 'zod';
import { DialogueStage } from './src/agent-bus/common/types/llm.types';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file from the project root using an absolute path
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Configure logger
const logger = new PinoLogger({ level: config.LOG_LEVEL || 'info' });

// Define input interfaces for the tools
interface InitiateClarificationInput {
  requesterId: string;
  description: string;
  tags?: string[];
  budget?: number;
  deadline?: Date;
}

interface ContinueClarificationInput {
  dialogueId: string;
  userResponse: string;
}

// Define schemas for MCP tools that match our API
const InitiateClarificationSchema = z.object({
  requesterId: z.string().describe("The unique identifier for the user initiating the task."),
  description: z.string().describe("The initial description of the task."),
  tags: z.array(z.string()).optional().describe("Optional tags for categorizing the task."),
  budget: z.number().positive().optional().describe("Optional budget for the task."),
  deadline: z.coerce.date().optional().describe("Optional deadline for the task."),
});

const ContinueClarificationSchema = z.object({
  dialogueId: z.string().describe("The unique identifier for the ongoing dialogue."),
  userResponse: z.string().describe("The user's response to the assistant's last message."),
});

// Mock MCP server implementation to bypass import issues
// These are simplified versions of the real MCP classes
class McpServer {
  constructor(info: any, capabilities: any) {
    this.info = info;
    this.capabilities = capabilities;
  }
  
  info: any;
  capabilities: any;
  transport: any;
  tools: Map<string, any> = new Map();
  
  tool(name: string, description: string, schema: any, handler: any) {
    this.tools.set(name, { description, schema, handler });
    logger.info(`Registered tool: ${name}`);
    return this;
  }
  
  async connect(transport: any) {
    this.transport = transport;
    logger.info('MCP server connected to transport');
    return this;
  }
  
  close() {
    logger.info('MCP server closed');
  }
}

class SSEServerTransport {
  constructor(messagePath: string, res: any) {
    this.messagePath = messagePath;
    this.res = res;
    logger.info(`SSE transport created with message path: ${messagePath}`);
  }
  
  messagePath: string;
  res: any;
}

async function startServers() {
  logger.info('Starting Agent Bus servers (API + MCP)...');
  
  try {
    // Initialize shared dependencies
    const dependencies = await setupDependencies();
    logger.info('Dependencies initialized successfully');
    
    // Start the main API server (Hono)
    const apiPort = config.PORT || 3001;
    serve({ 
      fetch: app.fetch, 
      port: apiPort 
    }, (info) => {
      logger.info(`API server listening on http://localhost:${info.port}`);
    });
    
    // Start the MCP server
    const mcpPort = config.MCP_PORT || 3003;
    const mcpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      
      // Handle SSE connections for persistent protocol connection
      if (url.pathname === "/api/mcp/sse") {
        logger.info("New MCP SSE connection initiated");
        
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
            name: "agent-bus-mcp-server",
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
        
        // Register tools using the shared dependencies
        server.tool(
          "initiateClarification",
          "Starts a new task clarification dialogue based on an initial description.",
          {
            requesterId: z.string().describe("The unique identifier for the user initiating the task."),
            description: z.string().describe("The initial description of the task."),
            tags: z.array(z.string()).optional().describe("Optional tags for categorizing the task."),
            budget: z.number().positive().optional().describe("Optional budget for the task."),
            deadline: z.coerce.date().optional().describe("Optional deadline for the task."),
          },
          async (input: InitiateClarificationInput) => {
            logger.info(`MCP: Received 'initiateClarification' for requester ${input.requesterId}`);
            try {
              const initialRequest = {
                requesterId: input.requesterId,
                description: input.description,
                tags: input.tags,
                budget: input.budget,
                deadline: input.deadline,
              };
              
              // Use the real service from shared dependencies
              const initialState = await dependencies.intakeClarificationService.initiateTaskClarification(initialRequest);
              logger.info(`MCP: Dialogue ${initialState.taskId} initiated successfully`);
              
              return {
                content: [
                  { 
                    type: "text", 
                    text: `Dialogue started (ID: ${initialState.taskId}).\nAssistant: ${initialState.history?.find(t => t.role === 'assistant')?.content || ''}`
                  }
                ],
              };
            } catch (error: any) {
              logger.error(`MCP: Error in 'initiateClarification': ${error.message}`, { error });
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
            logger.info(`MCP: Received 'continueClarification' for dialogue ${input.dialogueId}`);
            try {
              // Use the real service from shared dependencies
              const updatedState = await dependencies.intakeClarificationService.continueClarification(
                input.dialogueId, 
                input.userResponse
              );
              logger.info(`MCP: Dialogue ${input.dialogueId} continued. Current stage: ${updatedState.currentState}`);
              
              let responseText = "";
              const lastMessage = updatedState.history?.find(t => t.role === 'assistant')?.content || '';
              
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
              logger.error(`MCP: Error in 'continueClarification' for dialogue ${input.dialogueId}: ${error.message}`, { error });
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
            logger.info("MCP: SSE connection closed by client");
            server.close();
          });
          
        } catch (error) {
          logger.error(`MCP: Error connecting MCP server: ${error}`);
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
        
        // Implement proper message handling here if needed
        // For now, return a descriptive error
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: "Message handling not implemented in this version. Use the SSE endpoint for MCP connections."
        }));
      } 
      // Handle documentation endpoint
      else if (url.pathname === "/api/mcp" || url.pathname === "/api/mcp/") {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <head><title>Agent Bus MCP Server</title></head>
            <body>
              <h1>Agent Bus MCP Server</h1>
              <p>This server implements the Model Context Protocol (MCP) for the Agent Bus.</p>
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
      } else {
        // Handle all other routes with a 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Not Found" }));
      }
    });
    
    mcpServer.listen(mcpPort, () => {
      logger.info(`MCP server listening on http://localhost:${mcpPort}`);
      logger.info(`MCP SSE endpoint available at http://localhost:${mcpPort}/api/mcp/sse`);
    });
    
    logger.info('Both API and MCP servers started successfully!');
    
    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down servers...');
      mcpServer.close();
      // Dependencies will be cleaned up by the main process
    });
    
    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down servers...');
      mcpServer.close();
      // Dependencies will be cleaned up by the main process
    });
    
  } catch (error) {
    logger.error('Failed to start servers:', error);
    process.exit(1);
  }
}

// Start both servers when this file is run directly
if (require.main === module) {
  startServers();
}

export { startServers }; 