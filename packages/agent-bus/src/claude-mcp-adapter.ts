#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from "axios";
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file in the project directory
let envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  console.error(`Loading environment from ${envPath}`);
  dotenv.config({ path: envPath });
} else {
  console.error(`Warning: .env file not found at ${envPath}`);
  // Try current directory as fallback
  envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    console.error(`Loading environment from ${envPath}`);
    dotenv.config({ path: envPath });
  } else {
    console.error(`Warning: .env file not found at ${envPath} either`);
  }
}

// Configuration
const API_PORT = process.env.PORT || 3004;
const API_BASE_URL = `http://localhost:${API_PORT}/api`;

console.error(`Starting Claude MCP adapter for agent-bus`);
console.error(`API endpoint: ${API_BASE_URL}`);

// Create MCP server
const server = new McpServer(
  {
    name: "agent-bus-mcp-adapter",
    version: "1.0.0",
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

// Register the initiateClarification tool
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
  async (input, extra) => {
    console.error(`Received initiateClarification request for requester ${input.requesterId}`);
    try {
      // Forward the request to the agent-bus API
      const response = await axios.post(`${API_BASE_URL}/dialogue/start`, {
        requesterId: input.requesterId,
        description: input.description,
        tags: input.tags,
        budget: input.budget,
        deadline: input.deadline,
      });
      
      const taskState = response.data;
      console.error(`Dialogue initiated with ID: ${taskState.taskId}`);
      
      // Get the assistant's first message
      const assistantMessage = taskState.history?.find((msg: any) => msg.role === 'assistant')?.content || '';
      
      // Return ONLY the assistant's message as the content
      return {
        content: [
          { 
            type: "text", 
            text: assistantMessage // Send only the message from the agent-bus
          }
        ],
      };
    } catch (error: any) {
      console.error(`Error in initiateClarification:`, error.message);
      // Return a standard text response with error info instead of an error type
      return {
        content: [{ 
          type: "text", 
          text: `Failed to initiate clarification: ${error.message}`
        }],
        isError: true,
      };
    }
  }
);

// Register the continueClarification tool
server.tool(
  "continueClarification",
  "Continues an existing task clarification dialogue by providing the user's response.",
  {
    dialogueId: z.string().describe("The unique identifier for the ongoing dialogue."),
    userResponse: z.string().describe("The user's response to the assistant's last message."),
  },
  async (input, extra) => {
    console.error(`Received continueClarification request for dialogue ${input.dialogueId}`);
    try {
      // Forward the request to the agent-bus API
      const response = await axios.post(`${API_BASE_URL}/dialogue/${input.dialogueId}/continue`, {
        userResponse: input.userResponse,
      });
      
      const updatedState = response.data;
      console.error(`Dialogue continued. Current state: ${updatedState.currentState}`);
      
      // Get the assistant's response
      const assistantMessage = updatedState.history?.find((msg: any) => msg.role === 'assistant')?.content || '';
      
      // Format the response based on the dialogue state
      let responseText = '';
      if (updatedState.currentState === 'COMPLETED') {
        responseText = `Dialogue completed (ID: ${input.dialogueId}). Task finalization initiated.\nAssistant: ${assistantMessage || 'Thank you!'}`;
      } else if (updatedState.currentState === 'FAILED') {
        responseText = `Dialogue failed (ID: ${input.dialogueId}).\nReason: ${assistantMessage || 'An error occurred during clarification.'}`;
        return {
          content: [{ 
            type: "text", 
            text: responseText
          }],
          isError: true,
        };
      } else {
        responseText = `Dialogue continuing (ID: ${input.dialogueId}).\nAssistant: ${assistantMessage || ''}`;
      }
      
      return {
        content: [
          { type: "text", text: responseText }
        ],
      };
    } catch (error: any) {
      console.error(`Error in continueClarification:`, error.message);
      return {
        content: [{ 
          type: "text", 
          text: `Failed to continue clarification: ${error.message}`
        }],
        isError: true,
      };
    }
  }
);

// Start the MCP server with stdio transport
async function main() {
  console.error("Starting MCP server with stdio transport...");
  const transport = new StdioServerTransport();
  
  try {
    await server.connect(transport);
    console.error("MCP server connected successfully");
  } catch (error) {
    console.error("Error connecting MCP server:", error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error("Fatal error in MCP server:", error);
  process.exit(1);
}); 