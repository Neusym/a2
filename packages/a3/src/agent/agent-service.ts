import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
dotenv.config();

/**
 * Agent service configuration
 */
export interface AgentServiceConfig {
  port: number;
  processId: string;
  processName: string;
  workflowHandlers: Record<string, WorkflowHandler>;
  onRequest?: (request: AgentRequest) => Promise<void>;
  onRequestComplete?: (request: AgentRequest, response: AgentResponse) => Promise<void>;
}

/**
 * Agent request interface
 */
export interface AgentRequest {
  transactionId: string;
  processId: string;
  userAddress: string;
  data: Record<string, any>;
  workflowId?: string;
  taskId?: string;
  priority?: number;
}

/**
 * Agent response interface
 */
export interface AgentResponse {
  success: boolean;
  result?: any;
  error?: string;
  executionTime?: number;
  logs?: string[];
}

/**
 * Workflow handler type
 */
export type WorkflowHandler = (request: AgentRequest) => Promise<AgentResponse>;

/**
 * Agent Service
 * 
 * This service handles incoming requests for agent processes:
 * 1. Receives requests from the gateway
 * 2. Routes them to the appropriate workflow handler
 * 3. Returns the results to the gateway
 */
export class AgentService {
  private app: express.Application;
  private port: number;
  private processId: string;
  private processName: string;
  private workflowHandlers: Record<string, WorkflowHandler>;
  private onRequest?: (request: AgentRequest) => Promise<void>;
  private onRequestComplete?: (request: AgentRequest, response: AgentResponse) => Promise<void>;
  private logs: Map<string, string[]> = new Map();
  
  constructor(config: AgentServiceConfig) {
    this.port = config.port;
    this.processId = config.processId;
    this.processName = config.processName;
    this.workflowHandlers = config.workflowHandlers;
    this.onRequest = config.onRequest;
    this.onRequestComplete = config.onRequestComplete;
    
    // Initialize Express app
    this.app = express();
    this.app.use(express.json());
    this.app.use(cors());
    
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
        process: {
          id: this.processId,
          name: this.processName
        },
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      });
    });
    
    // Process info
    this.app.get('/info', (req, res) => {
      const workflowIds = Object.keys(this.workflowHandlers);
      
      res.status(200).json({
        process: {
          id: this.processId,
          name: this.processName
        },
        workflows: workflowIds,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    });
    
    // Execute process
    this.app.post('/execute', async (req, res) => {
      try {
        const request: AgentRequest = req.body;
        
        // Validate request
        if (!request.transactionId || !request.processId || !request.userAddress) {
          return res.status(400).json({
            success: false,
            error: 'Invalid request: missing required fields'
          });
        }
        
        // Validate process ID
        if (request.processId !== this.processId) {
          return res.status(400).json({
            success: false,
            error: `Incorrect process ID: expected ${this.processId}, got ${request.processId}`
          });
        }
        
        // Initialize logs for this request
        this.logs.set(request.transactionId, []);
        
        // Call onRequest callback if provided
        if (this.onRequest) {
          await this.onRequest(request);
        }
        
        // Log request receipt
        this.log(request.transactionId, `Received request: ${JSON.stringify(request)}`);
        
        // Start timing execution
        const startTime = Date.now();
        
        // Determine which workflow handler to use
        let handler: WorkflowHandler;
        
        if (request.workflowId && this.workflowHandlers[request.workflowId]) {
          handler = this.workflowHandlers[request.workflowId];
          this.log(request.transactionId, `Using handler for workflow: ${request.workflowId}`);
        } else if (this.workflowHandlers['default']) {
          handler = this.workflowHandlers['default'];
          this.log(request.transactionId, `Using default workflow handler`);
        } else {
          this.log(request.transactionId, `No handler found for workflow: ${request.workflowId}`);
          return res.status(400).json({
            success: false,
            error: `No handler available for workflow: ${request.workflowId || 'undefined'}`
          });
        }
        
        // Process the request
        let response: AgentResponse;
        try {
          response = await handler(request);
          response.executionTime = Date.now() - startTime;
          response.logs = this.logs.get(request.transactionId) || [];
          
          this.log(request.transactionId, `Request processed successfully`);
        } catch (error) {
          this.log(request.transactionId, `Error processing request: ${error instanceof Error ? error.message : 'Unknown error'}`);
          
          response = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error during processing',
            executionTime: Date.now() - startTime,
            logs: this.logs.get(request.transactionId) || []
          };
        }
        
        // Call onRequestComplete callback if provided
        if (this.onRequestComplete) {
          await this.onRequestComplete(request, response);
        }
        
        // Clean up logs
        this.logs.delete(request.transactionId);
        
        // Return response
        res.status(response.success ? 200 : 400).json(response);
      } catch (error) {
        console.error('Error in request handler:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error in request handling'
        });
      }
    });
    
    // Transaction logs endpoint
    this.app.get('/logs/:transactionId', (req, res) => {
      const { transactionId } = req.params;
      const logs = this.logs.get(transactionId) || [];
      
      res.status(200).json({
        transactionId,
        logs,
        timestamp: new Date().toISOString()
      });
    });
  }
  
  /**
   * Start the service
   */
  public start(): void {
    this.app.listen(this.port, () => {
      console.log(`🚀 Agent Service running on port ${this.port}`);
      console.log(`📦 Process: ${this.processName} (${this.processId})`);
      console.log(`🧩 Available workflows: ${Object.keys(this.workflowHandlers).join(', ')}`);
    });
  }
  
  /**
   * Add a log entry for a transaction
   */
  private log(transactionId: string, message: string): void {
    const logs = this.logs.get(transactionId) || [];
    logs.push(`[${new Date().toISOString()}] ${message}`);
    this.logs.set(transactionId, logs);
  }
  
  /**
   * Create a default agent service
   */
  public static createDefaultService(config: {
    port: number;
    processId: string;
    processName: string;
    handler: (request: AgentRequest) => Promise<any>;
  }): AgentService {
    // Create a default workflow handler
    const defaultHandler: WorkflowHandler = async (request: AgentRequest): Promise<AgentResponse> => {
      try {
        const result = await config.handler(request);
        return {
          success: true,
          result
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    };
    
    // Create and return the service
    return new AgentService({
      port: config.port,
      processId: config.processId,
      processName: config.processName,
      workflowHandlers: {
        default: defaultHandler
      }
    });
  }
}

/**
 * Create and start a default agent service
 */
if (require.main === module) {
  // This code only runs if the file is executed directly
  const port = parseInt(process.env.PORT || '3001');
  const processId = process.env.PROCESS_ID || uuidv4();
  const processName = process.env.PROCESS_NAME || 'Default Agent Process';
  
  // Create a simple echo handler
  const echoHandler = async (request: AgentRequest): Promise<any> => {
    return {
      message: 'Echo response',
      receivedData: request.data,
      timestamp: new Date().toISOString()
    };
  };
  
  // Create and start the service
  const service = AgentService.createDefaultService({
    port,
    processId,
    processName,
    handler: echoHandler
  });
  
  service.start();
} 