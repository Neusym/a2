import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

// Default to localhost for development, override with command line argument
const defaultOrigin = "http://localhost:3000"; // Assuming local dev server runs on 3000
const origin = process.argv[2] || defaultOrigin;
// Construct the SSE URL based on the new path
// Assuming the Vercel rewrite maps /api/mcp/sse to the function
const sseUrl = new URL(`/api/mcp/sse`, origin); // <-- Updated path based on potential rewrite

async function main() {
  console.log(`Connecting to MCP server at ${sseUrl.toString()}...`);
  
  try {
    const transport = new SSEClientTransport(sseUrl);

    const client = new Client(
      {
        name: "task-clarification-test-client",
        version: "1.0.0",
      },
      {
        capabilities: {
          prompts: {},
          resources: {},
          tools: {},
        },
      }
    );

    await client.connect(transport);
    console.log("Connected to MCP server");
    console.log("Server capabilities:", client.getServerCapabilities());

    // List available tools
    const tools = await client.listTools();
    console.log("\nAvailable tools:", tools);

    // Test the initiateClarification tool
    console.log("\n--- Testing initiateClarification ---");
    const initResult = await client.tool("initiateClarification", {
      requesterId: "test-user-1",
      taskDescription: "Create a login page with React and validation"
    });
    console.log("Response:", initResult);

    // Extract the dialogue ID from the response
    // This assumes the response includes text like "Dialogue started (ID: dialog-123)"
    const dialogueIdMatch = initResult.content?.[0]?.text?.match(/Dialogue started \(ID: ([^)]+)\)/);
    const dialogueId = dialogueIdMatch ? dialogueIdMatch[1] : null;

    if (dialogueId) {
      // Test the continueClarification tool
      console.log("\n--- Testing continueClarification ---");
      const continueResult = await client.tool("continueClarification", {
        dialogueId,
        userResponse: "I need this ASAP, it's an urgent task for a client demo tomorrow."
      });
      console.log("Response:", continueResult);

      // Continue the dialogue again if it hasn't completed
      if (!continueResult.content?.[0]?.text?.includes("Dialogue completed")) {
        console.log("\n--- Continuing dialogue ---");
        const finalResult = await client.tool("continueClarification", {
          dialogueId,
          userResponse: "Please use Material UI components and implement form validation with Formik."
        });
        console.log("Response:", finalResult);
      }
    } else {
      console.error("Could not extract dialogue ID from response");
    }

    // Close the connection when done
    await client.close();
    console.log("\nTest completed and connection closed");
    
  } catch (error) {
    console.error("Error during MCP test:", error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Unhandled error:", err);
  process.exit(1);
}); 