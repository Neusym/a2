import { Agent as CoreAgent, AgentConfig as CoreAgentConfig, AgentMetadata, GenerateObjectResult, GenerateTextResult, StreamObjectResult, StreamTextResult, AiMessageType, a2 } from '../../../a2/dist';
import type { ZodSchema } from 'zod';
import type { JSONSchema7 } from '../../../a2/dist';

// Import provider-specific models to support string-based model creation
let openaiModule: any, anthropicModule: any;
try {
  // Dynamically import modules - use absolute imports to ensure they're found
  openaiModule = require('@ai-sdk/openai');
  anthropicModule = require('@ai-sdk/anthropic');
  
  // Log successful import
  console.log('Successfully imported provider modules:', {
    openai: !!openaiModule,
    anthropic: !!anthropicModule
  });
} catch (error) {
  console.error('Error importing provider modules:', error);
  // Silently fail, will handle missing modules in createAgent
}

/**
 * Simplified options for creating an agent
 */
export interface CreateAgentOptions {
  /**
   * Name of the agent
   */
  name: string;
  
  /**
   * Unique identifier for the agent (optional, will use name if not provided)
   */
  id?: string;
  
  /**
   * Instructions for the agent
   */
  instructions: string;
  
  /**
   * Model instance or configuration
   * 
   * You can provide either:
   * 1. A model name (like 'gpt-4') - must also provide provider and apiKey
   * 2. A pre-configured LanguageModelV1 instance from the AI SDK
   */
  model: string | any; // Type should be LanguageModelV1 from 'ai' but avoiding direct dependency
  
  /**
   * Provider of the model (e.g., 'openai', 'anthropic')
   * Only used when model is a string
   */
  provider?: 'openai' | 'anthropic' | 'custom';
  
  /**
   * API key for the model provider
   * Only used when model is a string
   */
  apiKey?: string;
  
  /**
   * Tools to make available to the agent
   */
  tools?: Record<string, any>;
  
  /**
   * Memory implementation for the agent
   */
  memory?: any;
  
  /**
   * Additional metadata to include
   */
  metadata?: Record<string, any>;
}

/**
 * Create an agent with simplified options
 * 
 * @example
 * ```typescript
 * // Using just model name, provider and apiKey
 * const agent = createAgent({
 *   name: 'My Assistant',
 *   instructions: 'You are a helpful assistant',
 *   model: 'gpt-4',
 *   provider: 'openai',
 *   apiKey: process.env.OPENAI_API_KEY
 * });
 * 
 * // Using a pre-configured model instance
 * import { OpenAI } from 'ai';
 * const model = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 * const agent = createAgent({
 *   name: 'My Assistant',
 *   instructions: 'You are a helpful assistant',
 *   model: model
 * });
 * ```
 * 
 * @param options Options for creating the agent
 * @returns A new Agent instance
 */
