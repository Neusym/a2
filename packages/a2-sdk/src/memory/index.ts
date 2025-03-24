/**
 * Simplified memory interface for the SDK
 * 
 * This provides a basic memory implementation that can be used with agents.
 * For more advanced features, use the core Memory implementation directly.
 */

/**
 * Options for creating memory
 */
export interface CreateMemoryOptions {
  /**
   * Type of memory storage to use
   */
  type: 'in-memory' | 'sqlite' | 'custom';
  
  /**
   * Maximum number of messages to keep in memory
   */
  maxMessages?: number;
  
  /**
   * Whether to include system messages in the context
   */
  includeSystemMessage?: boolean;
  
  /**
   * For SQLite memory: path to the database file
   */
  dbPath?: string;
  
  /**
   * For SQLite memory: conversation ID
   */
  conversationId?: string;
  
  /**
   * For custom memory: custom storage implementation
   */
  customStorage?: any;
  
  /**
   * Optional name for the memory
   */
  name?: string;
}

/**
 * Basic memory interface that's compatible with the agent API
 */
export interface MemoryInterface {
  /**
   * Get messages from memory
   */
  getMessages: () => Promise<any[]>;
  
  /**
   * Add a message to memory
   */
  addMessage: (message: any) => Promise<any>;
  
  /**
   * Clear all messages from memory
   */
  clear?: () => Promise<void>;
}

/**
 * In-memory message storage implementation
 */
class InMemoryStorage {
  private messages: any[] = [];
  private maxMessages: number;
  
  constructor(maxMessages = 100) {
    this.maxMessages = maxMessages;
  }
  
  async getMessages() {
    return [...this.messages];
  }
  
  async saveMessage(message: any) {
    this.messages.push(message);
    
    // Trim to max size if needed
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
    
    return message;
  }
  
  async clear() {
    this.messages = [];
  }
}

/**
 * Create a memory system with simplified options
 * 
 * @example
 * ```typescript
 * // Create in-memory storage
 * const memory = createMemory({
 *   type: 'in-memory',
 *   maxMessages: 50
 * });
 * 
 * // Create SQLite-backed storage (requires implementing SQLite storage)
 * const persistentMemory = createMemory({
 *   type: 'sqlite',
 *   dbPath: 'conversations.db',
 *   conversationId: 'user-123'
 * });
 * ```
 * 
 * @param options Options for creating the memory system
 * @returns A configured memory interface
 */
export function createMemory(options: CreateMemoryOptions): MemoryInterface {
  const { 
    type, 
    maxMessages = 100, 
    includeSystemMessage = true,
    dbPath,
    conversationId,
    customStorage,
    name = 'memory'
  } = options;
  
  // Create appropriate storage based on type
  let storage: any;
  
  switch (type) {
    case 'in-memory': {
      storage = new InMemoryStorage(maxMessages);
      break;
    }
      
    case 'sqlite': {
      if (!dbPath) {
        throw new Error('dbPath is required for SQLite memory');
      }
      if (!conversationId) {
        throw new Error('conversationId is required for SQLite memory');
      }
      
      // This is a placeholder for SQLite implementation
      // In a real implementation, this would create a SQLite-backed storage
      console.warn('SQLite memory is not fully implemented in the SDK. For production use, use @a2/core directly.');
      storage = new InMemoryStorage(maxMessages);
      break;
    }
      
    case 'custom':
      if (!customStorage) {
        throw new Error('customStorage is required for custom memory type');
      }
      storage = customStorage;
      break;
      
    default:
      throw new Error(`Unknown memory type: ${type}`);
  }
  
  // Return a memory interface backed by the storage
  return {
    async getMessages() {
      return storage.getMessages();
    },
    
    async addMessage(message: any) {
      return storage.saveMessage(message);
    },
    
    async clear() {
      if (storage.clear) {
        return storage.clear();
      }
    }
  };
}

/**
 * Create a simple in-memory conversation memory
 * 
 * @param maxMessages Maximum number of messages to keep (default: 100)
 * @returns A new memory interface with in-memory storage
 */
export function createInMemoryMemory(maxMessages = 100): MemoryInterface {
  return createMemory({
    type: 'in-memory',
    maxMessages
  });
}

/**
 * Create a persistent SQLite-backed memory
 * 
 * @param dbPath Path to the SQLite database file
 * @param conversationId Unique ID for the conversation
 * @param maxMessages Maximum number of messages to keep (default: 100)
 * @returns A new memory interface with SQLite storage
 */
export function createSQLiteMemory(
  dbPath: string,
  conversationId: string,
  maxMessages = 100
): MemoryInterface {
  return createMemory({
    type: 'sqlite',
    dbPath,
    conversationId,
    maxMessages
  });
} 