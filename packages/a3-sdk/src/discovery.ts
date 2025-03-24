import { A3ClientConfig, ProcessMetadata } from './types';
import { buildUrl } from './utils';

/**
 * Service for discovering processes on the A3 platform
 */
export class DiscoveryService {
  private readonly config: A3ClientConfig;

  /**
   * Creates a new discovery service
   *
   * @param config SDK configuration
   */
  constructor(config: A3ClientConfig) {
    this.config = config;
  }

  /**
   * List all processes registered on the platform
   *
   * @param tags Optional tags to filter processes by
   * @returns Array of process metadata
   */
  async listProcesses(tags?: string[]): Promise<ProcessMetadata[]> {
    try {
      let url = buildUrl(this.config.apiUrl || '', '/processes');

      // Add tags as query parameters if provided
      if (tags && tags.length > 0) {
        const queryParams = { tags: tags.join(',') };
        url = buildUrl(this.config.apiUrl || '', '/processes', queryParams);
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.apiKey || ''}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to list processes: ${response.statusText}`);
      }

      const data = await response.json();
      return data.processes || [];
    } catch (error) {
      console.error('Error listing processes:', error);
      return [];
    }
  }

  /**
   * Get details of a specific process by ID
   *
   * @param processId ID of the process to retrieve
   * @returns Process metadata or null if not found
   */
  async getProcess(processId: string): Promise<ProcessMetadata | null> {
    try {
      const url = buildUrl(this.config.apiUrl || '', `/processes/${processId}`);

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
        throw new Error(`Failed to get process: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error getting process ${processId}:`, error);
      return null;
    }
  }

  /**
   * Search for processes by name or description
   *
   * @param query Search query
   * @returns Array of matching processes
   */
  async searchProcesses(query: string): Promise<ProcessMetadata[]> {
    try {
      const queryParams = { q: query };
      const url = buildUrl(this.config.apiUrl || '', '/processes/search', queryParams);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.apiKey || ''}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to search processes: ${response.statusText}`);
      }

      const data = await response.json();
      return data.processes || [];
    } catch (error) {
      console.error('Error searching processes:', error);
      return [];
    }
  }
}
