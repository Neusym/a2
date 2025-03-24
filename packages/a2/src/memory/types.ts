/**
 * Types for the memory system based on Vercel AI SDK
 */

import type {
  AssistantContent,
  CoreMessage,
  EmbeddingModel,
  Message as AiMessage,
  ToolCall as AIToolCall,
  ToolContent,
  ToolInvocation,
  ToolResultPart,
  UserContent,
} from 'ai';

import { LogLevel } from '../logger/types';
import { Repository } from '../repository/repository';

// Re-export AI SDK types for convenience
export type { Message as AiMessageType } from 'ai';

/**
 * Message role types
 */
export type Role = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Message storage type
 */
export type MessageType = {
  id: string;
  content: UserContent | AssistantContent | ToolContent;
  role: Role;
  createdAt: Date;
  threadId: string;
  toolCallIds?: string[];
  toolCallArgs?: Record<string, unknown>[];
  toolNames?: string[];
  type: 'text' | 'tool-call' | 'tool-result';
};

/**
 * Thread structure for conversations
 */
export type RepositoryThreadType = {
  id: string;
  title?: string;
  resourceId: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
};

export type MessageResponse<T extends 'raw' | 'core_message'> = {
  raw: MessageType[];
  core_message: CoreMessage[];
}[T];

/**
 * Memory configuration options
 */
export type MemoryConfig = {
  lastMessages?: number | false;
  saveContext?: boolean;
  retrievalConfig?: {
    topK: number;
    similarityThreshold: number;
  };
  semanticRecall?:
    | boolean
    | {
        topK: number;
        messageRange: number | { before: number; after: number };
      };
  workingMemory?: {
    enabled: boolean;
    template?: string;
    use?: 'text-stream' | 'tool-call';
  };
  threads?: {
    generateTitle?: boolean;
  };
};

/**
 * Configuration for creating a Memory instance
 */
export type SharedMemoryConfig = {
  /* @default new SQLiteRepository() */
  repository?: Repository;

  /* Configuration options for the memory thread */
  threadConfig?: MemoryConfig;

  /* Maximum number of tokens to consider for context */
  contextTokenLimit?: number;

  /* Logging level */
  logLevel?: LogLevel;

  options?: MemoryConfig;

  embedder?: EmbeddingModel<string>;
};

// Export the Message and Thread types as aliases for the MessageType and RepositoryThreadType
export type Message = MessageType;
export type Thread = RepositoryThreadType;

// Helper function to generate unique IDs
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart1 = Math.random().toString(36).substring(2, 15);
  const randomPart2 = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${randomPart1}${randomPart2}`;
}

// Content types
export type ContentPart = {
  type: string;
  [key: string]: any;
};

export type Content = string | ContentPart[];
