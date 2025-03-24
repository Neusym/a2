/**
 * Memory system for managing conversation history
 */

import { randomUUID } from 'crypto';

import type {
  AssistantContent,
  CoreMessage,
  CoreToolMessage,
  Message as AiMessageType,
  ToolCallPart,
  ToolInvocation,
  ToolResultPart,
  UserContent,
} from 'ai';

import { Logger, createLogger } from '../logger';
import { LogLevel } from '../logger/types';
import { SQLiteRepository } from '../repository';
import type { Repository } from '../repository/repository';
import type { CoreTool } from '../tools';

import type { MemoryConfig, MessageType, SharedMemoryConfig, RepositoryThreadType } from './types';
import { deepMerge, extractToolCalls, parseMessages } from './utils';

/**
 * Memory utilities for querying messages
 */
export const MessageQueryUtils = {
  /**
   * Query messages from a thread based on selection criteria
   *
   * @param repository Repository instance to query from
   * @param threadId Thread ID to query
   * @param selectBy Selection criteria ('last', 'range', 'all')
   * @param limit Maximum number of messages to retrieve (for 'last')
   * @param logger Optional logger for debugging
   * @returns Object containing the parsed messages
   */
  async queryMessages({
    repository,
    threadId,
    selectBy = 'last',
    limit = 10,
    logger,
  }: {
    repository: Repository;
    threadId: string;
    selectBy?: 'last' | 'range' | 'all';
    limit?: number;
    logger?: Logger;
  }): Promise<{ messages: CoreMessage[] }> {
    let rawMessages: MessageType[] = [];

    try {
      if (selectBy === 'last') {
        rawMessages = await repository.getLastMessages(threadId, limit);
      } else {
        rawMessages = await repository.listMessages(threadId);
      }

      const messages = parseMessages(rawMessages);

      // Log query details if logger provided
      if (logger) {
        logger.debug('Queried messages', {
          threadId,
          selectBy,
          count: messages.length,
          limit,
        });
      }

      return { messages };
    } catch (error) {
      if (logger) {
        logger.error('Failed to query messages', {
          threadId,
          selectBy,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }
  },
};

/**
 * Abstract Memory class that defines the interface for storing and retrieving
 * conversation threads and messages.
 */
export abstract class Memory {
  CONTEXT_TOKEN_LIMIT?: number;
  repository: Repository;
  protected logger: Logger;

  protected threadConfig: MemoryConfig = {
    lastMessages: 10,
    saveContext: true,
    retrievalConfig: {
      topK: 1,
      similarityThreshold: 0.8,
    },
  };

  constructor(config: { name: string } & SharedMemoryConfig) {
    this.logger = createLogger({
      name: config.name || 'memory',
      level: config.logLevel || LogLevel.INFO,
    });

    this.logger.debug('Memory instance created', { type: config.name });

    if (config.contextTokenLimit) {
      this.CONTEXT_TOKEN_LIMIT = config.contextTokenLimit;
    }

    if (config.repository) {
      this.repository = config.repository;
      this.logger.debug('Repository set');
    } else {
      throw new Error('Repository is required for Memory');
    }

    if (config.threadConfig) {
      this.threadConfig = { ...this.threadConfig, ...config.threadConfig };
      this.logger.debug('Thread config set', this.threadConfig);
    }
  }

  public setRepository(repository: Repository) {
    try {
      this.repository = repository;
      this.logger.info('Repository updated');
    } catch (error) {
      this.logger.error('Failed to set repository', { error });
      throw error;
    }
  }

  /**
   * Get system message for the memory
   *
   * Override this method to implement custom system message logic
   */
  public async getSystemMessage(_input: {
    threadId: string;
    memoryConfig?: MemoryConfig;
  }): Promise<string | null> {
    return null;
  }

  /**
   * Get tools that should be available to the agent.
   * This will be called when converting tools for the agent.
   * Implementations can override this to provide additional tools.
   */
  public getTools(_config?: MemoryConfig): Record<string, CoreTool> {
    return {};
  }

  public getMergedThreadConfig(config?: MemoryConfig): MemoryConfig {
    return config ? { ...this.threadConfig, ...config } : this.threadConfig;
  }

  /**
   * Main method to retrieve and process messages for conversation context
   */
  async rememberMessages({
    threadId,
    resourceId,
    config,
  }: {
    threadId: string;
    resourceId?: string;
    config?: MemoryConfig;
  }): Promise<{
    threadId: string;
    messages: CoreMessage[];
  }> {
    const threadConfig = this.getMergedThreadConfig(config);
    this.logger.debug('Remembering messages', { threadId, resourceId });

    // Get thread
    const thread = await this.getThreadById({ threadId });
    if (!thread) {
      this.logger.error('Thread not found', { threadId });
      throw new Error(`Thread not found: ${threadId}`);
    }

    // Get the messages using the query utility
    const { messages } = await MessageQueryUtils.queryMessages({
      repository: this.repository,
      threadId,
      selectBy: 'last',
      limit: typeof threadConfig.lastMessages === 'number' ? threadConfig.lastMessages : undefined,
      logger: this.logger,
    });

    return {
      threadId,
      messages,
    };
  }

  /**
   * Retrieves a specific thread by its ID
   */
  async getThreadById({ threadId }: { threadId: string }): Promise<RepositoryThreadType | null> {
    try {
      return await this.repository.getThread(threadId);
    } catch (error) {
      this.logger.error('Failed to get thread by ID', { threadId, error });
      throw error;
    }
  }

  /**
   * Gets threads by resource ID
   */
  async getThreadsByResourceId({
    resourceId,
  }: {
    resourceId: string;
  }): Promise<RepositoryThreadType[]> {
    try {
      return await this.repository.listThreads({ resourceId });
    } catch (error) {
      this.logger.error('Failed to get threads by resource ID', { resourceId, error });
      throw error;
    }
  }

  /**
   * Saves or updates a thread
   */
  async saveThread({
    thread,
    memoryConfig,
  }: {
    thread: RepositoryThreadType;
    memoryConfig?: MemoryConfig;
  }): Promise<RepositoryThreadType> {
    const config = this.getMergedThreadConfig(memoryConfig);

    try {
      const existingThread = await this.repository.getThread(thread.id);

      if (existingThread) {
        this.logger.debug('Updating existing thread', { threadId: thread.id });
        return await this.repository.updateThread(thread.id, thread);
      } else {
        this.logger.debug('Creating new thread', { threadId: thread.id });
        return await this.repository.createThread(thread);
      }
    } catch (error) {
      this.logger.error('Failed to save thread', { threadId: thread.id, error });
      throw error;
    }
  }

  /**
   * Saves messages to a thread
   */
  async saveMessages({
    messages,
    memoryConfig,
  }: {
    messages: MessageType[];
    memoryConfig: MemoryConfig | undefined;
  }): Promise<MessageType[]> {
    const config = this.getMergedThreadConfig(memoryConfig);

    const savedMessages: MessageType[] = [];

    for (const message of messages) {
      this.logger.debug('Saving message', { threadId: message.threadId, role: message.role });
      const savedMessage = await this.repository.createMessage(message);
      savedMessages.push(savedMessage);
    }

    return savedMessages;
  }

  /**
   * Retrieves all messages for a specific thread
   */
  async query({
    threadId,
    resourceId,
    selectBy,
    limit,
    before,
    after,
  }: {
    threadId: string;
    resourceId?: string;
    selectBy?: 'last' | 'range' | 'all';
    limit?: number;
    before?: number;
    after?: number;
  }): Promise<{ messages: CoreMessage[] }> {
    return MessageQueryUtils.queryMessages({
      repository: this.repository,
      threadId,
      selectBy,
      limit:
        limit ||
        (typeof this.threadConfig.lastMessages === 'number'
          ? this.threadConfig.lastMessages
          : undefined),
      logger: this.logger,
    });
  }

  /**
   * Creates a new conversation thread
   */
  async createThread({
    threadId,
    resourceId,
    title,
    metadata,
    memoryConfig,
  }: {
    resourceId: string;
    threadId?: string;
    title?: string;
    metadata?: Record<string, unknown>;
    memoryConfig?: MemoryConfig;
  }): Promise<RepositoryThreadType> {
    try {
      const now = new Date();

      const thread: RepositoryThreadType = {
        id: threadId || randomUUID(),
        resourceId,
        title,
        metadata,
        createdAt: now,
        updatedAt: now,
      };

      this.logger.debug('Creating thread', { threadId: thread.id, resourceId });
      return await this.saveThread({ thread, memoryConfig });
    } catch (error) {
      this.logger.error('Failed to create thread', { resourceId, error });
      throw error;
    }
  }

  /**
   * Deletes a thread and all its messages
   * This is an abstract method that must be implemented by subclasses
   * since the base Repository interface doesn't provide delete methods.
   */
  abstract deleteThread(threadId: string): Promise<void>;

  /**
   * Adds a message to a thread
   */
  async addMessage({
    threadId,
    config,
    content,
    role,
    type,
    toolNames,
    toolCallArgs,
    toolCallIds,
  }: {
    threadId: string;
    config?: MemoryConfig;
    content: UserContent | AssistantContent;
    role: 'user' | 'assistant';
    type: 'text' | 'tool-call' | 'tool-result';
    toolNames?: string[];
    toolCallArgs?: Record<string, unknown>[];
    toolCallIds?: string[];
  }): Promise<MessageType> {
    try {
      const thread = await this.getThreadById({ threadId });
      if (!thread) {
        const error = new Error(`Thread ${threadId} not found`);
        this.logger.error('Thread not found while adding message', { threadId, error });
        throw error;
      }

      const message: MessageType = {
        id: randomUUID(),
        threadId,
        content,
        role,
        type,
        createdAt: new Date(),
        ...(toolNames && { toolNames }),
        ...(toolCallArgs && { toolCallArgs }),
        ...(toolCallIds && { toolCallIds }),
      };

      this.logger.debug('Adding message to thread', { threadId, role, type });
      await this.saveMessages({
        messages: [message],
        memoryConfig: config || this.threadConfig,
      });

      // Update the thread's last activity time
      await this.saveThread({
        thread: {
          ...thread,
          updatedAt: new Date(),
        },
        memoryConfig: config,
      });

      return message;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw error; // Re-throw the specific error
      }
      this.logger.error('Failed to add message', { threadId, role, error });
      throw error;
    }
  }

  /**
   * Generates a unique ID
   */
  public generateId(): string {
    return randomUUID();
  }
}
