import { AptosClient, AptosAccount, Types } from 'aptos';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

import { ProcessDiscoveryService } from '../discovery/process-discovery-service';
import { PaymentService } from '../payment/payment-service';

/**
 * Transaction request interface
 */
export interface TransactionRequest {
  processId: string;
  userAddress: string;
  data: Record<string, any>;
  workflowId?: string;
  taskId?: string;
  priority?: number;
}

/**
 * Transaction response interface
 */
export interface TransactionResponse {
  transactionId: string;
  processId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  timestamp: number;
}

/**
 * Transaction handler configuration
 */
export interface TransactionHandlerConfig {
  moduleAddress: string;
  aptosClient: AptosClient;
  paymentService: PaymentService;
  discoveryService: ProcessDiscoveryService;
}

/**
 * Transaction Handler 
 * 
 * Handles transaction requests and forwards them to agent processes.
 * Key responsibilities:
 * 1. Verify payment status for the requested process
 * 2. Register the transaction on the blockchain
 * 3. Forward the request to the agent process
 * 4. Update the transaction status on the blockchain
 */
export class TransactionHandler {
  private moduleAddress: string;
  private aptosClient: AptosClient;
  private paymentService: PaymentService;
  private discoveryService: ProcessDiscoveryService;
  
  constructor(config: TransactionHandlerConfig) {
    this.moduleAddress = config.moduleAddress;
    this.aptosClient = config.aptosClient;
    this.paymentService = config.paymentService;
    this.discoveryService = config.discoveryService;
  }
  
  /**
   * Handle a transaction request
   * 
   * @param request - Transaction request
   * @param account - Account to use for blockchain transactions
   * @returns Transaction response
   */
  public async handleTransaction(request: TransactionRequest, account: AptosAccount): Promise<TransactionResponse> {
    try {
      // Generate transaction ID
      const transactionId = uuidv4();
      
      // Create initial response
      const response: TransactionResponse = {
        transactionId,
        processId: request.processId,
        status: 'pending',
        timestamp: Date.now()
      };
      
      // Get process details
      const process = await this.discoveryService.getProcess(request.processId);
      if (!process) {
        response.status = 'failed';
        response.error = `Process not found: ${request.processId}`;
        return response;
      }
      
      // Verify payment if required
      if (process.pricing && process.pricing.requiresPrepayment) {
        const paymentVerified = await this.paymentService.verifyPayment(
          request.processId,
          request.userAddress
        );
        
        if (!paymentVerified) {
          response.status = 'failed';
          response.error = 'Payment required but not verified';
          return response;
        }
      }
      
      // Register transaction on blockchain
      await this.registerTransactionOnChain(account, {
        transactionId,
        processId: request.processId,
        userAddress: request.userAddress,
        workflowId: request.workflowId || '',
        taskId: request.taskId || '',
        status: 'pending'
      });
      
      // Update status to processing
      response.status = 'processing';
      await this.updateTransactionStatus(account, transactionId, 'processing');
      
      // Forward request to agent process
      try {
        const agentResponse = await this.forwardRequestToAgent(process.url, {
          transactionId,
          processId: request.processId,
          userAddress: request.userAddress,
          data: request.data,
          workflowId: request.workflowId,
          taskId: request.taskId,
          priority: request.priority || 1
        });
        
        // Update response with agent results
        response.status = 'completed';
        response.result = agentResponse.data;
        response.timestamp = Date.now();
        
        // Update transaction status on blockchain
        await this.updateTransactionStatus(account, transactionId, 'completed', agentResponse.data);
      } catch (error) {
        // Update response with error
        response.status = 'failed';
        response.error = error instanceof Error ? error.message : 'Unknown error during agent processing';
        response.timestamp = Date.now();
        
        // Update transaction status on blockchain
        await this.updateTransactionStatus(account, transactionId, 'failed', null, response.error);
      }
      
      return response;
    } catch (error) {
      // Handle unexpected errors
      return {
        transactionId: uuidv4(),
        processId: request.processId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error in transaction handling',
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Register a transaction on the blockchain
   * 
   * @param account - Account to use for the transaction
   * @param transaction - Transaction data
   */
  private async registerTransactionOnChain(
    account: AptosAccount,
    transaction: {
      transactionId: string;
      processId: string;
      userAddress: string;
      workflowId: string;
      taskId: string;
      status: string;
    }
  ): Promise<string> {
    try {
      const payload: Types.EntryFunctionPayload = {
        function: `${this.moduleAddress}::transaction_queue::register_transaction`,
        type_arguments: [],
        arguments: [
          transaction.transactionId,
          transaction.processId,
          transaction.userAddress,
          transaction.workflowId,
          transaction.taskId,
          transaction.status
        ]
      };
      
      const txnRequest = await this.aptosClient.generateTransaction(account.address(), payload);
      const signedTxn = await this.aptosClient.signTransaction(account, txnRequest);
      const pendingTxn = await this.aptosClient.submitTransaction(signedTxn);
      await this.aptosClient.waitForTransaction(pendingTxn.hash);
      
      return pendingTxn.hash;
    } catch (error) {
      throw new Error(`Failed to register transaction on blockchain: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Update transaction status on the blockchain
   * 
   * @param account - Account to use for the transaction
   * @param transactionId - Transaction ID
   * @param status - New status
   * @param result - Result data (optional)
   * @param error - Error message (optional)
   */
  private async updateTransactionStatus(
    account: AptosAccount,
    transactionId: string,
    status: string,
    result?: any,
    error?: string
  ): Promise<string> {
    try {
      const resultStr = result ? JSON.stringify(result) : '';
      const errorStr = error || '';
      
      const payload: Types.EntryFunctionPayload = {
        function: `${this.moduleAddress}::transaction_queue::update_transaction_status`,
        type_arguments: [],
        arguments: [
          transactionId,
          status,
          resultStr,
          errorStr
        ]
      };
      
      const txnRequest = await this.aptosClient.generateTransaction(account.address(), payload);
      const signedTxn = await this.aptosClient.signTransaction(account, txnRequest);
      const pendingTxn = await this.aptosClient.submitTransaction(signedTxn);
      await this.aptosClient.waitForTransaction(pendingTxn.hash);
      
      return pendingTxn.hash;
    } catch (error) {
      throw new Error(`Failed to update transaction status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Forward request to agent process
   * 
   * @param agentUrl - URL of the agent process
   * @param request - Request data
   * @returns Response from the agent
   */
  private async forwardRequestToAgent(
    agentUrl: string,
    request: {
      transactionId: string;
      processId: string;
      userAddress: string;
      data: Record<string, any>;
      workflowId?: string;
      taskId?: string;
      priority?: number;
    }
  ): Promise<any> {
    try {
      // Ensure URL ends with a slash if it doesn't already
      const baseUrl = agentUrl.endsWith('/') ? agentUrl : `${agentUrl}/`;
      const url = `${baseUrl}execute`;
      
      // Forward the request
      const response = await axios.post(url, request, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });
      
      return response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(`Agent process returned error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
          throw new Error(`No response received from agent process: ${error.message}`);
        } else {
          throw new Error(`Error setting up request to agent process: ${error.message}`);
        }
      }
      throw error;
    }
  }
} 