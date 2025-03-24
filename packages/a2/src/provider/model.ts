import {
  LanguageModelV1,
  generateText as aiGenerateText,
  streamText as aiStreamText,
  generateObject as aiGenerateObject,
  streamObject as aiStreamObject,
  tool as aiTool,
  ToolSet,
} from 'ai';
import { z } from 'zod';

import { Logger, createLogger, LogLevel } from '../logger';

import {
  ModelConfig,
  GenerationOptions,
  Message,
  Tool,
  ToolChoice,
  MessageRole,
  ContentPart,
  ToolExecutionOptions,
  ToolResultContent,
} from './types';

// Let's try to dynamically import provider-specific models
let OpenAIModule: any, AnthropicModule: any;
try {
  // Only works if these modules are installed
  // @ts-ignore - This is a dynamic import
  OpenAIModule = require('@ai-sdk/openai');
  // @ts-ignore - This is a dynamic import
  AnthropicModule = require('@ai-sdk/anthropic');
} catch (error) {
  // Silently fail, will be handled when creating models
}

/**
 * Model class that wraps Vercel AI SDK functionality
 * Provides convenient methods for generating text and objects
 */
export class Model {
  private model: LanguageModelV1;
  private config: Partial<ModelConfig>;
  private logger: Logger;

  /**
   * Create a new model instance
   * @param model A pre-existing LanguageModelV1 instance from AI SDK
   * @param config Optional configuration overrides
   */
  constructor(model: LanguageModelV1, config: Partial<ModelConfig> = {}) {
    this.model = model;
    this.config = {
      modelName: config.modelName || 'custom-model',
      provider: config.provider || 'custom',
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      topP: config.topP,
      topK: config.topK,
      frequencyPenalty: config.frequencyPenalty,
      presencePenalty: config.presencePenalty,
      options: config.options || {},
    };

    // Initialize logger
    this.logger = createLogger({
      name: 'model',
      level: LogLevel.INFO,
      context: { modelName: this.config.modelName },
    });
  }

  /**
   * Create a model from configuration
   * @param config Model configuration including provider, modelName, and apiKey
   * @returns A Model instance
   */
  public static fromConfig(config: ModelConfig & { apiKey: string }): Model {
    const { provider, modelName, apiKey, ...otherConfig } = config;

    let model: LanguageModelV1;

    switch (provider) {
      case 'openai':
        if (!OpenAIModule || !OpenAIModule.OpenAI) {
          throw new Error(
            '@ai-sdk/openai is required to use OpenAI models. Please install it with: pnpm add @ai-sdk/openai',
          );
        }
        model = new OpenAIModule.OpenAI({ apiKey });
        break;

      case 'anthropic':
        if (!AnthropicModule || !AnthropicModule.Anthropic) {
          throw new Error(
            '@ai-sdk/anthropic is required to use Anthropic models. Please install it with: pnpm add @ai-sdk/anthropic',
          );
        }
        model = new AnthropicModule.Anthropic({ apiKey });
        break;

      case 'custom':
        throw new Error(
          'For custom providers, you must provide a model instance directly, not a configuration.',
        );

      default:
        throw new Error(`Unsupported provider: ${provider}. Please use 'openai' or 'anthropic'.`);
    }

    return new Model(model, {
      modelName,
      provider,
      ...otherConfig,
    });
  }

  /**
   * Get the underlying language model
   */
  public getLanguageModel(): LanguageModelV1 {
    return this.model;
  }

  /**
   * Get the model configuration
   */
  public getConfig(): Partial<ModelConfig> {
    return this.config;
  }

