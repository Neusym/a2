import { CreatorProfile } from '../creator/interfaces';
import { ProcessPricing } from '../payment/interfaces';

/**
 * Process metadata that will be stored in the discovery service
 */
export interface ProcessMetadata {
  id: string;
  name?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  agents: Array<{
    id: string;
    name?: string;
    instructions?: string;
    goal?: string;
    role?: string;
  }>;
  workflows: Array<{
    id: string;
    name?: string;
    description?: string;
  }>;
  tags?: string[];
  owner: string;
  status: 'active' | 'inactive' | 'error';
  creatorProfile?: CreatorProfile;
  pricing?: ProcessPricing;
}

/**
 * Base discovery service interface
 */
export interface DiscoveryService {
  /**
   * Register a process with the discovery service
   * 
   * @param processId Unique process identifier
   * @param metadata Process metadata
   */
  registerProcess(processId: string, metadata: ProcessMetadata): Promise<void>;
  
  /**
   * Update process metadata in the discovery service
   * 
   * @param processId Unique process identifier
   * @param metadata Updated process metadata
   */
  updateProcess(processId: string, metadata: Partial<ProcessMetadata>): Promise<void>;
  
  /**
   * Retrieve process metadata from the discovery service
   * 
   * @param processId Unique process identifier
   */
  getProcess(processId: string): Promise<ProcessMetadata | null>;
  
  /**
   * List processes matching the specified filters
   * 
   * @param filters Optional filters to apply
   */
  listProcesses(filters?: Record<string, any>): Promise<ProcessMetadata[]>;
  
  /**
   * Deregister a process from the discovery service
   * 
   * @param processId Unique process identifier
   */
  deregisterProcess(processId: string): Promise<void>;
} 