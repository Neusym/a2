import { AptosClient } from 'aptos';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

import { AptosDiscoveryService } from '../discovery/aptos-discovery-service';
import { AptosPaymentService } from '../payment/payment-service';
import { TransactionHandler } from '../transaction/transaction-handler';

// Load environment variables
dotenv.config();

/**
 * Gateway server configuration
 */
export interface GatewayConfig {
  port: number;
  moduleAddress: string;
  aptosNetwork: string;
  privateKey: string;
}

/**
 * Agent Gateway Server
 * 
 * This server acts as a gateway for agent process requests:
 * 1. Validates payment for process execution
 * 2. Records transactions on the blockchain
 * 3. Forwards requests to the appropriate agent process
 * 4. Updates transaction status on the blockchain
 */
export class AgentGatewayServer {
  private app: express.Application;
  private port: number;
  private moduleAddress: string;
  private aptosClient: AptosClient;
  private transactionHandler: TransactionHandler;
  
  constructor(config: GatewayConfig) {
    this.port = config.port;
    this.moduleAddress = config.moduleAddress;
    
    // Initialize Express app
    this.app = express();
    this.app.use(express.json());
    this.app.use(cors());
    
    // Initialize Aptos client
    const networkUrl = this.getNetworkUrl(config.aptosNetwork);
    this.aptosClient = new AptosClient(networkUrl);
    
    // Initialize services
    const paymentService = new AptosPaymentService({
      moduleAddress: config.moduleAddress,
      aptosClient: this.aptosClient
    });
    
    const discoveryService = new AptosDiscoveryService({
      moduleAddress: config.moduleAddress,
      aptosClient: this.aptosClient
    });
    
    // Initialize transaction handler
    this.transactionHandler = new TransactionHandler({
      moduleAddress: config.moduleAddress,
      aptosClient: this.aptosClient,
      paymentService,
      discoveryService
    });
    
    // Set up routes
    this.setupRoutes();
  }
  
  /**
   * Set up API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString()
      });
    });
    
    // Process execution endpoint
    this.app.post('/api/execute/:processId', async (req, res) => {
      try {
        const { processId } = req.params;
        const { userAddress, data, workflowId, taskId, priority } = req.body;
        
        if (!userAddress) {
          return res.status(400).json({
            success: false,
            error: 'User address is required'
          });
        }
        
        // Get account from the private key (for demo purposes)
        // In production, this would be managed differently for security
        const account = this.getAccountFromPrivateKey();
        
        // Process the transaction
        const result = await this.transactionHandler.handleTransaction({
          processId,
          userAddress,
          data: data || {},
          workflowId,
          taskId,
          priority: priority || 1
        }, account);
        
        // Return response
        res.status(result.status === 'failed' ? 400 : 200).json({
          success: result.status === 'completed',
          transactionId: result.transactionId,
          processId: result.processId,
          status: result.status,
          result: result.result,
          error: result.error,
          timestamp: new Date(result.timestamp).toISOString()
        });
      } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
    
    // Make payment endpoint
    this.app.post('/api/payment', async (req, res) => {
      try {
        const { processId, amount, userAddress } = req.body;
        
        if (!processId || !amount || !userAddress) {
          return res.status(400).json({
            success: false,
            error: 'Process ID, amount, and user address are required'
          });
        }
        
        // Get account from private key
        const account = this.getAccountFromPrivateKey();
        
        // Get payment service
        const paymentService = new AptosPaymentService({
          moduleAddress: this.moduleAddress,
          aptosClient: this.aptosClient
        });
        
        // Make payment
        const txHash = await paymentService.makePayment(account, {
          processId,
          amount: parseInt(amount)
        });
        
        // Return response
        res.status(200).json({
          success: true,
          transactionHash: txHash,
          processId,
          amount,
          userAddress,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error making payment:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
    
    // Verify payment endpoint
    this.app.get('/api/payment/verify/:processId/:userAddress', async (req, res) => {
      try {
        const { processId, userAddress } = req.params;
        
        // Get payment service
        const paymentService = new AptosPaymentService({
          moduleAddress: this.moduleAddress,
          aptosClient: this.aptosClient
        });
        
        // Verify payment
        const verified = await paymentService.verifyPayment(processId, userAddress);
        
        // Return response
        res.status(200).json({
          success: true,
          verified,
          processId,
          userAddress,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
    
    // Get process endpoint
    this.app.get('/api/process/:processId', async (req, res) => {
      try {
        const { processId } = req.params;
        
        // Get discovery service
        const discoveryService = new AptosDiscoveryService({
          moduleAddress: this.moduleAddress,
          aptosClient: this.aptosClient
        });
        
        // Get process details
        const process = await discoveryService.getProcess(processId);
        
        if (!process) {
          return res.status(404).json({
            success: false,
            error: `Process ${processId} not found`
          });
        }
        
        // Return response
        res.status(200).json({
          success: true,
          process,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error getting process:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
    
    // List processes endpoint
    this.app.get('/api/processes', async (req, res) => {
      try {
        const { owner, tag, status } = req.query;
        
        // Get discovery service
        const discoveryService = new AptosDiscoveryService({
          moduleAddress: this.moduleAddress,
          aptosClient: this.aptosClient
        });
        
        // Build search options
        const searchOptions: any = {};
        if (owner) searchOptions.owner = owner as string;
        if (tag) searchOptions.tags = [tag as string];
        if (status) searchOptions.status = status as string;
        
        // List processes
        const processes = await discoveryService.listProcesses(searchOptions);
        
        // Return response
        res.status(200).json({
          success: true,
          processes,
          count: processes.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error listing processes:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  }
  
  /**
   * Start the server
   */
  public start(): void {
    this.app.listen(this.port, () => {
      console.log(`🚀 Agent Gateway Server running on port ${this.port}`);
      console.log(`📡 Connected to Aptos blockchain`);
      console.log(`📝 Module address: ${this.moduleAddress}`);
    });
  }
  
  /**
   * Get Aptos network URL
   */
  private getNetworkUrl(network: string): string {
    const networks: Record<string, string> = {
      mainnet: 'https://fullnode.mainnet.aptoslabs.com/v1',
      testnet: 'https://fullnode.testnet.aptoslabs.com/v1',
      devnet: 'https://fullnode.devnet.aptoslabs.com/v1'
    };
    
    return networks[network] || networks.testnet;
  }
  
  /**
   * Get account from private key
   * 
   * This is a placeholder for demo purposes
   * In production, account management would be done securely
   */
  protected getAccountFromPrivateKey(): any {
    // This is a placeholder - in a real implementation, you would securely
    // manage the private key and return an AptosAccount
    throw new Error('getAccountFromPrivateKey not implemented');
  }
}

/**
 * Create and start the gateway server
 */
if (require.main === module) {
  // This code only runs if the file is executed directly
  const port = parseInt(process.env.PORT || '3000');
  const moduleAddress = process.env.APTOS_MODULE_ADDRESS;
  const aptosNetwork = process.env.APTOS_NETWORK || 'testnet';
  const privateKey = process.env.APTOS_PRIVATE_KEY;
  
  if (!moduleAddress) {
    console.error('APTOS_MODULE_ADDRESS environment variable is required');
    process.exit(1);
  }
  
  if (!privateKey) {
    console.error('APTOS_PRIVATE_KEY environment variable is required');
    process.exit(1);
  }
  
  const server = new AgentGatewayServer({
    port,
    moduleAddress,
    aptosNetwork,
    privateKey
  });
  
  server.start();
} 