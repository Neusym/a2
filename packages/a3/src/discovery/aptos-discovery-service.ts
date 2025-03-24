import { AptosClient, Types, AptosAccount } from 'aptos';

import { ProcessDiscoveryService, ProcessMetadata, ProcessSearchOptions, ProcessPricing, CreatorProfile } from './process-discovery-service';

/**
 * Aptos discovery service configuration
 */
export interface AptosDiscoveryServiceConfig {
  moduleAddress: string;
  aptosClient: AptosClient;
}

/**
 * Aptos discovery service implementation
 */
export class AptosDiscoveryService implements ProcessDiscoveryService {
  private moduleAddress: string;
  private aptosClient: AptosClient;
  
  constructor(config: AptosDiscoveryServiceConfig) {
    this.moduleAddress = config.moduleAddress;
    this.aptosClient = config.aptosClient;
  }
  
  /**
   * Register a new process on the Aptos blockchain
   */
  public async registerProcess(
    account: AptosAccount | string,
    metadata: ProcessMetadata
  ): Promise<boolean> {
    try {
      // First, check if creator profile exists
      if (metadata.creatorProfile) {
        await this.ensureCreatorProfileExists(
          metadata.owner,
          metadata.creatorProfile
        );
      }
      
      // Convert string arrays to properly formatted Move vectors
      const agents = metadata.agents || [];
      const workflows = metadata.workflows || [];
      const tags = metadata.tags || [];
      
      // Register the process
      const accountObj = typeof account === 'string' ? await this.getAccount() : account;
      
      const payload: Types.TransactionPayload = {
        type: 'entry_function_payload',
        function: `${this.moduleAddress}::process_registry::register_process`,
        type_arguments: [],
        arguments: [
          metadata.id,
          metadata.name,
          metadata.description,
          agents,
          workflows,
          tags
        ]
      };
      
      const rawTx = await this.aptosClient.generateTransaction(accountObj.address().toString(), payload);
      const signedTx = await this.aptosClient.signTransaction(accountObj, rawTx);
      const response = await this.aptosClient.submitTransaction(signedTx);
      
      // Wait for transaction to complete
      await this.aptosClient.waitForTransaction(response.hash);
      
      // Set process pricing if provided
      if (metadata.pricing) {
        await this.setProcessPricing(
          metadata.id,
          metadata.pricing
        );
      }
      
      return true;
    } catch (error) {
      console.error('Error registering process:', error);
      return false;
    }
  }
  
  /**
   * Update an existing process on the Aptos blockchain
   */
  public async updateProcess(
    account: AptosAccount | string,
    processId: string,
    metadata: Partial<ProcessMetadata>
  ): Promise<boolean> {
    try {
      const accountObj = typeof account === 'string' ? await this.getAccount() : account;
      
      // Update process details
      if (metadata.name || metadata.description) {
        const payload: Types.TransactionPayload = {
          type: 'entry_function_payload',
          function: `${this.moduleAddress}::process_registry::update_process`,
          type_arguments: [],
          arguments: [
            processId,
            metadata.name || '',
            metadata.description || ''
          ]
        };
        
        const rawTx = await this.aptosClient.generateTransaction(accountObj.address().toString(), payload);
        const signedTx = await this.aptosClient.signTransaction(accountObj, rawTx);
        const response = await this.aptosClient.submitTransaction(signedTx);
        
        // Wait for transaction to complete
        await this.aptosClient.waitForTransaction(response.hash);
      }
      
      // Update agents if specified
      if (metadata.agents) {
        // Remove existing agents
        const existingProcess = await this.getProcess(processId);
        if (existingProcess) {
          for (const agent of existingProcess.agents) {
            await this.removeAgent(processId, agent);
          }
          
          // Add new agents
          for (const agent of metadata.agents) {
            await this.addAgent(processId, agent);
          }
        }
      }
      
      // Update workflows if specified
      if (metadata.workflows) {
        // Remove existing workflows
        const existingProcess = await this.getProcess(processId);
        if (existingProcess) {
          for (const workflow of existingProcess.workflows) {
            await this.removeWorkflow(processId, workflow);
          }
          
          // Add new workflows
          for (const workflow of metadata.workflows) {
            await this.addWorkflow(processId, workflow);
          }
        }
      }
      
      // Update pricing if specified
      if (metadata.pricing) {
        await this.setProcessPricing(
          processId,
          metadata.pricing
        );
      }
      
      return true;
    } catch (error) {
      console.error('Error updating process:', error);
      return false;
    }
  }
  