export function createAgent(options: CreateAgentOptions): CoreAgent {
  const {
    name,
    id = name.toLowerCase().replace(/\s+/g, '-'),
    instructions,
    model,
    provider = 'openai',
    apiKey,
    tools,
    memory,
    metadata: additionalMetadata
  } = options;
  
  // Create the agent metadata
  const metadata: AgentMetadata = {
    name,
    agentId: id,
    instructions,
    ...additionalMetadata
  };
  
  // Handle model creation based on different inputs
  let modelInstance: any;
  
  if (typeof model === 'string') {
    if (!apiKey) {
      throw new Error(`API key is required when providing a model name. Please provide an apiKey.`);
    }
    
    // Create model instance based on provider
    switch (provider) {
      case 'openai':
        if (!openaiModule) {
          console.error('OpenAI module not found');
          throw new Error("@ai-sdk/openai is required to use OpenAI models. Please install it with: pnpm add @ai-sdk/openai");
        }
        try {
          console.log('Creating OpenAI model instance with:', { apiKey: apiKey ? 'present' : 'missing', model });
          // Use the openai function from the module to create a model
          if (typeof openaiModule.openai === 'function') {
            // openai is a function that takes a model name
            const openai = openaiModule.openai;
            modelInstance = openai(model, { apiKey });
          } else if (typeof openaiModule.createOpenAI === 'function') {
            // Alternative approach using createOpenAI
            const createOpenAI = openaiModule.createOpenAI;
            const openai = createOpenAI({ apiKey });
            modelInstance = openai(model);
          } else {
            console.error('Available exports in OpenAI module:', Object.keys(openaiModule));
            throw new Error("Could not find OpenAI factory function in the imported module");
          }
        } catch (error) {
          console.error('Error creating OpenAI model instance:', error);
          throw error;
        }
        break;
        
      case 'anthropic':
        if (!anthropicModule) {
          console.error('Anthropic module not found');
          throw new Error("@ai-sdk/anthropic is required to use Anthropic models. Please install it with: pnpm add @ai-sdk/anthropic");
        }
        try {
          console.log('Creating Anthropic model instance with:', { apiKey: apiKey ? 'present' : 'missing', model });
          // Use the anthropic function from the module to create a model
          if (typeof anthropicModule.anthropic === 'function') {
            // anthropic is a function that takes a model name
            const anthropic = anthropicModule.anthropic;
            modelInstance = anthropic(model, { apiKey });
          } else if (typeof anthropicModule.createAnthropic === 'function') {
            // Alternative approach using createAnthropic
            const createAnthropic = anthropicModule.createAnthropic;
            const anthropic = createAnthropic({ apiKey });
            modelInstance = anthropic(model);
          } else {
            console.error('Available exports in Anthropic module:', Object.keys(anthropicModule));
            throw new Error("Could not find Anthropic factory function in the imported module");
          }
        } catch (error) {
          console.error('Error creating Anthropic model instance:', error);
          throw error;
        }
        break;
        
      case 'custom':
        throw new Error("For custom providers, you must provide a model instance directly, not a string model name.");
        
      default:
        throw new Error(`Unsupported provider: ${provider}. Please use 'openai' or 'anthropic', or provide a model instance directly.`);
    }
  } else if (model && typeof model === 'object') {
    // Use the provided model instance
    modelInstance = model;
  } else {
    throw new Error("Invalid model. Please provide either a model name (string) or a model instance.");
  }
  
  // Create the agent config
  const config: CoreAgentConfig = {
    metadata,
    model: modelInstance,
    memory,
    tools
  };
  
  // Use the core framework's createAgent function
  return a2.createAgent(config);
}

/**
 * Type for agent chain response
 */
export interface AgentChainResponse {
  /**
   * Final result from the last agent
   */
  result: string;
  
  /**
   * All responses from each agent in the chain
   */
  allResponses: string[];
}

/**
 * Simple message type for agent interactions
 */
export interface Message {
  role: string;
  content: string;
}

/**
 * Create a chain of agents that pass messages to each other
 * 
 * @param agents Array of agents to chain together
 * @returns Object with methods to interact with the chain
 */
export function createAgentChain(agents: CoreAgent[]) {
  if (agents.length < 2) {
    throw new Error('Agent chain requires at least 2 agents');
  }
  
  return {
    /**
     * Run a message through the agent chain
     * @param message Initial message to send to the first agent
     * @returns The final response from the last agent
     */
    async run(message: string): Promise<AgentChainResponse> {
      let currentMessage = message;
      const responses: string[] = [];
      
      for (const agent of agents) {
        const response = await agent.generate([
          { role: 'user', content: currentMessage }
        ]);
        
        // Handle both text and object results
        const responseText = 'text' in response 
          ? response.text 
          : JSON.stringify(response.object);
        
        responses.push(responseText);
        currentMessage = responseText;
      }
      
      return {
        result: currentMessage,
        allResponses: responses
      };
    }
  };
}

// Re-export types from core for SDK users
export type { 
  AgentMetadata,
  Message as CoreMessage,
  GenerateTextResult, 
  GenerateObjectResult,
  StreamTextResult,
  StreamObjectResult,
  JSONSchema7,
  AiMessageType
};

// Re-export the CoreAgent as Agent for SDK users
export { CoreAgent as Agent }; 