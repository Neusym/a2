import { AptosClient, Types, AptosAccount } from 'aptos';

import {
  PaymentService,
  PaymentVerificationResult,
  PaymentDetails,
  PaymentRequest,
  PaymentReleaseRequest,
  RefundRequest,
  ProcessPricing,
  PaymentStatus
} from './interfaces';

/**
 * Configuration for Aptos payment service
 */
interface AptosPaymentServiceConfig {
  moduleAddress: string;
  aptosClient: AptosClient;
}

/**
 * Aptos payment service implementation
 */
export class AptosPaymentService implements PaymentService {
  private moduleAddress: string;
  private aptosClient: AptosClient;
  
  /**
   * Create a new Aptos payment service
   * 
   * @param config Service configuration
   */
  constructor(config: AptosPaymentServiceConfig) {
    this.moduleAddress = config.moduleAddress;
    this.aptosClient = config.aptosClient;
  }
  
  /**
   * Make a payment for a process
   * 
   * @param account Account making the payment
   * @param request Payment request
   * @returns Promise resolving to transaction hash
   */
  public async makePayment(
    account: AptosAccount,
    request: PaymentRequest
  ): Promise<string> {
    const payload: Types.TransactionPayload = {
      type: 'entry_function_payload',
      function: `${this.moduleAddress}::payment::make_payment`,
      type_arguments: [],
      arguments: [
        request.processId,
        request.taskId,
        request.amount
      ]
    };
    
    const rawTx = await this.aptosClient.generateTransaction(account.address().toString(), payload);
    const signedTx = await this.aptosClient.signTransaction(account, rawTx);
    const response = await this.aptosClient.submitTransaction(signedTx);
    
    // Wait for transaction to complete
    await this.aptosClient.waitForTransaction(response.hash);
    
    return response.hash;
  }
  
  /**
   * Verify payment for a process
   * 
   * @param userAddress User's wallet address
   * @param processId Process ID
   * @param taskId Task ID
   * @returns Promise resolving to verification result
   */
  public async verifyPayment(
    userAddress: string,
    processId: string,
    taskId: string
  ): Promise<PaymentVerificationResult> {
    try {
      const payload = {
        function: `${this.moduleAddress}::payment::verify_payment`,
        type_arguments: [],
        arguments: [processId, taskId, userAddress]
      };
      
      const response = await this.aptosClient.view(payload);
      const verified = response[0] as boolean;
      
      if (!verified) {
        return {
          verified: false,
          error: 'Payment not found or insufficient'
        };
      }
      
      // Get payment details
      const details = await this.getPaymentDetails(userAddress, processId, taskId);
      
      if (!details) {
        return {
          verified: true,
          status: 'escrow',
          error: 'Payment verified but details not found'
        };
      }
      
      // Map status from number to string
      let status: 'escrow' | 'completed' | 'refunded';
      
      switch (details.status) {
        case PaymentStatus.ESCROW:
          status = 'escrow';
          break;
        case PaymentStatus.COMPLETED:
          status = 'completed';
          break;
        case PaymentStatus.REFUNDED:
          status = 'refunded';
          break;
        default:
          status = 'escrow';
      }
      
      return {
        verified: true,
        status,
        amount: details.amount,
        timestamp: details.paymentTime
      };
    } catch (error) {
      console.error('Error verifying payment:', error);
      return {
        verified: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Get payment details
   * 
   * @param userAddress User's wallet address
   * @param processId Process ID
   * @param taskId Task ID
   * @returns Promise resolving to payment details or null if not found
   */
  public async getPaymentDetails(
    userAddress: string,
    processId: string,
    taskId: string
  ): Promise<PaymentDetails | null> {
    try {
      const payload = {
        function: `${this.moduleAddress}::payment::get_payment`,
        type_arguments: [],
        arguments: [processId, taskId, userAddress]
      };
      
      const response = await this.aptosClient.view(payload);
      
      return {
        processId: response[0] as string,
        taskId: response[1] as string,
        payer: response[2] as string,
        receiver: response[3] as string,
        amount: response[4].toString(),
        currency: response[5] as string,
        status: Number(response[6]) as PaymentStatus,
        paymentTime: Number(response[7]),
        expirationTime: Number(response[8])
      };
    } catch (error) {
      console.error('Error getting payment details:', error);
      return null;
    }
  }
  
  /**
   * Release payment from escrow after task completion approval
   * 
   * @param account Account requesting release (must be payer/requester)
   * @param request Release request
   * @returns Promise resolving to transaction hash
   */
  public async releasePayment(
    account: AptosAccount,
    request: PaymentReleaseRequest
  ): Promise<string> {
    const payload: Types.TransactionPayload = {
      type: 'entry_function_payload',
      function: `${this.moduleAddress}::payment::release_payment`,
      type_arguments: [],
      arguments: [
        request.processId,
        request.taskId
      ]
    };
    
    const rawTx = await this.aptosClient.generateTransaction(account.address().toString(), payload);
    const signedTx = await this.aptosClient.signTransaction(account, rawTx);
    const response = await this.aptosClient.submitTransaction(signedTx);
    
    // Wait for transaction to complete
    await this.aptosClient.waitForTransaction(response.hash);
    
    return response.hash;
  }
  
  /**
   * Request a refund for a payment
   * 
   * @param account Account requesting the refund
   * @param request Refund request
   * @returns Promise resolving to transaction hash
   */
  public async requestRefund(
    account: AptosAccount,
    request: RefundRequest
  ): Promise<string> {
    const payload: Types.TransactionPayload = {
      type: 'entry_function_payload',
      function: `${this.moduleAddress}::payment::request_refund`,
      type_arguments: [],
      arguments: [
        request.processId,
        request.taskId
      ]
    };
    
    const rawTx = await this.aptosClient.generateTransaction(account.address().toString(), payload);
    const signedTx = await this.aptosClient.signTransaction(account, rawTx);
    const response = await this.aptosClient.submitTransaction(signedTx);
    
    // Wait for transaction to complete
    await this.aptosClient.waitForTransaction(response.hash);
    
    return response.hash;
  }
  
  /**
   * Get payment instructions for a process
   * 
   * @param pricing Process pricing information
   * @param userAddress User's wallet address
   * @returns Payment instructions as a string
   */
  public getPaymentInstructions(
    pricing: ProcessPricing,
    userAddress: string
  ): string {
    if (!pricing.requiresPrepayment) {
      return 'This process does not require prepayment.';
    }
    
    if (!pricing.paymentAddress) {
      return 'Payment address not specified. Please contact the process owner.';
    }
    
    const networkName = this.aptosClient.nodeUrl.includes('mainnet') ? 'mainnet' : 'testnet';
    const explorerBaseUrl = networkName === 'mainnet' 
      ? 'https://explorer.aptoslabs.com' 
      : 'https://explorer.aptoslabs.com/testnet';
      
    const currency = pricing.currency || 'APT';
    
    return `
To run this process, please make a payment of ${pricing.taskPrice} ${currency}.

Payment will be held in escrow until the task is completed and approved.

You can make the payment through:

1. CLI: 
   aptos move run --function ${this.moduleAddress}::payment::make_payment \\
   --args string:${pricing.paymentAddress} string:${pricing.taskPrice} \\
   --account ${userAddress}
   
2. SDK:
   Use the SDK's makePayment function with your account and the process ID.
   
3. Explorer:
   Visit ${explorerBaseUrl} and connect your wallet to make the transaction.
   
After payment, your funds will be held securely in escrow and only released when you approve the completed task.
`;
  }
} 