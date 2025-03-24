/**
 * Discovery Module
 * 
 * Provides services for registering and discovering processes across environments.
 */

export * from './interfaces';
export * from './aptos';

// Add a factory function to create the discovery service
import { createAptosDiscoveryService as createAptosService } from './aptos/factory';
import { DiscoveryService, ProcessMetadata } from './interfaces';

/**
 * Create a no-operation discovery service for testing or environments
 * where discovery is not needed
 */
export function createNoopDiscoveryService(): DiscoveryService {
  return {
    async registerProcess(processId: string, metadata: ProcessMetadata): Promise<void> {
      console.log('Noop register process called', { processId });
    },
    
    async updateProcess(processId: string, metadata: Partial<ProcessMetadata>): Promise<void> {
      console.log('Noop update process called', { processId });
    },
    
    async getProcess(processId: string): Promise<ProcessMetadata | null> {
      console.log('Noop get process called', { processId });
      return null;
    },
    
    async listProcesses(filters?: Record<string, any>): Promise<ProcessMetadata[]> {
      console.log('Noop list processes called', { filters });
      return [];
    },
    
    async deregisterProcess(processId: string): Promise<void> {
      console.log('Noop deregister process called', { processId });
    }
  };
}

/**
 * Create an Aptos-based discovery service
 * 
 * This function is a re-export of the factory function from aptos/factory.ts.
 * It simplifies configuration by supporting environment variables when options are not provided.
 * 
 * @param options Configuration options for the Aptos discovery service
 */
export const createAptosDiscoveryService = createAptosService; 