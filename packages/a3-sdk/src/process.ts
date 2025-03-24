import axios from 'axios';

import { DiscoveryService } from './discovery';
import { PaymentService } from './payment';
import { A3ClientConfig, ProcessMetadata, CreatorProfile, ProcessPricing } from './types';
import { buildUrl, generateProcessId } from './utils';

/**
 * Service for managing processes on the A3 platform
 */
export class ProcessService {
  private readonly config: A3ClientConfig;
  private readonly discoveryService: DiscoveryService;
  private readonly paymentService: PaymentService;

  /**
   * Creates a new process service
   *
   * @param config SDK configuration
   * @param discoveryService Discovery service for finding processes
   * @param paymentService Payment service for handling payments
   */
  constructor(
    config: A3ClientConfig,
    discoveryService: DiscoveryService,
    paymentService: PaymentService
  ) {
    this.config = config;
    this.discoveryService = discoveryService;
    this.paymentService = paymentService;
  }

  /**
   * Register a new process on the platform
   *
   * @param name Name of the process
   * @param description Description of the process
   * @param tags Tags for the process
   * @param creatorProfile Creator profile information
   * @param pricing Pricing information
   * @returns Registered process metadata or null if registration failed
   */
  async registerProcess(
    name: string,
    description: string,
    tags: string[] = [],
    creatorProfile?: CreatorProfile,
    pricing?: ProcessPricing
  ): Promise<ProcessMetadata | null> {
    try {
      if (!this.config.privateKey) {
        throw new Error('Private key is required to register a process');
      }

      const url = buildUrl(this.config.apiUrl || '', '/processes');

      // Create process metadata
      const processId = generateProcessId();
      const metadata: ProcessMetadata = {
        id: processId,
        name,
        description,
        tags,
        owner: this.config.moduleAddress,
        creatorProfile,
        pricing,
      };

      const response = await axios.post(url, metadata, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.privateKey}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error registering process:', error);
      return null;
    }
  }

  /**
   * Update an existing process
   *
   * @param processId ID of the process to update
   * @param updates Updates to apply to the process
   * @returns Updated process metadata or null if update failed
   */
  async updateProcess(
    processId: string,
    updates: Partial<ProcessMetadata>
  ): Promise<ProcessMetadata | null> {
    try {
      if (!this.config.privateKey) {
        throw new Error('Private key is required to update a process');
      }

      const url = buildUrl(this.config.apiUrl || '', `/processes/${processId}`);

      const response = await axios.patch(url, updates, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.privateKey}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error(`Error updating process ${processId}:`, error);
      return null;
    }
  }

  /**
   * Delete a process
   *
   * @param processId ID of the process to delete
   * @returns True if deletion was successful, false otherwise
   */
  async deleteProcess(processId: string): Promise<boolean> {
    try {
      if (!this.config.privateKey) {
        throw new Error('Private key is required to delete a process');
      }

      const url = buildUrl(this.config.apiUrl || '', `/processes/${processId}`);

      await axios.delete(url, {
        headers: {
          Authorization: `Bearer ${this.config.privateKey}`,
        },
      });

      return true;
    } catch (error) {
      console.error(`Error deleting process ${processId}:`, error);
      return false;
    }
  }

  /**
   * Run a process with payment verification
   *
   * @param processId ID of the process to run
   * @param userWalletAddress Wallet address of the user running the process
   * @param input Optional input data for the process
   * @returns Result of the process execution or null if execution failed
   */
  async runProcessWithPayment(
    processId: string,
    userWalletAddress: string,
    input?: any
  ): Promise<any> {
    try {
      // Get process metadata
      const processMetadata = await this.discoveryService.getProcess(processId);

      if (!processMetadata) {
        throw new Error(`Process with ID ${processId} not found`);
      }

      // Check if payment is required
      if (processMetadata.pricing && processMetadata.pricing.requiresPrepayment) {
        // Verify payment
        const verification = await this.paymentService.verifyPayment(
          userWalletAddress,
          processMetadata.pricing.paymentAddress ||
            processMetadata.creatorProfile?.walletAddress ||
            '',
          processMetadata.pricing.taskPrice,
          processMetadata.pricing.currency || 'APT'
        );

        if (!verification.verified) {
          throw new Error(
            `Payment required: ${processMetadata.pricing.taskPrice} ${processMetadata.pricing.currency || 'APT'}`
          );
        }
      }

      // Run the process
      const url = buildUrl(this.config.apiUrl || '', `/processes/${processId}/run`);

      const response = await axios.post(url, {
        userWalletAddress,
        input,
      });

      return response.data;
    } catch (error) {
      console.error(`Error running process ${processId}:`, error);
      return null;
    }
  }
}
