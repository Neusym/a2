---
title: Memory
description: Understanding memory in A2
---

The Memory system in A2 provides a robust framework for managing conversation history, context retention, and thread-based interactions in AI applications.

## Overview

Memory in A2 is built on top of the Vercel AI SDK and provides a comprehensive way to store, retrieve, and manage conversation threads and messages. It enables applications to maintain context across user interactions, implement semantic recall, and provide custom storage solutions.

## Installation

```typescript
import { Memory } from '@a2/core';
```

## Core Concepts

### Threads

Threads represent conversations or interaction sessions. Each thread has:

- A unique ID
- An associated resource ID
- Optional title and metadata
- Creation and update timestamps

```typescript
// Creating a new thread
const thread = await memory.createThread({
  resourceId: 'user-123',
  title: 'Support Conversation',
  metadata: { source: 'chat', priority: 'high' },
});
```

### Messages

Messages are individual interactions within a thread. Each message has:

- Role (user, assistant, system, or tool)
- Content (can be text or structured data)
- Thread association
- Optional tool call information

```typescript
// Adding a message to a thread
const message = await memory.addMessage({
  threadId: thread.id,
  content: 'How can I help you today?',
  role: 'assistant',
  type: 'text',
});
```

## Memory Configuration

The Memory system can be configured with various options:

```typescript
const memoryConfig = {
  // Number of most recent messages to include (false for all messages)
  lastMessages: 10,

  // Whether to save context
  saveContext: true,

  // Configuration for retrieval-based memory
  retrievalConfig: {
    topK: 5,
    similarityThreshold: 0.7,
  },

  // Semantic recall options
  semanticRecall: {
    topK: 3,
    messageRange: { before: 5, after: 2 },
  },

  // Working memory configuration
  workingMemory: {
    enabled: true,
    template: 'custom-template',
    use: 'text-stream',
  },

  // Thread options
  threads: {
    generateTitle: true,
  },
};
```

## Main Features

### Message Retrieval

Retrieve messages from a thread with flexible query options:

```typescript
// Get the last 10 messages
const { messages } = await memory.query({
  threadId: 'thread-123',
  selectBy: 'last',
  limit: 10,
});
```

### Context Management

The Memory system automatically manages context windows to stay within token limits, prioritizing the most relevant information.

### Tool Integration

Memory supports tool calls and results, allowing for seamless integration with function calling in AI models:

```typescript
// Add a tool result message
const toolMessage = await memory.addMessage({
  threadId: 'thread-123',
  content: toolContent,
  role: 'assistant',
  type: 'tool-result',
  toolCallIds: ['tool-call-1'],
  toolNames: ['weatherTool'],
});
```

### Repository Storage

Memory uses repositories to store and retrieve data. By default, it uses SQLiteRepository, but can be configured with custom repositories:

```typescript
import { Memory, Repository } from '@a2/core';

// Create memory with custom repository
const memory = new Memory({
  name: 'custom-memory',
  repository: customRepository,
});
```

## Methods

The Memory class provides several methods for managing conversation history:

- `rememberMessages()` - Retrieve messages for conversation context
- `getThreadById()` - Get a specific thread by ID
- `getThreadsByResourceId()` - Get threads by resource ID
- `saveThread()` - Save or update a thread
- `createThread()` - Create a new thread
- `deleteThread()` - Delete a thread
- `addMessage()` - Add a message to a thread
- `query()` - Query messages with various filters

## Extending Memory

The Memory class is designed to be extendable for specific use cases:

```typescript
import { Memory } from '@a2/core';

class CustomMemory extends Memory {
  // Override methods for custom behavior
  async getSystemMessage({ threadId }) {
    // Custom system message logic
    return 'Custom system prompt';
  }

  // Implement required abstract methods
  async deleteThread(threadId) {
    // Custom thread deletion logic
  }
}
```

## Advanced Usage

### Semantic Recall

Configure semantic recall to intelligently retrieve relevant messages based on embeddings:

```typescript
const config = {
  semanticRecall: {
    topK: 5,
    messageRange: { before: 3, after: 1 },
  },
};

const { messages } = await memory.rememberMessages({
  threadId: 'thread-123',
  config,
});
```

### Working Memory

Enable working memory to maintain a summary of the conversation:

```typescript
const config = {
  workingMemory: {
    enabled: true,
    template: 'Summarize the key points of this conversation: {context}',
  },
};
```

## Examples

### Creating a Memory Instance

```typescript
import { Memory, SQLiteRepository } from '@a2/core';

const repository = new SQLiteRepository({ path: './memory.db' });
const memory = new Memory({
  name: 'chat-memory',
  repository,
  contextTokenLimit: 4000,
  threadConfig: {
    lastMessages: 15,
    semanticRecall: true,
  },
});
```

### Complete Conversation Flow

```typescript
// Create a thread
const thread = await memory.createThread({
  resourceId: 'user-456',
  title: 'Product Inquiry',
});

// Add user message
await memory.addMessage({
  threadId: thread.id,
  content: 'What is the price of your basic plan?',
  role: 'user',
  type: 'text',
});

// Retrieve conversation context
const { messages } = await memory.rememberMessages({
  threadId: thread.id,
});

// Add assistant response
await memory.addMessage({
  threadId: thread.id,
  content: 'Our basic plan starts at $9.99 per month.',
  role: 'assistant',
  type: 'text',
});
```
