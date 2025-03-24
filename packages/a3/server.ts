import * as dotenv from 'dotenv';

import { CustomAgentGatewayServer } from './src/api/custom-agent-gateway';

// Load environment variables
dotenv.config();

// Create and start the gateway server
const defaultPort = parseInt(process.env.PORT || '3000');
let port = defaultPort;
const alternativePorts = [3001, 3002, 3003, 3004, 3005];
const moduleAddress = process.env.APTOS_MODULE_ADDRESS;
const aptosNetwork = process.env.APTOS_NETWORK || 'testnet';
const privateKey = process.env.APTOS_PRIVATE_KEY;

// Try to start the server with fallback to alternative ports if needed
function tryStart(portToTry: number, portIndex = 0) {
  // Validate that required environment variables are available
  if (!moduleAddress) {
    console.error('APTOS_MODULE_ADDRESS environment variable is required');
    process.exit(1);
  }

  if (!privateKey) {
    console.error('APTOS_PRIVATE_KEY environment variable is required');
    process.exit(1);
  }

  // Create a new server instance with the current port
  const serverInstance = new CustomAgentGatewayServer({
    port: portToTry,
    moduleAddress: moduleAddress as string,
    aptosNetwork,
    privateKey: privateKey as string
  });

  try {
    // Use a regular Node.js server to test if port is available
    const http = require('http');
    const testServer = http.createServer();
    
    testServer.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${portToTry} is already in use.`);
        testServer.close();
        
        if (portIndex < alternativePorts.length) {
          const nextPort = alternativePorts[portIndex];
          console.log(`Trying alternative port ${nextPort}...`);
          tryStart(nextPort, portIndex + 1);
        } else {
          console.error('All ports are in use. Please free up a port or specify a different port with the PORT environment variable.');
          process.exit(1);
        }
      } else {
        console.error('Server error:', err);
        process.exit(1);
      }
    });
    
    testServer.once('listening', () => {
      // Port is available, close test server and start the real one
      testServer.close(() => {
        serverInstance.start();
        console.log('Server starting on port', portToTry);
        console.log(`Note: The SDK should be configured with apiUrl: 'http://localhost:${portToTry}/api'`);
      });
    });
    
    testServer.listen(portToTry);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

tryStart(port); 