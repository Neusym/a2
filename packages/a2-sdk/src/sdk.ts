import { a2, CoreComponent, ComponentConfig, RegisteredLogger } from '@a2/core';

import { createAgent } from './agents';
import { createMemory } from './memory';
import { createProcess } from './processes';
import { createResource } from './resources';
import { createTool } from './tools';
import { createWorkflow } from './workflows';

/**
 * Configuration options for the A2SDK
 */
export interface A2SDKConfig {
  /**
   * Default API key for models
   */
  apiKey?: string;
  
  /**
   * Default model provider
   */
  defaultProvider?: 'openai' | 'anthropic' | 'custom';
  
  /**
   * Default model name
   */
  defaultModel?: string;
  
  /**
   * Logger configuration
   */
  logger?: any;
  
  /**
   * SDK component name
   */
  name?: string;
  
  /**
   * Additional configuration options for core components
   */
  coreOptions?: ComponentConfig;
}

/**
 * Main SDK class that provides easy access to the a2 framework functionality
 */
export class A2SDK extends CoreComponent {
  private sdkConfig: A2SDKConfig;
  private initialized: boolean = false;

  /**
   * Create a new instance of the A2SDK
   * @param config Configuration options
   */
  constructor(config: A2SDKConfig = {}) {
    // Initialize as a CoreComponent with the SDK configuration
    const coreConfig: ComponentConfig = {
      component: RegisteredLogger.AGENT,
      name: config.name || 'a2-sdk',
      logger: config.logger,
      ...config.coreOptions
    };
    
    super(coreConfig);
    
    this.sdkConfig = {
      apiKey: config.apiKey,
      defaultProvider: config.defaultProvider || 'openai',
      defaultModel: config.defaultModel || 'gpt-3.5-turbo',
    };
    
    this.debug('A2SDK initialized with configuration', { 
      defaultProvider: this.sdkConfig.defaultProvider,
      defaultModel: this.sdkConfig.defaultModel
    });
    
    this.initialized = true;
  }

  /**
   * Initialize the SDK and core components
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.debug('SDK already initialized');
      return;
    }
    
    try {
      await this.start();
      this.initialized = true;
      this.debug('SDK successfully initialized');
    } catch (error) {
      this.error('Failed to initialize SDK', { error });
      throw error;
    }
  }

  /**
   * Create an agent with simplified configuration
   */
  createAgent = (options: Parameters<typeof createAgent>[0]) => {
    const enhancedOptions = this.enhanceCreatorOptions(options);
    return createAgent(enhancedOptions);
  };

  /**
   * Create a process with simplified configuration
   */
  createProcess = (options: Parameters<typeof createProcess>[0]) => {
    const enhancedOptions = this.enhanceCreatorOptions(options);
    return createProcess(enhancedOptions);
  };

  /**
   * Create a workflow with simplified configuration
   */
  createWorkflow = (options: Parameters<typeof createWorkflow>[0]) => {
    const enhancedOptions = this.enhanceCreatorOptions(options);
    return createWorkflow(enhancedOptions);
  };

  /**
   * Create a memory instance with simplified configuration
   */
  createMemory = (options: Parameters<typeof createMemory>[0]) => {
    const enhancedOptions = this.enhanceCreatorOptions(options);
    return createMemory(enhancedOptions);
  };

  /**
   * Create a tool with simplified configuration
   */
  createTool = (options: Parameters<typeof createTool>[0]) => {
    const enhancedOptions = this.enhanceCreatorOptions(options);
    return createTool(enhancedOptions);
  };

  /**
   * Create a resource with simplified configuration
   */
  createResource = (options: Parameters<typeof createResource>[0]) => {
    const enhancedOptions = this.enhanceCreatorOptions(options);
    return createResource(enhancedOptions);
  };

  /**
   * Enhance creator options with default SDK configuration
   * @param options Original options provided to the creator method
   * @returns Enhanced options with SDK defaults applied
   */
  private enhanceCreatorOptions<T extends Record<string, any>>(options: T): T {
    // Apply SDK defaults if not specified in the options
    const enhanced = { ...options } as T & { apiKey?: string, provider?: string, model?: string };
    
    if (!enhanced.apiKey && this.sdkConfig.apiKey) {
      enhanced.apiKey = this.sdkConfig.apiKey;
    }
    
    if (!enhanced.provider && this.sdkConfig.defaultProvider) {
      enhanced.provider = this.sdkConfig.defaultProvider;
    }
    
    if (!enhanced.model && this.sdkConfig.defaultModel) {
      enhanced.model = this.sdkConfig.defaultModel;
    }
    
    return enhanced as T;
  }

  /**
   * Get the underlying a2 framework instance
   * Use this when you need direct access to the core framework features
   */
  get core() {
    return a2;
  }

  /**
   * Get the version information
   */
  get version() {
    return {
      sdk: '0.1.0',
      core: a2.version.number
    };
  }
}

/**
 * Create a new SDK instance
 * @param config Configuration options
 * @returns A new A2SDK instance
 */
export const createSDK = (config: A2SDKConfig = {}): A2SDK => {
  return new A2SDK(config);
};

/**
 * Default SDK instance
 */
export default new A2SDK(); 