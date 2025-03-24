/**
 * Type definitions for the A3 SDK
 */

/**
 * Network configuration
 */
export type NetworkType = 'mainnet' | 'testnet' | 'devnet' | 'local';

/**
 * Configuration for the A3 SDK client
 */
export interface A3ClientConfig {
  /**
   * Private key for the Aptos account
   */
  privateKey?: string;

  /**
   * Module address for the A3 platform
   */
  moduleAddress?: string;

  /**
   * Network to connect to
   * @default 'testnet'
   */
  network?: NetworkType;

  /**
   * URL for the Aptos node to connect to
   * @default 'https://fullnode.testnet.aptoslabs.com/v1'
   */
  nodeUrl?: string;

  /**
   * URL for the Aptos faucet (testnet/devnet only)
   */
  faucetUrl?: string;

  /**
   * API URL for A3 platform services
   */
  apiUrl?: string;

  /**
   * API key for authentication with A3 platform services
   */
  apiKey?: string;
}

/**
 * A creator profile
 */
export interface CreatorProfile {
  /**
   * Name of the creator
   */
  name?: string;

  /**
   * Description of the creator
   */
  description?: string;

  /**
   * Wallet address of the creator
   */
  walletAddress?: string;

  /**
   * Website URL of the creator
   */
  website?: string;

  /**
   * Social media links
   */
  social?: Record<string, string>;
}

/**
 * Pricing information for a process
 */
export interface ProcessPricing {
  /**
   * Price for executing a task
   */
  taskPrice: string;

  /**
   * Currency for the task price
   * @default 'APT'
   */
  currency?: string;

  /**
   * Address to receive payments
   */
  paymentAddress?: string;

  /**
   * Whether the process requires prepayment
   * @default true
   */
  requiresPrepayment?: boolean;
}

/**
 * Process metadata
 */
export interface ProcessMetadata {
  /**
   * Process ID (set by the system)
   */
  id?: string;

  /**
   * Name of the process
   */
  name: string;

  /**
   * Description of the process
   */
  description: string;

  /**
   * Tags for categorizing the process
   */
  tags?: string[];

  /**
   * Owner/creator of the process
   */
  owner?: string;

  /**
   * Creator profile information
   */
  creatorProfile?: CreatorProfile;

  /**
   * Pricing information
   */
  pricing?: ProcessPricing;
}

/**
 * Payment verification result
 */
export interface PaymentVerification {
  /**
   * Whether the payment is verified
   */
  verified: boolean;

  /**
   * Transaction hash for the payment
   */
  transactionHash?: string;

  /**
   * Amount that was paid
   */
  amount?: string;

  /**
   * Address that made the payment
   */
  fromAddress?: string;

  /**
   * Address that received the payment
   */
  toAddress?: string;

  /**
   * Error message if verification failed
   */
  error?: string;
}

/**
 * Contract deployment result
 */
export interface ContractDeployment {
  /**
   * Whether the deployment was successful
   */
  success: boolean;

  /**
   * Transaction hash for the deployment
   */
  transactionHash?: string;

  /**
   * Address of the deployed contract
   */
  contractAddress?: string;

  /**
   * Error message if deployment failed
   */
  error?: string;
}

/**
 * Transaction status
 */
export type TransactionStatus = 'pending' | 'completed' | 'failed';

/**
 * Transaction details
 */
export interface Transaction {
  /**
   * Transaction hash
   */
  hash: string;

  /**
   * Status of the transaction
   */
  status: TransactionStatus;

  /**
   * Sender address
   */
  sender: string;

  /**
   * Timestamp when the transaction was created
   */
  timestamp: number;

  /**
   * Gas used by the transaction
   */
  gasUsed?: string;

  /**
   * Error message if the transaction failed
   */
  error?: string;
}
