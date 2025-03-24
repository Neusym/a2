/**
 * Payment Service Interfaces
 */

import { AptosAccount } from 'aptos';

/**
 * Process pricing information
 */
export interface ProcessPricing {
  /** Price per task execution */
  taskPrice: string;
  
  /** Currency code (defaults to APT for Aptos) */
  currency?: string;
  
  /** Address where payments should be sent */
  paymentAddress?: string;
  
  /** Whether payment is required before process execution */
  requiresPrepayment?: boolean;
}

/**
 * Payment verification result
 */
export interface PaymentVerificationResult {
  /** Whether the payment verification was successful */
  verified: boolean;
  
  /** Payment status if verified (escrow, completed, refunded) */
  status?: 'escrow' | 'completed' | 'refunded';
  
  /** Optional transaction hash of the payment */
  transactionHash?: string;
  
  /** Optional error message if verification failed */
  error?: string;
  
  /** Optional timestamp of when the payment was made */
  timestamp?: string | number;
  
  /** Optional amount of the payment */
  amount?: string;
}

/**
 * Payment status enum
 */
export enum PaymentStatus {
  ESCROW = 1,
  COMPLETED = 2,
  REFUNDED = 3
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
 * Payment request
 */
export interface PaymentRequest {
  processId: string;
  taskId: string;
  amount: string;
  currency?: string;
}

/**
 * Payment release request
 */
export interface PaymentReleaseRequest {
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
 * Service for handling payments between agents
 */
export interface PaymentService {
  /**
   * Make a payment for a process (holds in escrow)
   * 
   * @param account Account making the payment
   * @param request Payment request details
   * @returns Promise resolving to transaction hash
   */
  makePayment(
    account: AptosAccount,
    request: PaymentRequest
  ): Promise<string>;
  
  /**
   * Verify if a payment has been made for a process
   * 
   * @param userAddress User's wallet address
   * @param processId Process ID
   * @param taskId Task ID
   * @returns Promise resolving to verification result
   */
  verifyPayment(
    userAddress: string,
    processId: string,
    taskId: string
  ): Promise<PaymentVerificationResult>;
  
  /**
   * Get payment details for a process
   * 
   * @param userAddress User's wallet address
   * @param processId Process ID
   * @param taskId Task ID
   * @returns Promise resolving to payment details or null if not found
   */
  getPaymentDetails(
    userAddress: string,
    processId: string,
    taskId: string
  ): Promise<PaymentDetails | null>;
  
  /**
   * Release payment from escrow after task completion approval
   * 
   * @param account Account requesting release (must be payer/requester)
   * @param request Release request details
   * @returns Promise resolving to transaction hash
   */
  releasePayment(
    account: AptosAccount,
    request: PaymentReleaseRequest
  ): Promise<string>;
  
  /**
   * Request a refund for a payment
   * 
   * @param account Account requesting the refund
   * @param request Refund request details
   * @returns Promise resolving to transaction hash
   */
  requestRefund(
    account: AptosAccount,
    request: RefundRequest
  ): Promise<string>;
  
  /**
   * Get payment instructions for a process
   * 
   * @param pricing Process pricing information
   * @param userAddress User's wallet address
   * @returns Payment instructions as a string
   */
  getPaymentInstructions(
    pricing: ProcessPricing,
    userAddress: string
  ): string;
} 