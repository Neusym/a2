/**
 * Discovery Module
 *
 * Provides services for registering and discovering processes across environments.
 */

export * from './interfaces';
export * from './aptos';

// Add additional discovery implementations here
// export * from './other-implementation';

import { createLogger, LogLevel } from '../logger';

import { DiscoveryService, ProcessMetadata } from './interfaces';

/**
 * Create a no-operation discovery service for testing or environments
 * where discovery is not needed
 */
export function createNoopDiscoveryService(): DiscoveryService {
  const logger = createLogger({
    name: 'noop-discovery',
    level: LogLevel.INFO,
  });

  return {
    async registerProcess(processId: string, metadata: ProcessMetadata): Promise<void> {
      logger.debug('Noop register process called', { processId });
    },

    async updateProcess(processId: string, metadata: Partial<ProcessMetadata>): Promise<void> {
      logger.debug('Noop update process called', { processId });
    },

    async getProcess(processId: string): Promise<ProcessMetadata | null> {
      logger.debug('Noop get process called', { processId });
      return null;
    },

    async listProcesses(filters?: Record<string, any>): Promise<ProcessMetadata[]> {
      logger.debug('Noop list processes called', { filters });
      return [];
    },

    async deregisterProcess(processId: string): Promise<void> {
      logger.debug('Noop deregister process called', { processId });
    },
  };
}
