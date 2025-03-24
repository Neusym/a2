import { v4 as uuidv4 } from 'uuid';

import { CreatorProfile } from '../creator/interfaces';
import { DiscoveryService, ProcessMetadata } from '../discovery/interfaces';
import { PaymentService, ProcessPricing } from '../payment/interfaces';


// Basic placeholder for ProcessConfig
export interface ProcessConfig {
  [key: string]: any;
}

// Events enum
export enum ProcessEvent {
  AGENT_CREATED = 'agent:created',
  AGENT_DELETED = 'agent:deleted',
  WORKFLOW_CREATED = 'workflow:created',
  WORKFLOW_DELETED = 'workflow:deleted'
}

// Process class mock/placeholder - to be replaced with actual import from @a2/core
export class Process {
  private eventHandlers: Record<string, Array<(data?: unknown) => void>> = {};
  protected logger: Console = console;
  private agents: Record<string, any> = {};
  private workflow: any = null;
  
  constructor(_config?: ProcessConfig) {
    // Basic initialization
  }
  
  on(eventName: string, handler: (data?: unknown) => void): void {
    if (!this.eventHandlers[eventName]) {
      this.eventHandlers[eventName] = [];
    }
    this.eventHandlers[eventName].push(handler);
  }
  
  protected emit(eventName: string, data?: unknown): void {
    const handlers = this.eventHandlers[eventName] || [];
    for (const handler of handlers) {
      handler(data);
    }
  }
  
  getLogger(): Console {
    return this.logger;
  }
  
  getAgents(): Record<string, any> {
    return this.agents;
  }
  
  getWorkflow(): any {
    return this.workflow;
  }
  
  async initialize(): Promise<void> {
    console.log('Base process initialized');
  }
}

/**
 * Extended process configuration that includes discovery service
 */
export interface ExtendedProcessConfig extends ProcessConfig {
  /**
   * Discovery service for process registration
   */
  discoveryService?: DiscoveryService;
  
  /**
   * Payment service for handling payments
   */
  paymentService?: PaymentService;
  
  /**
   * Process metadata for discovery
   */
  metadata?: {
    name?: string;
    description?: string;
    tags?: string[];
    owner?: string;
    creatorProfile?: CreatorProfile;
    pricing?: {
      taskPrice: string; // price in tokens as string to avoid precision issues
      currency?: string; // default is blockchain native token
      paymentAddress?: string; // wallet to receive payments
      requiresPrepayment?: boolean; // whether payment is required before process execution
    };
  };
}

/**
 * Extended Process class with discovery and payment capabilities
 * 
 * This class extends the core Process class with the ability to
 * register itself with a discovery service and handle payments.
 */
export class ExtendedProcess extends Process {
  private discoveryService?: DiscoveryService;
  private paymentService?: PaymentService;
  private processId: string;
  private metadata: Partial<ProcessMetadata>;
  private registered = false;
  
  /**
   * Creates a new Extended Process instance
   * 
   * @param config Optional configuration object
   */
  constructor(config?: ExtendedProcessConfig) {
    super(config);
    
    // Generate a unique ID for this process
    this.processId = uuidv4();
    
    // Initialize services if provided
    this.discoveryService = config?.discoveryService;
    this.paymentService = config?.paymentService;
    
    // Initialize metadata
    this.metadata = {
      name: config?.metadata?.name || `Process-${this.processId.substring(0, 8)}`,
      description: config?.metadata?.description,
      tags: config?.metadata?.tags || [],
      owner: config?.metadata?.owner || 'anonymous',
      creatorProfile: config?.metadata?.creatorProfile,
      pricing: config?.metadata?.pricing ? {
        taskPrice: config.metadata.pricing.taskPrice,
        currency: config.metadata.pricing.currency || 'APT',
        paymentAddress: config.metadata.pricing.paymentAddress,
        requiresPrepayment: config.metadata.pricing.requiresPrepayment ?? true
      } : undefined
    };
    
    // Register with discovery when agents or workflows are created
    this.on(ProcessEvent.AGENT_CREATED, this.handleAgentCreated.bind(this));
    this.on(ProcessEvent.WORKFLOW_CREATED, this.handleWorkflowCreated.bind(this));
    this.on(ProcessEvent.AGENT_DELETED, this.handleAgentDeleted.bind(this));
    this.on(ProcessEvent.WORKFLOW_DELETED, this.handleWorkflowDeleted.bind(this));
    
    // Log initialization
    this.getLogger().info('Initializing Extended Process with discovery capabilities', {
      processId: this.processId,
      discoveryEnabled: !!this.discoveryService,
      paymentEnabled: !!this.paymentService
    });
  }
  