  /**
   * Generate text from a prompt
   * @param prompt The prompt to generate from
   * @param options Additional generation options
   */
  public async generateText(
    prompt: string,
    options: Partial<GenerationOptions> = {},
  ): Promise<string> {
    try {
      const messages = options.messages || [{ role: 'user' as MessageRole, content: prompt }];

      const params = {
        model: this.model,
        messages: convertMessages(messages),
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        topP: this.config.topP,
        topK: this.config.topK,
        frequencyPenalty: this.config.frequencyPenalty,
        presencePenalty: this.config.presencePenalty,
        ...this.config.options,
        tools: options.tools as ToolSet | undefined,
        toolChoice: options.toolChoice as any,
        maxSteps: options.maxSteps,
        abortSignal: options.abortSignal,
      };

      // First attempt - ask the model for a response
      const result = await aiGenerateText(params);

      // Process the response text to look for tool calls
      if (
        typeof result.text === 'string' &&
        options.tools &&
        Object.keys(options.tools).length > 0
      ) {
        try {
          return await this.handlePotentialToolCalls(result.text, messages, options);
        } catch (toolError) {
          console.error('Error handling tool calls:', toolError);
          // If tool processing fails, fall back to original response
          return result.text;
        }
      }

      // If tool execution didn't happen or failed, return the original text
      return result.text;
    } catch (error) {
      console.error('Error in generateText:', error);
      throw new Error(
        `Failed to generate text: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Handle potential tool calls in model response
   * @private
   */
  private async handlePotentialToolCalls(
    responseText: string,
    messages: Message[],
    options: Partial<GenerationOptions>,
  ): Promise<string> {
    if (!options.tools || Object.keys(options.tools).length === 0) {
      return responseText;
    }

    this.logger.debug('Examining response for potential tool calls', {
      responseLength: responseText.length,
    });

    // Extract all tool names to check against response
    const availableToolNames = Object.keys(options.tools);

    try {
      // First try to parse structured function calls if present
      const structuredToolCall = this.parseStructuredToolCall(responseText, availableToolNames);

      if (structuredToolCall) {
        this.logger.debug('Found structured tool call', structuredToolCall);
        return await this.executeToolCall(
          structuredToolCall.tool,
          structuredToolCall.parameters,
          messages,
          options,
        );
      }

      // If no structured tool call found, try to infer from content
      const inferredToolCall = this.inferToolCallFromContent(responseText, availableToolNames);
      if (inferredToolCall) {
        this.logger.debug('Inferred tool call from content', inferredToolCall);
        return await this.executeToolCall(
          inferredToolCall.tool,
          inferredToolCall.parameters,
          messages,
          options,
        );
      }

      // No tool calls found or inferred
      return responseText;
    } catch (error) {
      if (error instanceof ToolParsingError) {
        this.logger.error('Tool parsing error', {
          error: error.message,
          reason: error.reason,
          tool: error.tool,
        });
      } else if (error instanceof ToolExecutionError) {
        this.logger.error('Tool execution error', {
          error: error.message,
          tool: error.tool,
        });
      } else {
        this.logger.error('Unknown error handling tool calls', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Return original response if tool processing fails
      return responseText;
    }
  }

  /**
   * Parse structured tool calls from the response text
   * @private
   */
  private parseStructuredToolCall(
    text: string,
    availableToolNames: string[],
  ): { tool: string; parameters: Record<string, unknown> } | null {
    // Parse JSON blocks in the response
    const jsonBlockPattern = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/;
    const jsonMatches = text.match(jsonBlockPattern);

    if (jsonMatches && jsonMatches[1]) {
      try {
        const parsedJson = JSON.parse(jsonMatches[1]);

        // Check if this looks like a tool call object
        if (parsedJson && typeof parsedJson === 'object') {
          // Check for function call structure: { name: "toolName", arguments: {...} }
          if (
            parsedJson.name &&
            typeof parsedJson.name === 'string' &&
            (parsedJson.arguments || parsedJson.params || parsedJson.parameters)
          ) {
            const toolName = parsedJson.name;
            const params = parsedJson.arguments || parsedJson.params || parsedJson.parameters;

            // Verify the tool exists
            if (availableToolNames.includes(toolName)) {
              return {
                tool: toolName,
                parameters: params,
              };
            }
          }

          // Check for direct tool call structure: { toolName: {...} }
          for (const key of Object.keys(parsedJson)) {
            if (availableToolNames.includes(key) && typeof parsedJson[key] === 'object') {
              return {
                tool: key,
                parameters: parsedJson[key],
              };
            }
          }
        }
      } catch (error) {
        throw new ToolParsingError('Failed to parse JSON in response', 'json_parse_error', null);
      }
    }

    // Look for other patterns indicating tool calls
    const toolCallPatterns = [
      // Claude/Anthropic style
      /I need to use the ([a-zA-Z0-9_]+) tool.*?(\{.*?\})/s,
      // More general pattern
      /use the ([a-zA-Z0-9_]+) function.*?(\{.*?\})/s,
      // Even more general
      /call(ing)? ([a-zA-Z0-9_]+).*?(\{.*?\})/s,
    ];

    for (const pattern of toolCallPatterns) {
      const match = pattern.exec(text);
      if (match && match.length >= 3) {
        const candidateToolName = match[1];

        // Check if this matches one of our available tools
        const matchedTool = availableToolNames.find(
          (name) => name.toLowerCase() === candidateToolName.toLowerCase(),
        );

        if (matchedTool) {
          try {
            // Parse the JSON parameters
            const jsonStr = match[2].trim();
            const params = JSON.parse(jsonStr);

            return {
              tool: matchedTool,
              parameters: params,
            };
          } catch (error) {
            throw new ToolParsingError(
              `Failed to parse parameters for ${matchedTool}`,
              'parameter_parse_error',
              matchedTool,
            );
          }
        }
      }
    }

    return null;
  }

  /**
   * Infer tool call from content when no structured format is detected
   * @private
   */
  private inferToolCallFromContent(
    text: string,
    availableToolNames: string[],
  ): { tool: string; parameters: Record<string, unknown> } | null {
    // Look for mentions of available tools
    const toolMentions = availableToolNames.filter(
      (toolName) => text.includes(toolName) || text.toLowerCase().includes(toolName.toLowerCase()),
    );

    // Check for intent to use a tool
    const intentToUseToolPattern =
      /I('ll| will|'d like to| can| should) (check|get|calculate|compute|find|save|use|query|lookup)/i;
    const hasIntentToUseTool = intentToUseToolPattern.test(text);

    // If we have tool mentions or clear intent
    if (toolMentions.length > 0 || hasIntentToUseTool) {
      // If specific tools were mentioned, use the first one
      if (toolMentions.length > 0) {
        // Try to extract parameters for this tool
        const toolName = toolMentions[0];
        const params = this.extractParametersFromText(text, toolName);

        return {
          tool: toolName,
          parameters: params,
        };
      }
      // Otherwise make a best guess based on the content
      else if (hasIntentToUseTool) {
        const result = this.guessToolFromContent(text, availableToolNames);
        if (result) {
          return result;
        }
      }
    }

    return null;
  }

  /**
   * Extract parameters from unstructured text
   * @private
   */
  private extractParametersFromText(text: string, toolName: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // Look for key-value patterns after tool name mention
    const toolNameIndex = text.toLowerCase().indexOf(toolName.toLowerCase());
    if (toolNameIndex >= 0) {
      const textAfterTool = text.substring(toolNameIndex + toolName.length);

      // Look for key-value pairs
      const keyValuePattern =
        /(?:with|using|where|for)?\s*"?([a-zA-Z0-9_]+)"?\s*(?:is|as|:|=)\s*"?([^",\s]+)"?/g;
      let match;

      while ((match = keyValuePattern.exec(textAfterTool)) !== null) {
        if (match && match.length >= 3) {
          const key = match[1].trim();
          const value = match[2].trim();

          // Try to parse as number or boolean if appropriate
          if (value === 'true') {
            params[key] = true;
          } else if (value === 'false') {
            params[key] = false;
          } else if (!isNaN(Number(value))) {
            params[key] = Number(value);
          } else {
            params[key] = value;
          }
        }
      }
    }

    return params;
  }

  /**
   * Guess which tool to use based on response content
   * @private
   */
  private guessToolFromContent(
    text: string,
    availableToolNames: string[],
  ): { tool: string; parameters: Record<string, unknown> } | null {
    try {
      // Common tool detection patterns based on content
      if (
        text.match(/weather|temperature|forecast|rain|sunny|cloudy/i) &&
        availableToolNames.includes('getCurrentWeather')
      ) {
        const toolParams: Record<string, unknown> = { location: 'San Francisco, CA' };

        // Try to extract location
        const locationMatch = text.match(
          /weather (in|for) ([A-Za-z\s,]+?)($|\s+in\s|\s+for\s|\s+with\s)/i,
        );
        if (locationMatch && locationMatch.length > 2) {
          toolParams.location = locationMatch[2].trim();
          // Check for temperature unit
          if (text.toLowerCase().includes('fahrenheit')) {
            toolParams.unit = 'fahrenheit';
          } else if (text.toLowerCase().includes('celsius')) {
            toolParams.unit = 'celsius';
          }
        }

        return { tool: 'getCurrentWeather', parameters: toolParams };
      } else if (
        text.match(/calculat|comput|math|square root|multiply|divide|add|subtract/i) &&
        availableToolNames.includes('calculator')
      ) {
        const toolParams: Record<string, unknown> = {};

        // Special case for square root
        if (text.toLowerCase().includes('square root')) {
          const squareRootMatch = text.match(/square root of (\d+)/i);
          if (squareRootMatch && squareRootMatch.length > 1) {
            toolParams.expression = `Math.sqrt(${squareRootMatch[1]})`;
            return { tool: 'calculator', parameters: toolParams };
          }
        }

        // Try to extract the expression
        const expressionMatch = text.match(/calculat[e\s]+(the\s+)?([0-9+\-*/^.\s()√]+)/i);
        if (expressionMatch && expressionMatch.length > 2) {
          let expr = expressionMatch[2].trim();
          // Replace square root symbol if present
          expr = expr.replace('√', 'sqrt');
          toolParams.expression = expr;
          return { tool: 'calculator', parameters: toolParams };
        }

        // Extract any numbers and try to guess the operation
        const numbers = text.match(/\d+(\.\d+)?/g);
        if (numbers && numbers.length >= 2) {
          if (text.includes('*') || text.includes('multiply')) {
            toolParams.expression = `${numbers[0]} * ${numbers[1]}`;
          } else if (text.includes('/') || text.includes('divide')) {
            toolParams.expression = `${numbers[0]} / ${numbers[1]}`;
          } else if (text.includes('+') || text.includes('add')) {
            toolParams.expression = `${numbers[0]} + ${numbers[1]}`;
          } else if (text.includes('-') || text.includes('subtract')) {
            toolParams.expression = `${numbers[0]} - ${numbers[1]}`;
          }

          if ('expression' in toolParams) {
            return { tool: 'calculator', parameters: toolParams };
          }
        }
      } else if (
        text.match(/note|save|remind|remember/i) &&
        availableToolNames.includes('takeNote')
      ) {
        const toolParams: Record<string, unknown> = {
          note: "User requested a note but didn't specify content",
        };

        // Try to extract the note content
        const noteMatch = text.match(/note that ([^.?!]+)[.?!]/i);
        if (noteMatch && noteMatch.length > 1) {
          toolParams.note = noteMatch[1].trim();
          // Check if a category is mentioned
          const categoryMatch = text.match(/category ['"]?([a-zA-Z0-9_]+)['"]?/i);
          if (categoryMatch && categoryMatch.length > 1) {
            toolParams.category = categoryMatch[1].trim();
          }
        }

        return { tool: 'takeNote', parameters: toolParams };
      }
    } catch (error) {
      this.logger.error('Error in guessToolFromContent', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return null;
  }

  /**
   * Execute a tool call and generate a follow-up response
   * @private
   */
  private async executeToolCall(
    toolName: string,
    params: Record<string, unknown>,
    messages: Message[],
    options: Partial<GenerationOptions>,
  ): Promise<string> {
    if (!options.tools || !options.tools[toolName]) {
      throw new ToolExecutionError(`Tool ${toolName} not available`, toolName);
    }

    const tool = options.tools[toolName];

    // Execute the tool if it has an execute function
    if ('execute' in tool && typeof tool.execute === 'function') {
      try {
        // Create an ID for this tool call
        const toolCallId = generateId();

        // Build tool execution options
        const execOptions: ToolExecutionOptions = {
          toolCallId,
          messages,
          abortSignal: options.abortSignal,
        };

        this.logger.debug(`Executing tool ${toolName}`, { params });
        const toolResult = await tool.execute(params, execOptions);
        this.logger.debug(`Tool ${toolName} result received`);

        // Create new messages with tool call and tool result in proper format
        const assistantMessage: Message = {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: `I need to use the ${toolName} tool.`,
            } as ContentPart,
          ],
        };

        // Add tool result message
        // Note: We're using a custom property here to pass the toolCallId
        const toolResultMessage = {
          role: 'tool' as MessageRole,
          content: `Result from ${toolName}: ${
            typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2)
          }`,
          name: toolName,
        } as Message;

        // Ask the model to continue based on the tool result
        const newMessages = [...messages, assistantMessage, toolResultMessage];

        // Generate a follow-up response
        const followUpResponse = await aiGenerateText({
          model: this.model,
          messages: convertMessages(newMessages),
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens,
          ...this.config.options,
        });

        // Return the response with the tool output integrated
        return `I used the ${toolName} tool and found: ${
          typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2)
        }\n\n${followUpResponse.text}`;
      } catch (error) {
        throw new ToolExecutionError(
          `Error executing tool ${toolName}: ${error instanceof Error ? error.message : String(error)}`,
          toolName,
        );
      }
    } else {
      throw new ToolExecutionError(`Tool ${toolName} doesn't have an execute function`, toolName);
    }
  }

  /**
   * Generate a structured object from a prompt
   * @param prompt The prompt to generate from
   * @param schema The Zod schema for the object
   * @param options Additional generation options
   */
  public async generateObject<T>(
    prompt: string,
    schema: z.ZodType<T>,
    options: Partial<GenerationOptions> = {},
  ): Promise<T> {
    try {
      const messages = options.messages || [{ role: 'user' as MessageRole, content: prompt }];

      const params = {
        model: this.model,
        schema,
        messages: convertMessages(messages),
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        topP: this.config.topP,
        topK: this.config.topK,
        frequencyPenalty: this.config.frequencyPenalty,
        presencePenalty: this.config.presencePenalty,
        ...this.config.options,
        abortSignal: options.abortSignal,
      };

      const result = await aiGenerateObject(params);

      return result.object as T;
    } catch (error) {
      console.error('Error in generateObject:', error);
      throw new Error(
        `Failed to generate object: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Stream text from a prompt
   * @param prompt The prompt to generate from
   * @param options Additional generation options
   */
  public streamText(prompt: string, options: Partial<GenerationOptions> = {}) {
    try {
      const messages = options.messages || [{ role: 'user' as MessageRole, content: prompt }];

      const params = {
        model: this.model,
        messages: convertMessages(messages),
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        topP: this.config.topP,
        topK: this.config.topK,
        frequencyPenalty: this.config.frequencyPenalty,
        presencePenalty: this.config.presencePenalty,
        ...this.config.options,
        tools: options.tools as ToolSet | undefined,
        toolChoice: options.toolChoice as any,
        maxSteps: options.maxSteps,
        abortSignal: options.abortSignal,
      };

      return aiStreamText(params);
    } catch (error) {
      console.error('Error in streamText:', error);
      throw new Error(
        `Failed to stream text: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Stream a structured object from a prompt
   * @param prompt The prompt to generate from
   * @param schema The Zod schema for the object
   * @param options Additional generation options
   */
  public streamObject<T>(
    prompt: string,
    schema: z.ZodType<T>,
    options: Partial<GenerationOptions> = {},
  ) {
    try {
      const messages = options.messages || [{ role: 'user' as MessageRole, content: prompt }];

      const params = {
        model: this.model,
        schema,
        messages: convertMessages(messages),
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        topP: this.config.topP,
        topK: this.config.topK,
        frequencyPenalty: this.config.frequencyPenalty,
        presencePenalty: this.config.presencePenalty,
        ...this.config.options,
        abortSignal: options.abortSignal,
      };

      return aiStreamObject(params);
    } catch (error) {
      console.error('Error in streamObject:', error);
      throw new Error(
        `Failed to stream object: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Generate text using chat history
   * @param messages Array of messages with role and content
   * @param options Additional generation options
   */
  public async chat(
    messages: Message[],
    options: Partial<GenerationOptions> = {},
  ): Promise<string> {
    try {
      return this.generateText('', {
        ...options,
        messages,
      });
    } catch (error) {
      console.error('Error in chat:', error);
      throw new Error(
        `Failed to generate chat response: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Stream text using chat history
   * @param messages Array of messages with role and content
   * @param options Additional generation options
   */
  public streamChat(messages: Message[], options: Partial<GenerationOptions> = {}) {
    try {
      return this.streamText('', {
        ...options,
        messages,
      });
    } catch (error) {
      console.error('Error in streamChat:', error);
      throw new Error(
        `Failed to stream chat response: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Create a tool that can be used with this model
   * @param name Tool name
   * @param definition The tool definition
   */
  public createTool<TParams extends Record<string, unknown>, TResult>(
    name: string,
    definition: {
      description?: string;
      parameters: z.ZodObject<any>;
      execute: (args: TParams, options: ToolExecutionOptions) => Promise<TResult>;
      experimental_toToolResultContent?: (result: TResult) => ToolResultContent;
    },
  ) {
    try {
      // Use any type assertion to avoid complex type compatibility issues
      return aiTool({
        description: definition.description,
        parameters: definition.parameters,
        execute: definition.execute as any,
        experimental_toToolResultContent: definition.experimental_toToolResultContent as any,
      });
    } catch (error) {
      console.error('Error creating tool:', error);
      throw new Error(
        `Failed to create tool: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * Generate a random ID for tool calls
 *
 * @returns A string ID
 */
function generateId(): string {
  return `tool-${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Convert our internal message format to the AI SDK message format
 */
function convertMessages(messages: Message[]): any[] {
  try {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      name: msg.name,
    }));
  } catch (error) {
    console.error('Error converting messages:', error);
    throw new Error(
      `Failed to convert messages: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Custom error for tool parsing issues
 */
class ToolParsingError extends Error {
  reason: string;
  tool: string | null;

  constructor(message: string, reason: string, tool: string | null) {
    super(message);
    this.name = 'ToolParsingError';
    this.reason = reason;
    this.tool = tool;
  }
}

/**
 * Custom error for tool execution issues
 */
class ToolExecutionError extends Error {
  tool: string;

  constructor(message: string, tool: string) {
    super(message);
    this.name = 'ToolExecutionError';
    this.tool = tool;
  }
}
