import type { ToolExecutionOptions, Tool } from 'ai';
import type { ZodSchema, z } from 'zod';

import type { Agent } from '../agent';
import type { Memory } from '../memory';

/**
 * Represents a resource that can be used by agents
 */
export interface Resource {
  id: string;
  content: string;
  type: string;
  metadata?: Record<string, any>;
}

/**
 * A collection of resources
 */
export interface ResourceLibrary {
  [resourceId: string]: Resource;
}

/**
 * A function that takes parameters and returns a formatted prompt string
 */
export type PromptTemplate = (params: Record<string, any>) => string;

/**
 * A simple key-value store of prompts or templates
 */
export interface PromptLibrary {
  [promptName: string]: string | PromptTemplate;
}

// Storage interface (previously imported from repository)
export interface Storage {
  init(): Promise<void>;
  createThread(thread: any): Promise<any>;
  getThread(threadId: string): Promise<any | null>;
  updateThread(threadId: string, update: any): Promise<any>;
  listThreads(options?: any): Promise<any[]>;
  createMessage(message: any): Promise<any>;
  getMessage(messageId: string): Promise<any | null>;
  listMessages(threadId: string, options?: any): Promise<any[]>;
  getLastMessages(threadId: string, limit: number): Promise<any[]>;
}

// Primitives that can be accessed by tools
export type Primitives = {
  storage?: Storage;
  agents?: Record<string, Agent>;
  memory?: Memory;
  resources?: ResourceLibrary;
  prompts?: PromptLibrary;
};

// Execution context for tools
export interface ExecutionContext<TSchemaIn extends z.ZodSchema | undefined = undefined> {
  context: TSchemaIn extends z.ZodSchema ? z.infer<TSchemaIn> : {};
  runId?: string;
  threadId?: string;
  resourceId?: string;
  primitives?: Primitives;
}

// Define VercelTool as an alias for AI SDK's Tool
export type VercelTool = Tool;

// CoreTool type that matches AI SDK's Tool format
export type CoreTool = {
  id?: string;
  description?: string;
  parameters: ZodSchema;
  execute?: (params: any, options: ToolExecutionOptions) => Promise<any>;
} & (
  | {
      type?: 'function' | undefined;
      id?: string;
    }
  | {
      type: 'provider-defined';
      id: `${string}.${string}`;
      args: Record<string, unknown>;
    }
);

// Tool execution context with primitives
export interface ToolExecutionContext<TSchemaIn extends z.ZodSchema | undefined = undefined>
  extends ExecutionContext<TSchemaIn> {
  primitives?: Primitives;
}

// Tool action interface
export interface ToolAction<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TContext extends ToolExecutionContext<TSchemaIn> = ToolExecutionContext<TSchemaIn>,
> {
  id: string;
  description: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  execute?: (
    context: TContext,
    options?: ToolExecutionOptions,
  ) => Promise<TSchemaOut extends z.ZodSchema ? z.infer<TSchemaOut> : unknown>;
}
