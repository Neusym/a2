/**
 * Repository interface for the persistence layer
 */

import { Message, Thread } from '../memory/types';

/**
 * Options for listing threads
 */
export interface ListThreadsOptions {
  limit?: number;
  offset?: number;
  resourceId?: string;
}

/**
 * Options for listing messages
 */
export interface ListMessagesOptions {
  limit?: number;
  before?: number;
  after?: number;
}

/**
 * Repository interface for persisting threads and messages
 */
export interface Repository {
  /**
   * Initialize repository (create tables if needed)
   */
  init(): Promise<void>;

  /**
   * Create a new thread
   */
  createThread(thread: Omit<Thread, 'createdAt' | 'updatedAt'>): Promise<Thread>;

  /**
   * Get a thread by ID
   */
  getThread(threadId: string): Promise<Thread | null>;

  /**
   * Update thread properties
   */
  updateThread(threadId: string, update: Partial<Thread>): Promise<Thread>;

  /**
   * List all threads
   */
  listThreads(options?: ListThreadsOptions): Promise<Thread[]>;

  /**
   * Create a new message
   */
  createMessage(message: Omit<Message, 'createdAt'>): Promise<Message>;

  /**
   * Get a message by ID
   */
  getMessage(messageId: string): Promise<Message | null>;

  /**
   * List messages in a thread
   */
  listMessages(threadId: string, options?: ListMessagesOptions): Promise<Message[]>;

  /**
   * Get the last N messages from a thread
   */
  getLastMessages(threadId: string, limit: number): Promise<Message[]>;
}
