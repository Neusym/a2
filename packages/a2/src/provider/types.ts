import { LanguageModelV1 } from 'ai';
import { z } from 'zod';

/**
 * Model configuration options
 */
export interface ModelConfig {
  /** Model name (e.g. "gpt-3.5-turbo") */
  modelName: string;
  /** Provider name (e.g. "openai") */
  provider: string;
  /** Model temperature (0-1) */
  temperature?: number;
  /** Maximum number of tokens to generate */
  maxTokens?: number;
  /** Top-p sampling (0-1) */
  topP?: number;
  /** Top-k sampling */
  topK?: number;
  /** Frequency penalty (0-2) */
  frequencyPenalty?: number;
  /** Presence penalty (0-2) */
  presencePenalty?: number;
  /** Additional provider-specific options */
  options?: Record<string, unknown>;
}

/**
 * Available message roles, matching the Vercel AI SDK's role types
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool' | 'function';

/**
 * Text part of a message
 */
export interface TextPart {
  type: 'text';
  text: string;
}

/**
 * Image part of a message
 */
export interface ImagePart {
  type: 'image';
  image: string | URL;
}

/**
 * Tool call part of a message
 */
export interface ToolCallPart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

/**
 * Tool result part of a message
 */
export interface ToolResultPart {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  result: unknown;
  error?: boolean;
}

/**
 * Content part union type
 */
export type ContentPart = TextPart | ImagePart | ToolCallPart | ToolResultPart;

/**
 * Tool result content with multiple parts
 */
export interface ToolResultContent {
  type: 'text' | 'image';
  text?: string;
  data?: string;
  mimeType?: string;
}

/**
 * Message in a conversation
 */
export interface Message {
  /** Message role */
  role: MessageRole;
  /** Message content - either plain text or structured content */
  content: string | ContentPart[];
  /** Optional tool name (for tool messages) */
  name?: string;
}

/**
 * Tool execution options
 */
export interface ToolExecutionOptions {
  /** Unique ID for the tool call */
  toolCallId: string;
  /** Messages in the conversation */
  messages: Message[];
  /** Optional abort signal */
  abortSignal?: AbortSignal;
}

/**
 * Tool definition
 * Compatible with AI SDK tool structure
 */
export interface Tool<
  TParams extends Record<string, unknown> = Record<string, unknown>,
  TResult = unknown,
> {
  /** Tool name */
  name: string;
  /** Tool description */
  description?: string;
  /** Tool parameters schema */
  parameters: z.ZodObject<any>;
  /** Tool execution function */
  execute?: (args: TParams, options: ToolExecutionOptions) => Promise<TResult>;
  /** Optional function to convert result to tool result content */
  experimental_toToolResultContent?: (result: TResult) => ToolResultContent;
}

/**
 * Tool choice for controlling tool usage
 */
export type ToolChoice = 'auto' | 'none' | { type: 'tool'; toolName: string };

/**
 * Text generation options
 */
export interface GenerationOptions {
  /** Messages in the conversation */
  messages?: Message[];
  /** List of available tools */
  tools?: Record<string, Tool>;
  /** How to choose which tool to use */
  toolChoice?: ToolChoice;
  /** Maximum number of steps for tool execution */
  maxSteps?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature setting (0-1) */
  temperature?: number;
  /** Top-p sampling (0-1) */
  topP?: number;
  /** Top-k sampling */
  topK?: number;
  /** Frequency penalty (0-2) */
  frequencyPenalty?: number;
  /** Presence penalty (0-2) */
  presencePenalty?: number;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
  /** Additional provider-specific options */
  options?: Record<string, unknown>;
}
