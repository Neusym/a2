import { CoreMessage, LanguageModelV1 } from 'ai';
import { ZodSchema } from 'zod';

import { Logger, createAgentLogger } from '../logger';
import { LogLevel } from '../logger/types';
import { Memory } from '../memory';
import { Model } from '../provider/model';
import { ToolChoice } from '../provider/types';
import { DefaultResourceManager } from '../resource/manager';
import { CoreTool } from '../tools/types';

import {
  AgentConfig,
  AgentGenerateOptions,
  AgentStreamOptions,
  AiMessageType,
  GenerateObjectResult,
  GenerateTextResult,
  JSONSchema7,
  StreamObjectResult,
  StreamTextResult,
  ToolChoiceType,
  ToolsInput,
  ToolsetsInput,
  AgentMetadata,
  AsyncIterableWithSymbol,
} from './types';
import { ensureToolProperties, isVercelTool } from './utils';

/**
 * Agent class that orchestrates AI model, tools, and memory
 */
export class Agent<TTools extends ToolsInput = ToolsInput> {
  public metadata: AgentMetadata;
  public model: Model;
  public tools: TTools = {} as TTools;
  private memory?: Memory;
  private resourceManager?: DefaultResourceManager;
  private logger: Logger;

  /**
   * Create a new Agent instance
   */
  constructor(config: AgentConfig<TTools>) {
    // Initialize metadata object
    this.metadata = config.metadata;

    // Create a model wrapper based on what was provided
    if ('modelName' in config.model) {
      // Check for apiKey - required for model creation
      if (!('apiKey' in config.model)) {
        throw new Error(
          'API key is required when providing a model configuration. Please add apiKey to your model config.',
        );
      }

      try {
        // Use the fromConfig method to create a model from config
        this.model = Model.fromConfig(config.model as any);
      } catch (error) {
        throw new Error(
          `Failed to create model from config: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else {
      // We have a LanguageModelV1 instance
      this.model = new Model(config.model as LanguageModelV1);
    }

    this.memory = config.memory;

    // Create a logger for this agent
    this.logger = createAgentLogger({
      agentId: this.metadata.agentId,
      level: LogLevel.INFO,
    });

    if (config.tools) {
      this.configureTools(config.tools);
    }

    // Initialize resourceManager if provided in config
    if (config.resourceManager) {
      this.resourceManager = config.resourceManager;
      this.logger.info('Resource manager initialized');
    }
  }

  /**
   * Get the memory instance for this agent
   */
  getMemory(): Memory | undefined {
    return this.memory;
  }

  /**
   * Get the resource manager for this agent
   */
  getResourceManager(): DefaultResourceManager | undefined {
    return this.resourceManager;
  }

  /**
   * Get the agent's name
   */
  getName(): string {
    return this.metadata.name;
  }

  /**
   * Get the agent's ID
   */
  getAgentId(): string {
    return this.metadata.agentId;
  }

  /**
   * Get the agent's instructions
   */
  getInstructions(): string {
    return this.metadata.instructions;
  }

  /**
   * Get the agent's goal
   */
  getGoal(): string | undefined {
    return this.metadata.goal;
  }

  /**
   * Get the agent's role
   */
  getRole(): string | undefined {
    return this.metadata.role;
  }

  /**
   * Update the agent's instructions
   * @private
   */
  updateInstructions(newInstructions: string): void {
    this.metadata.instructions = newInstructions;
    this.logger.info('Instructions updated', { instructions: newInstructions });
  }

  /**
   * Set tools for the agent
   * @private
   */
  configureTools(tools: TTools): void {
    // Process and validate tools
    const processedTools: Record<string, CoreTool> = {};

    for (const [key, tool] of Object.entries(tools)) {
      if (isVercelTool(tool)) {
        processedTools[key] = ensureToolProperties(tool as CoreTool);
      }
    }

    this.tools = processedTools as TTools;
    this.logger.info('Tools set', { toolCount: Object.keys(processedTools).length });
  }

  /**
   * Generate a title from a user message
   */
  async generateTitleFromUserMessage({ message }: { message: CoreMessage }): Promise<string> {
    // Generate a title based on the user message
    const content =
      typeof message.content === 'string' ? message.content : JSON.stringify(message.content);

    return `Conversation about ${content.substring(0, 30)}...`;
  }

  /**
   * Sanitize response messages
   */
  sanitizeResponseMessages(messages: CoreMessage[]): CoreMessage[] {
    // Clean up and process messages before storing/returning
    return messages.map((message) => {
      // Create a copy to avoid mutating the original
      const sanitizedMessage = { ...message };

      // Ensure content is properly formatted if it's a string
      if (typeof sanitizedMessage.content === 'string') {
        // Remove potentially harmful content
        if (
          sanitizedMessage.content.includes('<script>') ||
          sanitizedMessage.content.includes('javascript:')
        ) {
          sanitizedMessage.content = sanitizedMessage.content
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, 'removed:');
        }

        // Trim excessively long content
        if (sanitizedMessage.content.length > 10000) {
          sanitizedMessage.content =
            sanitizedMessage.content.substring(0, 10000) + '... (truncated)';
        }
      }

      return sanitizedMessage;
    });
  }

  /**
   * Convert tools for model consumption
   */
  convertTools({
    toolsets,
    threadId,
    resourceId,
    runId,
  }: {
    toolsets?: ToolsetsInput;
    threadId?: string;
    resourceId?: string;
    runId?: string;
  }): Record<string, any> {
    // Convert tools to a format usable by the AI model
    const convertedTools: Record<string, any> = {};

    // Add agent's default tools
    Object.entries(this.tools).forEach(([key, tool]) => {
      convertedTools[key] = {
        description: tool.description,
        parameters: tool.parameters,
      };
    });

    // Add any additional toolsets
    if (toolsets) {
      Object.entries(toolsets).forEach(([setName, tools]) => {
        Object.entries(tools).forEach(([toolName, tool]) => {
          const fullToolName = `${setName}.${toolName}`;
          convertedTools[fullToolName] = {
            description: tool.description,
            parameters: tool.parameters,
          };
        });
      });
    }

    // Use resourceManager if available to enhance tools with resources
    if (this.resourceManager && resourceId) {
      this.logger.debug('Adding resources to tools', { resourceId });

      try {
        // Get resources for the given resourceId
        const resource = this.resourceManager.getResource(resourceId);

        // Add resource content to relevant tools
        if (resource && resource.type === 'document') {
          // Example: Add document content to a search tool
          if (convertedTools['search']) {
            convertedTools['search'].description += ` Available document: ${resource.id}`;
          }

          // Add a context tool with the resource content
          convertedTools['useContext'] = {
            description: `Use context from ${resource.id} to answer the question`,
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The specific information to look up in the context',
                },
              },
              required: ['query'],
            },
          };
        }

        // Add any available prompts as tools
        const prompts = this.resourceManager.listPrompts();
        if (prompts.length > 0) {
          convertedTools['usePrompt'] = {
            description: 'Use a specific prompt template',
            parameters: {
              type: 'object',
              properties: {
                promptName: {
                  type: 'string',
                  description: 'The name of the prompt to use',
                  enum: prompts,
                },
                parameters: {
                  type: 'object',
                  description: 'Parameters to fill in the prompt template',
                },
              },
              required: ['promptName'],
            },
          };
        }
      } catch (error) {
        this.logger.error('Error adding resources to tools', {
          error: error instanceof Error ? error.message : String(error),
          resourceId,
        });
      }
    }

    return convertedTools;
  }

  /**
   * Prepare messages and memory before execution
   */
  async preExecute({
    resourceId,
    runId,
    threadId,
    memoryConfig,
    messages,
  }: {
    runId?: string;
    threadId: string;
    memoryConfig?: any;
    messages: CoreMessage[];
    resourceId: string;
  }): Promise<{ messages: CoreMessage[]; memory?: Memory }> {
    // If no memory configured, process with resourceManager and return
    if (!this.memory) {
      return this.processResourceContext({ messages, resourceId });
    }

    return this.setupAndQueryMemory({
      threadId,
      resourceId,
      memoryConfig,
      messages,
    });
  }

  /**
   * Set up and query memory for conversation context
   * @private
   */
  private async setupAndQueryMemory({
    threadId,
    resourceId,
    memoryConfig,
    messages,
  }: {
    threadId: string;
    resourceId: string;
    memoryConfig?: any;
    messages: CoreMessage[];
  }): Promise<{ messages: CoreMessage[]; memory?: Memory }> {
    this.logger.debug('Setting up memory for execution', { threadId, resourceId });

    try {
      // Make sure thread exists
      await this.ensureThreadExists(threadId, resourceId);

      // Store messages in memory if they're not already there
      await this.storeUserMessages(threadId, messages);

      // Query for messages
      const { messages: memoryMessages } = await this.memory!.query({
        threadId,
        resourceId,
        selectBy: 'last',
        limit: memoryConfig?.lastMessages || 10,
      });

      return { messages: memoryMessages, memory: this.memory };
    } catch (error) {
      this.logger.error('Memory operation failed', {
        error: error instanceof Error ? error.message : String(error),
        threadId,
        resourceId,
      });
      // Fall back to using the provided messages
      return { messages };
    }
  }

  /**
   * Ensure thread exists in memory
   * @private
   */
  private async ensureThreadExists(threadId: string, resourceId: string): Promise<void> {
    const thread = await this.memory!.getThreadById({ threadId });
    if (!thread) {
      await this.memory!.createThread({
        threadId,
        resourceId,
        title: `Conversation with ${this.metadata.name}`,
      });
    }
  }

  /**
   * Store user messages in memory
   * @private
   */
  private async storeUserMessages(threadId: string, messages: CoreMessage[]): Promise<void> {
    for (const message of messages) {
      if (message.role === 'user') {
        const content = typeof message.content === 'string' ? message.content : message.content;

        await this.memory!.addMessage({
          threadId,
          content,
          role: 'user',
          type: 'text',
        });
      }
    }
  }

  /**
   * Process resource context when memory is not available
   * @private
   */
  private async processResourceContext({
    messages,
    resourceId,
  }: {
    messages: CoreMessage[];
    resourceId: string;
  }): Promise<{ messages: CoreMessage[] }> {
    // If resourceManager is available, utilize it
    if (!this.resourceManager || !resourceId) {
      return { messages };
    }

    this.logger.debug('Using resource manager for execution', { resourceId });

    try {
      // Check if resource exists
      const resource = this.resourceManager.getResource(resourceId);

      // If the resource exists, we can potentially enhance the messages
      if (resource) {
        messages = this.enhanceMessagesWithResource(messages, resource);
      }
    } catch (error) {
      this.logger.error('Error using resource manager', {
        error: error instanceof Error ? error.message : String(error),
        resourceId,
      });
    }

    return { messages };
  }

  /**
   * Enhance messages with resource content
   * @private
   */
  private enhanceMessagesWithResource(messages: CoreMessage[], resource: any): CoreMessage[] {
    // Add a system message with context based on the resource type
    if (resource.type === 'document' || resource.type === 'knowledge') {
      const contextMessage: CoreMessage = {
        role: 'system',
        content:
          `This conversation is related to the ${resource.type} "${resource.id}". ` +
          `Use this context: ${resource.content.substring(0, 500)}...`,
      };

      // Insert the context message at the beginning
      return [contextMessage, ...messages];
    }

    // Handle other resource types as needed
    if (resource.type === 'persona') {
      const personaMessage: CoreMessage = {
        role: 'system',
        content: `Please respond as the following persona: ${resource.content}`,
      };

      // Insert the persona message at the beginning
      return [personaMessage, ...messages];
    }

    return messages;
  }

  /**
   * Convert toolChoice to a format compatible with the provider
   * @private
   */
  private normalizeToolChoice(toolChoice?: ToolChoiceType): ToolChoice | undefined {
    if (!toolChoice) return undefined;

    if (typeof toolChoice === 'string') {
      // Filter out 'required' which isn't in ToolChoice
      if (toolChoice === 'required') {
        return 'auto' as ToolChoice; // Convert 'required' to 'auto' as fallback
      }
      return toolChoice as ToolChoice;
    }

    if ('function' in toolChoice) {
      // Convert from OpenAI format to Vercel AI SDK format
      return { type: 'tool', toolName: toolChoice.function.name } as ToolChoice;
    }

    return toolChoice as ToolChoice;
  }

  /**
   * Generate a response using the agent
   */
  async generate<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    messages: string | string[] | CoreMessage[] | AiMessageType[],
    args?: AgentGenerateOptions<Z>,
  ): Promise<GenerateTextResult<any, any> | GenerateObjectResult<any>> {
    // Normalize messages
    const normalizedMessages = this.normalizeMessages(messages);

    // Setup memory and context
    const threadId = args?.threadId || `thread_${Date.now()}`;
    const resourceId = args?.resourceId || `resource_${Date.now()}`;
    const runId = args?.runId || `run_${Date.now()}`;

    this.logger.info('Generating response', { threadId, resourceId, runId });

    try {
      const { messages: preparedMessages } = await this.preExecute({
        resourceId,
        runId,
        threadId,
        memoryConfig: args?.memoryOptions,
        messages: normalizedMessages,
      });

      // Convert tools for the model
      const tools = this.convertTools({
        toolsets: args?.toolsets,
        threadId,
        resourceId,
        runId,
      });

      // Convert toolChoice to a format compatible with the Model
      const toolChoice = this.normalizeToolChoice(args?.toolChoice);

      if (args?.output || args?.experimental_output) {
        // Generate object response using the model
        const schema = args?.output || args?.experimental_output;
        if (!schema) {
          throw new Error('Schema is required for object generation');
        }

        // Handle different schema types
        if ('parse' in schema) {
          // It's a Zod schema
          try {
            const result = await this.model.generateObject(
              this.metadata.instructions,
              schema as any,
              {
                messages: preparedMessages.map((msg) => ({
                  role: msg.role,
                  content:
                    typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
                })),
                tools: Object.keys(tools).length > 0 ? tools : undefined,
                toolChoice,
                maxSteps: args?.maxSteps || 3, // Allow up to 3 tool call steps by default
              },
            );

            return { object: result };
          } catch (error) {
            this.logger.error('Model generation error', {
              error: error instanceof Error ? error.message : String(error),
              threadId,
              resourceId,
            });
            throw new Error(
              `Failed to generate object response: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
          }
        } else {
          // JSON Schema, but we need to handle it differently since we don't have direct JSON Schema support
          try {
            const result = await this.model.generateText(this.metadata.instructions, {
              messages: preparedMessages.map((msg) => ({
                role: msg.role,
                content:
                  typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
              })),
              tools: Object.keys(tools).length > 0 ? tools : undefined,
              toolChoice,
              maxSteps: args?.maxSteps || 3, // Allow up to 3 tool call steps by default
            });

            try {
              // Try to parse the result as JSON
              return { object: JSON.parse(result) };
            } catch (parseError) {
              this.logger.error('Failed to parse JSON result', {
                error: parseError instanceof Error ? parseError.message : String(parseError),
                result,
              });

              // Attempt to fix common JSON parsing issues
              const fixedResult = this.attemptToFixJSON(result);
              try {
                return { object: JSON.parse(fixedResult) };
              } catch (secondParseError) {
                this.logger.error('Failed to parse fixed JSON result', {
                  error:
                    secondParseError instanceof Error
                      ? secondParseError.message
                      : String(secondParseError),
                });
                // Return the text as is if we can't parse it
                return { object: result };
              }
            }
          } catch (error) {
            this.logger.error('Model generation error', {
              error: error instanceof Error ? error.message : String(error),
              threadId,
              resourceId,
            });
            throw new Error(
              `Failed to generate text for JSON parsing: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
          }
        }
      } else {
        // Generate text response
        try {
          const result = await this.model.generateText(this.metadata.instructions, {
            messages: preparedMessages.map((msg) => ({
              role: msg.role,
              content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
            })),
            tools: Object.keys(tools).length > 0 ? tools : undefined,
            toolChoice,
            maxSteps: args?.maxSteps || 3, // Allow up to 3 tool call steps by default
          });

          // Save the response to memory if available
          if (this.memory) {
            try {
              await this.memory.addMessage({
                threadId,
                content: result,
                role: 'assistant',
                type: 'text',
              });
            } catch (memoryError) {
              this.logger.error('Failed to save response to memory', {
                error: memoryError instanceof Error ? memoryError.message : String(memoryError),
                threadId,
              });
              // Continue even if memory storage fails
            }
          }

          return {
            text: result,
            extra: { threadId, resourceId, runId },
          };
        } catch (error) {
          this.logger.error('Model generation error', {
            error: error instanceof Error ? error.message : String(error),
            threadId,
            resourceId,
          });
          throw new Error(
            `Failed to generate text response: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }
    } catch (error) {
      this.logger.error('Agent generation failed', {
        error: error instanceof Error ? error.message : String(error),
        threadId,
        resourceId,
      });
      throw error; // Re-throw the error for the caller to handle
    }
  }

  /**
   * Attempts to fix common JSON formatting issues from LLM outputs
   * @private
   */
  private attemptToFixJSON(jsonString: string): string {
    // Log the original JSON for debugging purposes
    this.logger.debug('Attempting to fix JSON', { originalJSON: jsonString });

    let result = jsonString.trim();

    try {
      // First try to parse it directly - if it works, no need for fixes
      JSON.parse(result);
      return result;
    } catch (error) {
      // JSON is invalid, attempt fixes
      this.logger.debug('Invalid JSON, applying fixes', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Remove any markdown code block markers
      result = result.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '');

      // Fix missing quotes around property names
      result = result.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');

      // Fix single quotes used instead of double quotes
      result = result.replace(/'/g, '"');

      // Fix trailing commas in arrays and objects
      result = result.replace(/,\s*([}\]])/g, '$1');

      // Add missing braces if needed
      if (!result.startsWith('{') && !result.startsWith('[')) {
        result = '{' + result;
      }

      if (!result.endsWith('}') && !result.endsWith(']')) {
        result = result + '}';
      }

      // Verify the fixed JSON is valid
      try {
        JSON.parse(result);
        this.logger.debug('JSON successfully fixed');
      } catch (fixError) {
        // If still invalid, log the error but return the best attempt
        this.logger.error('Failed to fix JSON', {
          error: fixError instanceof Error ? fixError.message : String(fixError),
          originalJSON: jsonString,
          attemptedFix: result,
        });
      }

      return result;
    }
  }

  /**
   * Stream a response using the agent
   */
  async stream<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    messages: string | string[] | CoreMessage[] | AiMessageType[],
    args?: AgentStreamOptions<Z>,
  ): Promise<StreamTextResult<any, any> | StreamObjectResult<any, any, any>> {
    // Normalize messages
    const normalizedMessages = this.normalizeMessages(messages);

    // Setup memory and context
    const threadId = args?.threadId || `thread_${Date.now()}`;
    const resourceId = args?.resourceId || `resource_${Date.now()}`;
    const runId = args?.runId || `run_${Date.now()}`;

    this.logger.info('Streaming response', { threadId, resourceId, runId });

    try {
      const { messages: preparedMessages } = await this.preExecute({
        resourceId,
        runId,
        threadId,
        memoryConfig: args?.memoryOptions,
        messages: normalizedMessages,
      });

      // Convert tools for the model
      const tools = this.convertTools({
        toolsets: args?.toolsets,
        threadId,
        resourceId,
        runId,
      });

      // Convert toolChoice to a format compatible with the Model
      const toolChoice = this.normalizeToolChoice(args?.toolChoice);

      if (args?.output || args?.experimental_output) {
        // Stream object response
        const schema = args?.output || args?.experimental_output;
        if (!schema) {
          throw new Error('Schema is required for object streaming');
        }

        // Handle different schema types
        if ('parse' in schema) {
          // It's a Zod schema
          try {
            const rawStream = await this.model.streamObject(
              this.metadata.instructions,
              schema as any,
              {
                messages: preparedMessages.map((msg) => ({
                  role: msg.role,
                  content:
                    typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
                })),
                tools: Object.keys(tools).length > 0 ? tools : undefined,
                toolChoice,
                maxSteps: args?.maxSteps || 3, // Allow up to 3 tool call steps by default
              },
            );

            // Create a properly structured AsyncIterable
            const iterableStream: AsyncIterableWithSymbol<any> = {
              [Symbol.asyncIterator]: () => {
                return (rawStream as unknown as AsyncIterable<any>)[Symbol.asyncIterator]();
              },
            };

            return {
              object: iterableStream,
              output: Promise.resolve({}), // Placeholder
            };
          } catch (error) {
            this.logger.error('Model streaming error', {
              error: error instanceof Error ? error.message : String(error),
              threadId,
              resourceId,
            });
            throw new Error(
              `Failed to stream object response: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
          }
        } else {
          // JSON Schema
          try {
            const rawStream = await this.model.streamText(this.metadata.instructions, {
              messages: preparedMessages.map((msg) => ({
                role: msg.role,
                content:
                  typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
              })),
              tools: Object.keys(tools).length > 0 ? tools : undefined,
              toolChoice,
              maxSteps: args?.maxSteps || 3, // Allow up to 3 tool call steps by default
            });

            // We'll accumulate the text and then parse it as JSON at the end
            let fullText = '';

            // Create a properly structured AsyncIterable
            const iterableStream: AsyncIterableWithSymbol<string> = {
              [Symbol.asyncIterator]: async function* () {
                try {
                  // Cast rawStream to unknown first, then to AsyncIterable<string>
                  for await (const chunk of rawStream as unknown as AsyncIterable<string>) {
                    fullText += chunk;
                    yield chunk;
                  }
                } catch (streamError) {
                  console.error('Error in stream iterator', streamError);
                  throw streamError; // Propagate the error to the consumer of the stream
                }
              },
            };

            // Function to track and accumulate chunks
            const trackChunks = async () => {
              try {
                // Cast rawStream to unknown first, then to AsyncIterable<string>
                for await (const chunk of rawStream as unknown as AsyncIterable<string>) {
                  // chunks are already collected in the iterator above
                }

                try {
                  return JSON.parse(fullText);
                } catch (parseError) {
                  this.logger.error('Failed to parse JSON from stream', {
                    error: parseError instanceof Error ? parseError.message : String(parseError),
                  });

                  // Attempt to fix common JSON parsing issues
                  const fixedResult = this.attemptToFixJSON(fullText);
                  try {
                    return JSON.parse(fixedResult);
                  } catch (secondParseError) {
                    this.logger.error('Failed to parse fixed JSON from stream', {
                      error:
                        secondParseError instanceof Error
                          ? secondParseError.message
                          : String(secondParseError),
                    });
                    return fullText; // Return the raw text if we can't parse it
                  }
                }
              } catch (error) {
                this.logger.error('Error processing stream', {
                  error: error instanceof Error ? error.message : String(error),
                });
                return fullText; // Return whatever we collected before the error
              }
            };

            return {
              object: iterableStream,
              output: trackChunks(),
            };
          } catch (error) {
            this.logger.error('Model streaming error', {
              error: error instanceof Error ? error.message : String(error),
              threadId,
              resourceId,
            });
            throw new Error(
              `Failed to stream text for JSON parsing: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
          }
        }
      } else {
        // Stream text response
        try {
          const rawStream = await this.model.streamText(this.metadata.instructions, {
            messages: preparedMessages.map((msg) => ({
              role: msg.role,
              content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
            })),
            tools: Object.keys(tools).length > 0 ? tools : undefined,
            toolChoice,
            maxSteps: args?.maxSteps || 3, // Allow up to 3 tool call steps by default
          });

          // Collect the full text to save to memory at the end
          let fullText = '';

          // Create a properly structured AsyncIterable
          const iterableStream: AsyncIterableWithSymbol<string> = {
            [Symbol.asyncIterator]: async function* () {
              try {
                // Cast rawStream to unknown first, then to AsyncIterable<string>
                for await (const chunk of rawStream as unknown as AsyncIterable<string>) {
                  fullText += chunk;
                  yield chunk;
                }
              } catch (streamError) {
                console.error('Error in stream iterator', streamError);
                throw streamError; // Propagate the error to the consumer of the stream
              }
            },
          };

          // Function to save to memory after stream completes
          const saveToMemory = async () => {
            try {
              // Wait for the stream to complete
              // Cast rawStream to unknown first, then to AsyncIterable<string>
              for await (const chunk of rawStream as unknown as AsyncIterable<string>) {
                // chunks are already collected in the iterator above
              }

              if (this.memory) {
                try {
                  await this.memory.addMessage({
                    threadId,
                    content: fullText,
                    role: 'assistant',
                    type: 'text',
                  });
                } catch (memoryError) {
                  this.logger.error('Failed to save response to memory', {
                    error: memoryError instanceof Error ? memoryError.message : String(memoryError),
                    threadId,
                  });
                  // Continue even if memory storage fails
                }
              }

              return { threadId, resourceId, runId };
            } catch (error) {
              this.logger.error('Error processing stream for memory', {
                error: error instanceof Error ? error.message : String(error),
              });
              return { threadId, resourceId, runId }; // Return the IDs even if there was an error
            }
          };

          return {
            text: iterableStream,
            extra: { threadId, resourceId, runId },
            output: saveToMemory(),
          };
        } catch (error) {
          this.logger.error('Model streaming error', {
            error: error instanceof Error ? error.message : String(error),
            threadId,
            resourceId,
          });
          throw new Error(
            `Failed to stream text response: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }
    } catch (error) {
      this.logger.error('Agent streaming failed', {
        error: error instanceof Error ? error.message : String(error),
        threadId,
        resourceId,
      });
      throw error; // Re-throw the error for the caller to handle
    }
  }

  /**
   * Helper method to normalize different message formats
   * @private
   */
  private normalizeMessages(
    messages: string | string[] | CoreMessage[] | AiMessageType[],
  ): CoreMessage[] {
    if (typeof messages === 'string') {
      return [{ role: 'user', content: messages }];
    }

    if (Array.isArray(messages)) {
      if (messages.length === 0) {
        return [];
      }

      if (typeof messages[0] === 'string') {
        return (messages as string[]).map((content) => ({ role: 'user', content }));
      }

      return messages as CoreMessage[];
    }

    return [];
  }
}
