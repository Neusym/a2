import { AptosAccount } from 'aptos';

/**
 * Process metadata interface
 */
export interface ProcessMetadata {
  id: string;
  name: string;
  description: string;
  owner: string;
  agents: string[];
  workflows: string[];
  tags: string[];
  status: 'active' | 'paused' | 'deprecated';
  pricing?: ProcessPricing;
  url: string;
  creatorProfile?: CreatorProfile;
  created_at: number;
  updated_at: number;
}

/**
 * Process pricing interface
 */
export interface ProcessPricing {
  taskPrice: number;
  currency: string;
  paymentAddress: string;
  requiresPrepayment: boolean;
}

/**
 * Creator profile interface
 */
export interface CreatorProfile {
  name: string;
  description: string;
  walletAddress: string;
  social?: Record<string, string>;
}

/**
 * Process search options
 */
export interface ProcessSearchOptions {
  owner?: string;
  tags?: string[];
  status?: 'active' | 'paused' | 'deprecated';
}

/**
 * Process discovery service interface
 */
export interface ProcessDiscoveryService {
  /**
   * Register a new process
   * 
   * @param account Account used for transaction
   * @param metadata Process metadata
   * @returns Promise resolving to success status
   */
  registerProcess(account: AptosAccount | string, metadata: ProcessMetadata): Promise<boolean>;
  
  /**
   * Update an existing process
   * 
   * @param account Account used for transaction
   * @param processId Process ID
   * @param metadata Updated process metadata
   * @returns Promise resolving to success status
   */
  updateProcess(account: AptosAccount | string, processId: string, metadata: Partial<ProcessMetadata>): Promise<boolean>;
  
  /**
   * Get process details by ID
   * 
   * @param processId Process ID
   * @returns Promise resolving to process metadata or null if not found
   */
  getProcess(processId: string): Promise<ProcessMetadata | null>;
  
  /**
   * List processes based on search criteria
   * 
   * @param options Search options
   * @returns Promise resolving to array of matching processes
   */
  listProcesses(options?: ProcessSearchOptions): Promise<ProcessMetadata[]>;
  
  /**
   * Deregister a process
   * 
   * @param account Account used for transaction
   * @param processId Process ID
   * @returns Promise resolving to success status
   */
  deregisterProcess(account: AptosAccount | string, processId: string): Promise<boolean>;
} 