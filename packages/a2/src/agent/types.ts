import { LanguageModelV1, CoreMessage } from 'ai';
import { z, ZodSchema } from 'zod';

import { Memory, MemoryConfig } from '../memory';
import { DefaultResourceManager } from '../resource/manager';
import { CoreTool, Primitives } from '../tools/types';

// Create our own JSON Schema type definition
export interface JSONSchema7 {
  $id?: string;
  $schema?: string;
  $ref?: string;
  type?: string | string[];
  title?: string;
  description?: string;
  properties?: Record<string, JSONSchema7>;
  required?: string[];
  items?: JSONSchema7 | JSONSchema7[];
  [key: string]: any;
}

// Define ToolsetsInput since it's not exported from 'ai'
export type ToolsetsInput = Record<string, Record<string, CoreTool>>;

export interface IExecutionContext<TSchemaIn extends z.ZodSchema | undefined = undefined> {
  context: TSchemaIn extends z.ZodSchema ? z.infer<TSchemaIn> : {};
  runId?: string;
  threadId: string;
  resourceId: string;
}

export interface IAction<
  TId extends string,
  TSchemaIn extends z.ZodSchema | undefined,
  TSchemaOut extends z.ZodSchema | undefined,
  TContext extends IExecutionContext<TSchemaIn>,
  TOptions extends unknown = unknown,
> {
  id: TId;
  description: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  execute: (context: TContext, options?: TOptions) => Promise<any>;
}

export type ToolsInput = {
  [key: string]: CoreTool;
};

/**
 * Metadata for an Agent
 */
export interface AgentMetadata {
  name: string;
  agentId: string;
  instructions: string;
  goal?: string;
  role?: string;
}

/**
 * Model configuration that can be passed to the Agent
 */
export interface AgentModelConfig {
  /** The model name (e.g., 'gpt-4', 'claude-3') */
  modelName: string;
  /** The model provider ('openai', 'anthropic', etc) */
  provider: string;
  /** API key for the model provider */
  apiKey: string;
  /** Optional temperature setting (0-1) */
  temperature?: number;
  /** Optional max tokens for completion */
  maxTokens?: number;
  /** Additional model configuration options */
  [key: string]: any;
}

/**
 * Configuration for creating an Agent
 */
export interface AgentConfig<
  TTools extends ToolsInput = ToolsInput,
  TModelConfig extends Record<string, any> = Record<string, any>,
> {
  metadata: AgentMetadata;
  model: AgentModelConfig | LanguageModelV1;
  memory?: Memory;
  tools?: TTools;
  resourceManager?: DefaultResourceManager;
}

// Type for tool choice compatible with different APIs
export type ToolChoiceType =
  | 'auto'
  | 'required'
  | 'none'
  | { type: 'tool'; toolName: string }
  | { type: 'function'; function: { name: string } };

export interface AgentGenerateOptions<Z extends ZodSchema | JSONSchema7 | undefined = undefined> {
  instructions?: string;
  toolsets?: ToolsetsInput;
  context?: Record<string, any>;
  memoryOptions?: MemoryConfig;
  runId?: string;
  onStepFinish?: (step: any) => void;
  maxSteps?: number;
  output?: Z;
  experimental_output?: Z;
  toolChoice?: ToolChoiceType;
  resourceId?: string;
  threadId?: string;
}

export interface AgentStreamOptions<Z extends ZodSchema | JSONSchema7 | undefined = undefined>
  extends AgentGenerateOptions<Z> {
  onToolCall?: (toolCall: any) => void;
  onToolCallResult?: (result: any) => void;
}

export type GenerateTextResult<TExtra = any, TOutput = unknown> = {
  text: string;
  extra?: TExtra;
  output?: TOutput;
};

export type GenerateObjectResult<TOutput = unknown> = {
  object: TOutput;
};

export interface AsyncIterableWithSymbol<T> extends AsyncIterable<T> {
  [Symbol.asyncIterator](): AsyncIterator<T>;
}

export type StreamTextResult<TExtra = any, TOutput = unknown> = {
  text: AsyncIterableWithSymbol<string>;
  extra?: TExtra;
  output?: Promise<TOutput>;
};

export type StreamObjectResult<TExtra = any, TOutput = unknown, TParse = any> = {
  object: AsyncIterableWithSymbol<TParse>;
  output?: Promise<TOutput>;
  extra?: TExtra;
};

export type AiMessageType = {
  role: string;
  content: string | null;
  [key: string]: any;
};