  /**
   * Initializes the process and registers with discovery service
   */
  async initialize(): Promise<void> {
    // Initialize the base process
    await super.initialize();
    
    // Register with discovery service if available
    if (this.discoveryService) {
      await this.registerWithDiscovery();
    }
  }
  
  /**
   * Gets the unique process ID
   */
  getProcessId(): string {
    return this.processId;
  }
  
  /**
   * Sets the discovery service
   * 
   * @param service Discovery service instance
   */
  setDiscoveryService(service: DiscoveryService): void {
    this.discoveryService = service;
    this.getLogger().info('Discovery service set', { processId: this.processId });
    
    // Register with discovery if not already registered
    if (!this.registered && this.discoveryService) {
      this.registerWithDiscovery().catch(error => {
        this.getLogger().error('Failed to register with discovery service', { error });
      });
    }
  }
  
  /**
   * Gets the discovery service
   */
  getDiscoveryService(): DiscoveryService | undefined {
    return this.discoveryService;
  }
  
  /**
   * Updates metadata for the process
   * 
   * @param metadata Updated metadata
   */
  async updateMetadata(metadata: Partial<ProcessMetadata>): Promise<void> {
    // Update local metadata
    this.metadata = { ...this.metadata, ...metadata };
    
    // Update in discovery service if registered
    if (this.registered && this.discoveryService) {
      try {
        await this.discoveryService.updateProcess(this.processId, metadata);
        this.getLogger().info('Process metadata updated in discovery service', { 
          processId: this.processId 
        });
      } catch (error) {
        this.getLogger().error('Failed to update process metadata in discovery service', { 
          processId: this.processId, 
          error 
        });
        throw error;
      }
    }
  }
  
  /**
   * Registers the process with the discovery service
   * @private
   */
  private async registerWithDiscovery(): Promise<void> {
    if (!this.discoveryService) {
      return;
    }
    
    try {
      // Build full process metadata
      const metadata: ProcessMetadata = {
        id: this.processId,
        name: this.metadata.name as string,
        description: this.metadata.description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        agents: this.buildAgentsMetadata(),
        workflows: this.buildWorkflowsMetadata(),
        tags: this.metadata.tags,
        owner: this.metadata.owner as string,
        status: 'active'
      };
      
      // Register with discovery service
      await this.discoveryService.registerProcess(this.processId, metadata);
      this.registered = true;
      
      this.getLogger().info('Process registered with discovery service', { 
        processId: this.processId 
      });
    } catch (error) {
      this.getLogger().error('Failed to register process with discovery service', { 
        processId: this.processId, 
        error 
      });
      throw error;
    }
  }
  
  /**
   * Updates the process registration with the discovery service
   * @private
   */
  private async updateDiscoveryRegistration(): Promise<void> {
    if (!this.discoveryService || !this.registered) {
      return;
    }
    
    try {
      // Update just the agents and workflows
      const updateData: Partial<ProcessMetadata> = {
        updatedAt: new Date().toISOString(),
        agents: this.buildAgentsMetadata(),
        workflows: this.buildWorkflowsMetadata()
      };
      
      // Update discovery service
      await this.discoveryService.updateProcess(this.processId, updateData);
      
      this.getLogger().info('Process registration updated in discovery service', { 
        processId: this.processId 
      });
    } catch (error) {
      this.getLogger().error('Failed to update process registration in discovery service', { 
        processId: this.processId, 
        error 
      });
      // Don't throw, just log the error
    }
  }
  
  /**
   * Builds metadata about the current agents
   * @private
   */
  private buildAgentsMetadata(): Array<{
    id: string;
    name?: string;
    instructions?: string;
    goal?: string;
    role?: string;
  }> {
    const agents = this.getAgents();
    return Object.entries(agents).map(([id, _agent]) => {
      // In a real implementation, we would get metadata from the agent
      return {
        id,
        name: id, // Using id as name for placeholder
        instructions: 'placeholder',
        goal: 'placeholder',
        role: 'placeholder'
      };
    });
  }
  
  /**
   * Builds metadata about the current workflows
   * @private
   */
  private buildWorkflowsMetadata(): Array<{
    id: string;
    name?: string;
    description?: string;
  }> {
    const workflow = this.getWorkflow();
    if (!workflow) {
      return [];
    }
    
    // In a real implementation, we would get metadata from the workflow
    return [{
      id: 'workflow-1',
      name: 'Workflow 1',
      description: 'Placeholder workflow'
    }];
  }
  
