import axios from 'axios';

import { A3ClientConfig, Transaction, TransactionStatus } from './types';
import { buildUrl } from './utils';

/**
 * Service for managing transactions on the Aptos blockchain
 */
export class TransactionService {
  private readonly config: A3ClientConfig;

  /**
   * Creates a new transaction service
   *
   * @param config SDK configuration
   */
  constructor(config: A3ClientConfig) {
    this.config = config;
  }

  /**
   * Get details of a transaction by hash
   *
   * @param transactionHash Hash of the transaction
   * @returns Transaction details or null if not found
   */
  async getTransaction(transactionHash: string): Promise<Transaction | null> {
    try {
      const url = buildUrl(this.config.apiUrl || '', `/transactions/${transactionHash}`);

      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      console.error(`Error getting transaction ${transactionHash}:`, error);
      return null;
    }
  }

  /**
   * Check the status of a transaction
   *
   * @param transactionHash Hash of the transaction
   * @returns Transaction status or null if not found
   */
  async getTransactionStatus(transactionHash: string): Promise<TransactionStatus | null> {
    try {
      const transaction = await this.getTransaction(transactionHash);
      return transaction ? transaction.status : null;
    } catch (error) {
      console.error(`Error getting transaction status for ${transactionHash}:`, error);
      return null;
    }
  }

  /**
   * Wait for a transaction to complete
   *
   * @param transactionHash Hash of the transaction
   * @param timeoutMs Timeout in milliseconds
   * @param intervalMs Polling interval in milliseconds
   * @returns Transaction details or null if timeout or error
   */
  async waitForTransaction(
    transactionHash: string,
    timeoutMs: number = 30000,
    intervalMs: number = 1000
  ): Promise<Transaction | null> {
    return new Promise(resolve => {
      let elapsed = 0;
      const checkInterval = setInterval(async () => {
        try {
          elapsed += intervalMs;

          // Check if we've exceeded the timeout
          if (elapsed >= timeoutMs) {
            clearInterval(checkInterval);
            console.error(`Timeout waiting for transaction ${transactionHash}`);
            resolve(null);
            return;
          }

          // Get the transaction details
          const transaction = await this.getTransaction(transactionHash);

          // If the transaction is not found, keep waiting
          if (!transaction) return;

          // If the transaction is no longer pending, resolve
          if (transaction.status !== 'pending') {
            clearInterval(checkInterval);
            resolve(transaction);
          }
        } catch (error) {
          console.error(`Error checking transaction ${transactionHash}:`, error);
          // Keep waiting on error
        }
      }, intervalMs);
    });
  }

  /**
   * Get recent transactions for an address
   *
   * @param address Wallet address
   * @param limit Maximum number of transactions to return
   * @returns Array of transactions
   */
  async getAddressTransactions(address: string, limit: number = 10): Promise<Transaction[]> {
    try {
      const url = buildUrl(this.config.apiUrl || '', `/accounts/${address}/transactions`);

      const response = await axios.get(url, {
        params: { limit },
      });

      return response.data.transactions || [];
    } catch (error) {
      console.error(`Error getting transactions for ${address}:`, error);
      return [];
    }
  }
}
