---
title: Repository
description: Understanding the Repository system in A2
---

The Repository system in A2 provides a standardized interface for persisting and retrieving threads and messages. It serves as the persistence layer for the A2 framework.

## Installation

The A2 Repository can be imported from the `@a2/core` package:

```typescript
import { Repository, SQLiteRepository } from '@a2/core';
```

## Repository Interface

The Repository interface defines the standard methods for working with threads and messages:

```typescript
interface Repository {
  init(): Promise<void>;

  // Thread operations
  createThread(thread: Omit<Thread, 'createdAt' | 'updatedAt'>): Promise<Thread>;
  getThread(threadId: string): Promise<Thread | null>;
  updateThread(threadId: string, update: Partial<Thread>): Promise<Thread>;
  listThreads(options?: ListThreadsOptions): Promise<Thread[]>;

  // Message operations
  createMessage(message: Omit<Message, 'createdAt'>): Promise<Message>;
  getMessage(messageId: string): Promise<Message | null>;
  listMessages(threadId: string, options?: ListMessagesOptions): Promise<Message[]>;
  getLastMessages(threadId: string, limit: number): Promise<Message[]>;
}
```

### Thread Operations

- **init()**: Initializes the repository (creates tables if needed)
- **createThread()**: Creates a new conversation thread
- **getThread()**: Retrieves a thread by its ID
- **updateThread()**: Updates a thread's properties
- **listThreads()**: Lists threads with optional filtering

### Message Operations

- **createMessage()**: Creates a new message in a thread
- **getMessage()**: Retrieves a message by its ID
- **listMessages()**: Lists messages in a thread with optional filtering
- **getLastMessages()**: Gets the most recent messages from a thread

## Options Interfaces

### ListThreadsOptions

```typescript
interface ListThreadsOptions {
  limit?: number; // Maximum number of threads to return
  offset?: number; // Number of threads to skip
  resourceId?: string; // Filter threads by resource ID
}
```

### ListMessagesOptions

```typescript
interface ListMessagesOptions {
  limit?: number; // Maximum number of messages to return
  before?: number; // Return messages created before this timestamp
  after?: number; // Return messages created after this timestamp
}
```

## SQLite Implementation

A2 comes with a SQLite implementation of the Repository interface:

```typescript
import { SQLiteRepository } from '@a2/core';

const repository = new SQLiteRepository({
  dbPath: './custom-path/memory.sqlite', // Optional, defaults to './memory.sqlite'
});

// Initialize the repository (creates tables if they don't exist)
await repository.init();
```

### SQLiteRepositoryOptions

```typescript
interface SQLiteRepositoryOptions {
  dbPath?: string; // Path to the SQLite database file
}
```

## Examples

### Creating and Using Threads

```typescript
import { SQLiteRepository } from '@a2/core';

const repository = new SQLiteRepository();
await repository.init();

// Create a new thread
const thread = await repository.createThread({
  id: 'thread-123',
  metadata: { topic: 'AI Discussion' },
});

// Update thread properties
await repository.updateThread('thread-123', {
  metadata: { topic: 'Advanced AI Discussion' },
});

// List all threads
const threads = await repository.listThreads();
```

### Working with Messages

```typescript
// Create a message in a thread
const message = await repository.createMessage({
  id: 'msg-123',
  threadId: 'thread-123',
  role: 'user',
  content: { type: 'text', text: 'Hello AI!' },
});

// Get the last 10 messages from a thread
const recentMessages = await repository.getLastMessages('thread-123', 10);
```