  /**
   * Handles agent created event
   * @private
   */
  private handleAgentCreated(): void {
    this.updateDiscoveryRegistration().catch(error => {
      this.getLogger().error('Failed to update discovery after agent creation', { error });
    });
  }
  
  /**
   * Handles workflow created event
   * @private
   */
  private handleWorkflowCreated(): void {
    this.updateDiscoveryRegistration().catch(error => {
      this.getLogger().error('Failed to update discovery after workflow creation', { error });
    });
  }
  
  /**
   * Handles agent deleted event
   * @private
   */
  private handleAgentDeleted(): void {
    this.updateDiscoveryRegistration().catch(error => {
      this.getLogger().error('Failed to update discovery after agent deletion', { error });
    });
  }
  
  /**
   * Handles workflow deleted event
   * @private
   */
  private handleWorkflowDeleted(): void {
    this.updateDiscoveryRegistration().catch(error => {
      this.getLogger().error('Failed to update discovery after workflow deletion', { error });
    });
  }
  
  /**
   * Deregisters from the discovery service
   */
  async deregister(): Promise<void> {
    if (this.discoveryService && this.registered) {
      try {
        await this.discoveryService.deregisterProcess(this.processId);
        this.registered = false;
        
        this.getLogger().info('Process deregistered from discovery service', { 
          processId: this.processId 
        });
      } catch (error) {
        this.getLogger().error('Failed to deregister process from discovery service', { 
          processId: this.processId, 
          error 
        });
        throw error;
      }
    }
  }
  
  /**
   * Check if the task has been paid for by the given user
   * 
   * @param userWalletAddress The user's wallet address
   * @returns A promise that resolves to a boolean indicating if payment is verified
   */
  async verifyPayment(userWalletAddress: string): Promise<boolean> {
    // If no pricing is set, no payment is required
    if (!this.metadata.pricing) {
      return true;
    }
    
    // If prepayment is not required, no verification needed
    if (this.metadata.pricing.requiresPrepayment === false) {
      return true;
    }
    
    // If no payment service is set, we can't verify
    if (!this.paymentService) {
      this.getLogger().warn('Payment verification requested but no payment service provided', {
        processId: this.processId
      });
      return false;
    }
    
    // If no payment address is set, we can't verify
    if (!this.metadata.pricing.paymentAddress) {
      this.getLogger().warn('Payment verification requested but no payment address set', {
        processId: this.processId
      });
      return false;
    }
    
    // Verify payment using payment service
    const result = await this.paymentService.verifyPayment(
      userWalletAddress,
      this.processId,
      "task-default" // Default task ID if no specific task is specified
    );
    
    this.getLogger().info('Payment verification result', {
      processId: this.processId,
      userWallet: userWalletAddress,
      verified: result.verified,
      error: result.error
    });
    
    return result.verified;
  }
  
  /**
   * Get payment instructions for this process
   * 
   * @param userWalletAddress User's wallet address
   * @returns Payment instructions as a string
   */
  getPaymentInstructions(userWalletAddress: string): string {
    if (!this.metadata.pricing) {
      return 'This process does not require payment.';
    }
    
    if (!this.paymentService) {
      return 'Payment service not configured. Please contact the process owner.';
    }
    
    return this.paymentService.getPaymentInstructions(
      this.metadata.pricing as ProcessPricing,
      userWalletAddress
    );
  }
  
  /**
   * Run the process if payment is verified (if required)
   * 
   * @param userWalletAddress The wallet address of the user running the process
   */
  async runWithPaymentCheck(userWalletAddress: string): Promise<void> {
    // Check if payment is required and verified
    if (this.metadata.pricing?.requiresPrepayment) {
      const isPaid = await this.verifyPayment(userWalletAddress);
      if (!isPaid) {
        const requiredAmount = this.metadata.pricing.taskPrice;
        const currency = this.metadata.pricing.currency || 'APT';
        
        // Get payment instructions
        const instructions = this.getPaymentInstructions(userWalletAddress);
        
        throw new Error(
          `Payment required: ${requiredAmount} ${currency}. ` +
          `\n\n${instructions}`
        );
      }
    }
    
    // If payment is verified or not required, run the process
    await this.run();
  }
  
  /**
   * Starts running the process
   */
  async run(): Promise<void> {
    console.log(`Process ${this.processId} is running`);
    // Placeholder for actual process execution
  }
} 