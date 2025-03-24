import { A3ClientConfig, CreatorProfile } from './types';
import { buildUrl, validateRequiredParams, isValidWalletAddress } from './utils';

/**
 * Service for managing creator profiles
 */
export class CreatorService {
  private readonly config: A3ClientConfig;

  /**
   * Creates a new creator service
   *
   * @param config SDK configuration
   */
  constructor(config: A3ClientConfig) {
    this.config = config;
  }

  /**
   * Register a new creator profile
   *
   * @param profile Creator profile to register
   * @returns Registered creator profile or null if registration failed
   */
  async registerCreatorProfile(profile: CreatorProfile): Promise<CreatorProfile | null> {
    try {
      validateRequiredParams(profile, ['name', 'walletAddress']);

      const url = buildUrl(this.config.apiUrl || '', '/creators');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey || ''}`,
        },
        body: JSON.stringify(profile),
      });

      if (!response.ok) {
        throw new Error(`Failed to register creator profile: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error registering creator profile:', error);
      return null;
    }
  }

  /**
   * Get a creator profile by wallet address
   *
   * @param walletAddress Wallet address of the creator
   * @returns Creator profile or null if not found
   */
  async getCreatorProfile(walletAddress: string): Promise<CreatorProfile | null> {
    try {
      if (!isValidWalletAddress(walletAddress)) {
        throw new Error('Invalid wallet address format');
      }

      const url = buildUrl(this.config.apiUrl || '', `/creators/${walletAddress}`);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.apiKey || ''}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to get creator profile: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting creator profile:', error);
      return null;
    }
  }

  /**
   * Update a creator profile
   *
   * @param walletAddress Wallet address of the creator
   * @param updates Updates to apply to the creator profile
   * @returns Updated creator profile or null if update failed
   */
  async updateCreatorProfile(
    walletAddress: string,
    updates: Partial<CreatorProfile>
  ): Promise<CreatorProfile | null> {
    try {
      if (!isValidWalletAddress(walletAddress)) {
        throw new Error('Invalid wallet address format');
      }

      const url = buildUrl(this.config.apiUrl || '', `/creators/${walletAddress}`);
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey || ''}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update creator profile: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating creator profile:', error);
      return null;
    }
  }

  /**
   * List processes created by a creator
   *
   * @param walletAddress Wallet address of the creator
   * @returns Array of process IDs
   */
  async listCreatorProcesses(walletAddress: string): Promise<string[]> {
    try {
      if (!isValidWalletAddress(walletAddress)) {
        throw new Error('Invalid wallet address format');
      }

      const url = buildUrl(this.config.apiUrl || '', `/creators/${walletAddress}/processes`);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.apiKey || ''}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return [];
        }
        throw new Error(`Failed to list creator processes: ${response.statusText}`);
      }

      const data = await response.json();
      return data.processIds || [];
    } catch (error) {
      console.error('Error listing creator processes:', error);
      return [];
    }
  }
}
