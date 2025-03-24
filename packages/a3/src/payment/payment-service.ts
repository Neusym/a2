import { AptosClient, Types, AptosAccount } from 'aptos';

/**
 * Payment details
 */
export interface PaymentDetails {
  processId: string;
  payer: string;
  receiver: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'refunded';
  paymentTime: number;
  expirationTime: number;
}

/**
 * Payment request data
 */
export interface PaymentRequest {
  processId: string;
  amount: number;
}

/**
 * Payment service configuration
 */
export interface PaymentServiceConfig {
  moduleAddress: string;
  aptosClient: AptosClient;
}

/**
 * Payment service interface
 */
export interface PaymentService {
  /**
   * Make a payment for a process
   * 
   * @param account Account making the payment
   * @param request Payment request data
   * @returns Promise resolving to transaction hash
   */
  makePayment(
    account: AptosAccount,
    request: PaymentRequest
  ): Promise<string>;
  
  /**
   * Verify if a payment has been made for a process
   * 
   * @param processId Process ID
   * @param payerAddress Payer wallet address
   * @returns Promise resolving to verification status
   */
  verifyPayment(
    processId: string,
    payerAddress: string
  ): Promise<boolean>;
  
  /**
   * Get payment details
   * 
   * @param processId Process ID
   * @param payerAddress Payer wallet address
   * @returns Promise resolving to payment details or null if not found
   */
  getPaymentDetails(
    processId: string,
    payerAddress: string
  ): Promise<PaymentDetails | null>;
  
  /**
   * Request a refund for a payment
   * 
   * @param account Account requesting the refund
   * @param processId Process ID
   * @returns Promise resolving to transaction hash
   */
  requestRefund(
    account: AptosAccount,
    processId: string
  ): Promise<string>;
}

/**
 * Aptos payment service implementation
 */
export class AptosPaymentService implements PaymentService {
  private moduleAddress: string;
  private aptosClient: AptosClient;
  
  constructor(config: PaymentServiceConfig) {
    this.moduleAddress = config.moduleAddress;
    this.aptosClient = config.aptosClient;
  }
  
  /**
   * Make a payment for a process
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
        request.amount.toString()
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
   * Verify if a payment has been made for a process
   */
  public async verifyPayment(
    processId: string,
    payerAddress: string
  ): Promise<boolean> {
    try {
      const payload = {
        function: `${this.moduleAddress}::payment::verify_payment`,
        type_arguments: [],
        arguments: [processId, payerAddress]
      };
      
      const response = await this.aptosClient.view(payload);
      return response[0] as boolean;
    } catch (error) {
      console.error('Error verifying payment:', error);
      return false;
    }
  }
  
  /**
   * Get payment details
   */
  public async getPaymentDetails(
    processId: string,
    payerAddress: string
  ): Promise<PaymentDetails | null> {
    try {
      const payload = {
        function: `${this.moduleAddress}::payment::get_payment`,
        type_arguments: [],
        arguments: [processId, payerAddress]
      };
      
      const response = await this.aptosClient.view(payload);
      
      // Process response data
      if (response && response.length >= 8) {
        return {
          processId: response[0] as string,
          payer: response[1] as string,
          receiver: response[2] as string,
          amount: parseInt(response[3] as string),
          currency: response[4] as string,
          // Map numeric status to string
          status: ['pending', 'completed', 'refunded'][parseInt(response[5] as string)] as 'pending' | 'completed' | 'refunded',
          paymentTime: parseInt(response[6] as string),
          expirationTime: parseInt(response[7] as string)
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting payment details:', error);
      return null;
    }
  }
  
  /**
   * Request a refund for a payment
   */
  public async requestRefund(
    account: AptosAccount,
    processId: string
  ): Promise<string> {
    const payload: Types.TransactionPayload = {
      type: 'entry_function_payload',
      function: `${this.moduleAddress}::payment::request_refund`,
      type_arguments: [],
      arguments: [processId]
    };
    
    const rawTx = await this.aptosClient.generateTransaction(account.address().toString(), payload);
    const signedTx = await this.aptosClient.signTransaction(account, rawTx);
    const response = await this.aptosClient.submitTransaction(signedTx);
    
    // Wait for transaction to complete
    await this.aptosClient.waitForTransaction(response.hash);
    
    return response.hash;
  }
} 