  /**
   * Get process details by ID
   */
  public async getProcess(processId: string): Promise<ProcessMetadata | null> {
    try {
      const payload = {
        function: `${this.moduleAddress}::process_registry::get_process`,
        type_arguments: [],
        arguments: [processId]
      };
      
      const response = await this.aptosClient.view(payload);
      
      if (response && response.length >= 10) {
        const [
          id,
          name,
          owner,
          agents,
          workflows,
          tags,
          status,
          pricingOption,
          createdAt,
          updatedAt
        ] = response;
        
        // Get creator profile if available
        let creatorProfile: CreatorProfile | undefined;
        try {
          creatorProfile = await this.getCreatorProfile(owner as string);
        } catch (error) {
          console.warn('Creator profile not found for', owner);
        }
        
        // Parse pricing information
        let pricing: ProcessPricing | undefined;
        if (pricingOption && typeof pricingOption === 'object' && 'value' in pricingOption) {
          const pricingData = pricingOption.value as {
            task_price: string;
            currency: string;
            requires_prepayment: boolean;
          };
          
          pricing = {
            taskPrice: parseInt(pricingData.task_price),
            currency: pricingData.currency,
            paymentAddress: owner as string,
            requiresPrepayment: pricingData.requires_prepayment
          };
        }
        
        const statusValues: Record<number, 'active' | 'paused' | 'deprecated'> = {
          0: 'active',
          1: 'paused',
          2: 'deprecated'
        };
        
        return {
          id: id as string,
          name: name as string,
          description: '', // Set in blockchain but not returned by the get_process function
          owner: owner as string,
          agents: (agents as string[]) || [],
          workflows: (workflows as string[]) || [],
          tags: (tags as string[]) || [],
          status: statusValues[status as number] || 'active',
          pricing,
          url: '', // This needs to be set from an off-chain registry or from metadata
          creatorProfile,
          created_at: parseInt(createdAt as string),
          updated_at: parseInt(updatedAt as string)
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting process:', error);
      return null;
    }
  }
  
  /**
   * List processes based on search criteria
   */
  public async listProcesses(options?: ProcessSearchOptions): Promise<ProcessMetadata[]> {
    try {
      // If searching by owner, use specific function
      if (options?.owner) {
        return this.listProcessesByOwner(options.owner);
      }
      
      // If searching by tags, use specific function
      if (options?.tags && options.tags.length > 0) {
        return this.listProcessesByTag(options.tags[0]);
      }
      
      // Default to listing all processes
      const payload = {
        function: `${this.moduleAddress}::process_registry::list_all_processes`,
        type_arguments: [],
        arguments: []
      };
      
      const response = await this.aptosClient.view(payload);
      
      if (response && Array.isArray(response) && response.length > 0) {
        const processIds = response[0] as string[];
        
        // Fetch detailed information for each process
        const processes = await Promise.all(
          processIds.map(id => this.getProcess(id))
        );
        
        // Filter out null results and apply status filter if specified
        return processes
          .filter((p): p is ProcessMetadata => p !== null)
          .filter(p => !options?.status || p.status === options.status);
      }
      
      return [];
    } catch (error) {
      console.error('Error listing processes:', error);
      return [];
    }
  }
  
  /**
   * Deregister a process
   */
  public async deregisterProcess(
    account: AptosAccount | string,
    processId: string
  ): Promise<boolean> {
    try {
      const accountObj = typeof account === 'string' ? await this.getAccount() : account;
      
      const payload: Types.TransactionPayload = {
        type: 'entry_function_payload',
        function: `${this.moduleAddress}::process_registry::deregister_process`,
        type_arguments: [],
        arguments: [processId]
      };
      
      const rawTx = await this.aptosClient.generateTransaction(accountObj.address().toString(), payload);
      const signedTx = await this.aptosClient.signTransaction(accountObj, rawTx);
      const response = await this.aptosClient.submitTransaction(signedTx);
      
      // Wait for transaction to complete
      await this.aptosClient.waitForTransaction(response.hash);
      
      return true;
    } catch (error) {
      console.error('Error deregistering process:', error);
      return false;
    }
  }
  
  /**
   * List processes by owner
   */
  private async listProcessesByOwner(owner: string): Promise<ProcessMetadata[]> {
    try {
      const payload = {
        function: `${this.moduleAddress}::process_registry::list_processes_by_owner`,
        type_arguments: [],
        arguments: [owner]
      };
      
      const response = await this.aptosClient.view(payload);
      
      if (response && Array.isArray(response) && response.length > 0) {
        const processIds = response[0] as string[];
        
        // Fetch detailed information for each process
        const processes = await Promise.all(
          processIds.map(id => this.getProcess(id))
        );
        
        // Filter out null results
        return processes.filter((p): p is ProcessMetadata => p !== null);
      }
      
      return [];
    } catch (error) {
      console.error('Error listing processes by owner:', error);
      return [];
    }
  }
  
  /**
   * List processes by tag
   */
  private async listProcessesByTag(tag: string): Promise<ProcessMetadata[]> {
    try {
      const payload = {
        function: `${this.moduleAddress}::process_registry::list_processes_by_tag`,
        type_arguments: [],
        arguments: [tag]
      };
      
      const response = await this.aptosClient.view(payload);
      
      if (response && Array.isArray(response) && response.length > 0) {
        const processIds = response[0] as string[];
        
        // Fetch detailed information for each process
        const processes = await Promise.all(
          processIds.map(id => this.getProcess(id))
        );
        
        // Filter out null results
        return processes.filter((p): p is ProcessMetadata => p !== null);
      }
      
      return [];
    } catch (error) {
      console.error('Error listing processes by tag:', error);
      return [];
    }
  }
  
  /**
   * Get creator profile
   */
  private async getCreatorProfile(address: string): Promise<CreatorProfile | undefined> {
    try {
      const payload = {
        function: `${this.moduleAddress}::creator_profile::get_profile`,
        type_arguments: [],
        arguments: [address]
      };
      
      const response = await this.aptosClient.view(payload);
      
      if (response && response.length >= 5) {
        const [name, description, wallet, socialLinks, _] = response;
        
        // Parse social links if available
        const social: Record<string, string> = {};
        if (socialLinks && Array.isArray(socialLinks)) {
          for (let i = 0; i < socialLinks.length; i += 2) {
            const key = socialLinks[i];
            const value = socialLinks[i + 1];
            if (key && value) {
              social[key as string] = value as string;
            }
          }
        }
        
        return {
          name: name as string,
          description: description as string,
          walletAddress: wallet as string,
          social: Object.keys(social).length > 0 ? social : undefined
        };
      }
      
      return undefined;
    } catch (error) {
      console.error('Error getting creator profile:', error);
      return undefined;
    }
  }
  
  /**
   * Ensure creator profile exists, creating it if it doesn't
   */
  private async ensureCreatorProfileExists(
    address: string,
    profile: CreatorProfile
  ): Promise<boolean> {
    try {
      // Check if profile exists
      const exists = await this.creatorProfileExists(address);
      
      if (!exists) {
        // Create profile if it doesn't exist
        const account = await this.getAccount();
        
        // Convert social links to array format for Move
        const socialLinksArray: string[] = [];
        if (profile.social) {
          for (const [key, value] of Object.entries(profile.social)) {
            socialLinksArray.push(key);
            socialLinksArray.push(value);
          }
        }
        
        const payload: Types.TransactionPayload = {
          type: 'entry_function_payload',
          function: `${this.moduleAddress}::creator_profile::create_profile`,
          type_arguments: [],
          arguments: [
            profile.name,
            profile.description,
            address,
            socialLinksArray
          ]
        };
        
        const rawTx = await this.aptosClient.generateTransaction(account.address().toString(), payload);
        const signedTx = await this.aptosClient.signTransaction(account, rawTx);
        const response = await this.aptosClient.submitTransaction(signedTx);
        
        // Wait for transaction to complete
        await this.aptosClient.waitForTransaction(response.hash);
      }
      
      return true;
    } catch (error) {
      console.error('Error ensuring creator profile exists:', error);
      return false;
    }
  }
  
  /**
   * Check if creator profile exists
   */
  private async creatorProfileExists(address: string): Promise<boolean> {
    try {
      const payload = {
        function: `${this.moduleAddress}::creator_profile::profile_exists`,
        type_arguments: [],
        arguments: [address]
      };
      
      const response = await this.aptosClient.view(payload);
      return response[0] as boolean;
    } catch (error) {
      console.error('Error checking if creator profile exists:', error);
      return false;
    }
  }
  
  /**
   * Set process pricing
   */
  private async setProcessPricing(
    processId: string,
    pricing: ProcessPricing
  ): Promise<boolean> {
    try {
      const account = await this.getAccount();
      
      const payload: Types.TransactionPayload = {
        type: 'entry_function_payload',
        function: `${this.moduleAddress}::process_registry::set_pricing`,
        type_arguments: [],
        arguments: [
          processId,
          pricing.taskPrice.toString(),
          pricing.currency,
          pricing.requiresPrepayment
        ]
      };
      
      const rawTx = await this.aptosClient.generateTransaction(account.address().toString(), payload);
      const signedTx = await this.aptosClient.signTransaction(account, rawTx);
      const response = await this.aptosClient.submitTransaction(signedTx);
      
      // Wait for transaction to complete
      await this.aptosClient.waitForTransaction(response.hash);
      
      return true;
    } catch (error) {
      console.error('Error setting process pricing:', error);
      return false;
    }
  }
  
  /**
   * Add agent to process
   */
  private async addAgent(
    processId: string,
    agentAddress: string
  ): Promise<boolean> {
    try {
      const account = await this.getAccount();
      
      const payload: Types.TransactionPayload = {
        type: 'entry_function_payload',
        function: `${this.moduleAddress}::process_registry::add_agent`,
        type_arguments: [],
        arguments: [
          processId,
          agentAddress
        ]
      };
      
      const rawTx = await this.aptosClient.generateTransaction(account.address().toString(), payload);
      const signedTx = await this.aptosClient.signTransaction(account, rawTx);
      const response = await this.aptosClient.submitTransaction(signedTx);
      
      // Wait for transaction to complete
      await this.aptosClient.waitForTransaction(response.hash);
      
      return true;
    } catch (error) {
      console.error('Error adding agent to process:', error);
      return false;
    }
  }
  
  /**
   * Remove agent from process
   */
  private async removeAgent(
    processId: string,
    agentAddress: string
  ): Promise<boolean> {
    try {
      const account = await this.getAccount();
      
      const payload: Types.TransactionPayload = {
        type: 'entry_function_payload',
        function: `${this.moduleAddress}::process_registry::remove_agent`,
        type_arguments: [],
        arguments: [
          processId,
          agentAddress
        ]
      };
      
      const rawTx = await this.aptosClient.generateTransaction(account.address().toString(), payload);
      const signedTx = await this.aptosClient.signTransaction(account, rawTx);
      const response = await this.aptosClient.submitTransaction(signedTx);
      
      // Wait for transaction to complete
      await this.aptosClient.waitForTransaction(response.hash);
      
      return true;
    } catch (error) {
      console.error('Error removing agent from process:', error);
      return false;
    }
  }
  
  /**
   * Add workflow to process
   */
  private async addWorkflow(
    processId: string,
    workflowId: string
  ): Promise<boolean> {
    try {
      const account = await this.getAccount();
      
      const payload: Types.TransactionPayload = {
        type: 'entry_function_payload',
        function: `${this.moduleAddress}::process_registry::add_workflow`,
        type_arguments: [],
        arguments: [
          processId,
          workflowId
        ]
      };
      
      const rawTx = await this.aptosClient.generateTransaction(account.address().toString(), payload);
      const signedTx = await this.aptosClient.signTransaction(account, rawTx);
      const response = await this.aptosClient.submitTransaction(signedTx);
      
      // Wait for transaction to complete
      await this.aptosClient.waitForTransaction(response.hash);
      
      return true;
    } catch (error) {
      console.error('Error adding workflow to process:', error);
      return false;
    }
  }
  
  /**
   * Remove workflow from process
   */
  private async removeWorkflow(
    processId: string,
    workflowId: string
  ): Promise<boolean> {
    try {
      const account = await this.getAccount();
      
      const payload: Types.TransactionPayload = {
        type: 'entry_function_payload',
        function: `${this.moduleAddress}::process_registry::remove_workflow`,
        type_arguments: [],
        arguments: [
          processId,
          workflowId
        ]
      };
      
      const rawTx = await this.aptosClient.generateTransaction(account.address().toString(), payload);
      const signedTx = await this.aptosClient.signTransaction(account, rawTx);
      const response = await this.aptosClient.submitTransaction(signedTx);
      
      // Wait for transaction to complete
      await this.aptosClient.waitForTransaction(response.hash);
      
      return true;
    } catch (error) {
      console.error('Error removing workflow from process:', error);
      return false;
    }
  }
  
  /**
   * Get account for transactions
   * 
   * This is a placeholder for getting the account from environment or config
   * In a real implementation, this would be injected or provided securely
   */
  private async getAccount(): Promise<AptosAccount> {
    // This is a placeholder - in a real implementation, you would get the account
    // from a secure source or have it injected
    throw new Error('getAccount not implemented. You need to provide an account for transactions.');
  }
} 