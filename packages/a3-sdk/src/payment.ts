import { A3Client } from './client';
import { A3ClientConfig, PaymentVerification } from './types';
import { buildUrl, isValidWalletAddress, isValidAmount, validateRequiredParams } from './utils';

/**
 * Payment Status enum
 */
export enum PaymentStatus {
  ESCROW = 1,
  COMPLETED = 2,
  REFUNDED = 3,
}

/**
 * Payment details
 */
export interface PaymentDetails {
  processId: string;
  taskId: string;
  payer: string;
  receiver: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  paymentTime: number;
  expirationTime: number;
  txHash?: string;
}

/**
 * Payment verification result
 */
export interface PaymentVerificationResult {
  verified: boolean;
  status?: 'escrow' | 'completed' | 'refunded';
  error?: string;
  txHash?: string;
  transactionHash?: string;
  amount?: string;
  timestamp?: number;
}

/**
 * Payment request
 */
export interface MakePaymentRequest {
  processId: string;
  taskId: string;
  amount: string;
  currency?: string;
}

/**
 * Payment release request
 */
export interface ReleasePaymentRequest {
  processId: string;
  taskId: string;
}

/**
 * Refund request
 */
export interface RefundRequest {
  processId: string;
  taskId: string;
}

/**
 * Payment Service for A3
 *
 * Handles payment verification and processing
 */
export class PaymentService {
  private readonly config: A3ClientConfig;
  private client: A3Client | null = null;

  /**
   * Creates a new payment service
   *
   * @param config SDK configuration
   * @param client A3 client instance (optional, will be set later if not provided)
   */
  constructor(config: A3ClientConfig, client?: A3Client) {
    this.config = config;
    if (client) {
      this.client = client;
    }
  }

  /**
   * Set the A3Client instance (used to resolve circular dependency)
   */
  setClient(client: A3Client): void {
    this.client = client;
  }

  /**
   * Verify payment between two addresses for a specific amount
   *
   * @param fromAddress Address that made the payment
   * @param toAddress Address that received the payment
   * @param amount Amount that was paid
   * @param currency Currency of the payment
   * @returns Promise that resolves to the verification result
   */
  async verifyPayment(
    fromAddress: string,
    toAddress: string,
    amount: string,
    currency: string = 'APT'
  ): Promise<PaymentVerificationResult> {
    try {
      if (!isValidWalletAddress(fromAddress) || !isValidWalletAddress(toAddress)) {
        throw new Error('Invalid wallet address format');
      }

      if (!isValidAmount(amount)) {
        throw new Error('Invalid amount format');
      }

      const params: PaymentVerification = {
        verified: false,
        fromAddress,
        toAddress,
        amount,
      };

      const url = buildUrl(this.config.apiUrl || '', '/payment/verify');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey || ''}`,
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`Payment verification failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Payment verification error:', error);
      throw error;
    }
  }

  /**
   * Make a payment for a process (stored in escrow)
   *
   * @param request Payment request
   * @returns Promise that resolves to the transaction details
   */
  async makePaymentForProcess(request: MakePaymentRequest): Promise<any> {
    validateRequiredParams(request, ['processId', 'taskId', 'amount']);

    if (!isValidAmount(request.amount)) {
      throw new Error('Invalid amount format');
    }

    const url = buildUrl(this.config.apiUrl || '', '/payment');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey || ''}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Payment failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Verify if a payment has been made for a process
   *
   * @param userAddress User's wallet address
   * @param processId Process ID
   * @param taskId Task ID
   * @returns Promise that resolves to the verification result
   */
  async verifyPaymentForProcess(
    userAddress: string,
    processId: string,
    taskId: string
  ): Promise<PaymentVerificationResult> {
    validateRequiredParams({ userAddress, processId, taskId }, [
      'userAddress',
      'processId',
      'taskId',
    ]);

    if (!isValidWalletAddress(userAddress)) {
      throw new Error('Invalid wallet address format');
    }

    const queryParams = {
      userAddress,
      processId,
      taskId,
    };

    const url = buildUrl(this.config.apiUrl || '', '/payment/verify', queryParams);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.config.apiKey || ''}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Payment verification failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get payment details
   *
   * @param userAddress User's wallet address
   * @param processId Process ID
   * @param taskId Task ID
   * @returns Promise that resolves to the payment details
   */
  async getPaymentDetails(
    userAddress: string,
    processId: string,
    taskId: string
  ): Promise<PaymentDetails> {
    validateRequiredParams({ userAddress, processId, taskId }, [
      'userAddress',
      'processId',
      'taskId',
    ]);

    if (!isValidWalletAddress(userAddress)) {
      throw new Error('Invalid wallet address format');
    }

    const queryParams = {
      userAddress,
      processId,
      taskId,
    };

    const url = buildUrl(this.config.apiUrl || '', '/payment/details', queryParams);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.config.apiKey || ''}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get payment details: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Release payment from escrow after task completion
   *
   * @param request Payment release request
   * @returns Promise that resolves to the transaction details
   */
  async releasePayment(request: ReleasePaymentRequest): Promise<any> {
    validateRequiredParams(request, ['processId', 'taskId']);

    const url = buildUrl(this.config.apiUrl || '', '/payment/release');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey || ''}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Payment release failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Request a refund for a payment
   *
   * @param request Refund request
   * @returns Promise that resolves to the refund details
   */
  async requestRefund(request: RefundRequest): Promise<any> {
    validateRequiredParams(request, ['processId', 'taskId']);

    const url = buildUrl(this.config.apiUrl || '', '/payment/refund');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey || ''}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Refund request failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Approve a task and release payment
   *
   * @param workflowId Workflow ID
   * @param taskId Task ID
   * @returns Promise that resolves to the transaction details
   */
  async approveTaskAndReleasePayment(workflowId: string, taskId: string): Promise<any> {
    validateRequiredParams({ workflowId, taskId }, ['workflowId', 'taskId']);

    const url = buildUrl(this.config.apiUrl || '', '/workflow/task/approve');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey || ''}`,
      },
      body: JSON.stringify({ workflowId, taskId }),
    });

    if (!response.ok) {
      throw new Error(`Task approval failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get payment instructions for a process
   *
   * @param processId Process ID
   * @param userAddress User's wallet address
   * @returns Promise that resolves to the payment instructions
   */
  async getPaymentInstructions(processId: string, userAddress: string): Promise<string> {
    validateRequiredParams({ processId, userAddress }, ['processId', 'userAddress']);

    if (!isValidWalletAddress(userAddress)) {
      throw new Error('Invalid wallet address format');
    }

    const queryParams = {
      processId,
      userAddress,
    };

    const url = buildUrl(this.config.apiUrl || '', '/payment/instructions', queryParams);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.config.apiKey || ''}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get payment instructions: ${response.statusText}`);
    }

    const data = await response.json();
    return data.instructions || '';
  }
}
