---
title: Agents
description: Comprehensive guide to the Agent System capabilities and features
---

# System

The Agent System provides a powerful, flexible framework for building AI-powered agents that can use tools, maintain memory, and interact with various resources. This document provides a comprehensive overview of the agent system's features and capabilities.

## Agent Overview

At its core, an Agent is an autonomous entity that can:

1. Process messages through AI models
2. Execute tools and functions
3. Maintain memory of conversations
4. Access and manipulate resources
5. Generate both text and structured object responses

## Creating an Agent

An agent is instantiated with a configuration object that defines its behavior:

```typescript
import { Agent } from '@a2/core';

const agent = new Agent({
  metadata: {
    name: 'My Agent',
    agentId: 'unique-agent-id',
    instructions: 'You are a helpful assistant...',
    goal: 'Help users solve problems',
    role: 'Assistant',
  },
  model: {
    modelName: 'gpt-4',
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    temperature: 0.7,
  },
  memory: memoryInstance, // optional
  tools: myTools, // optional
  resourceManager: resourceManagerInstance, // optional
});
```

## Agent Features

### Metadata

Each agent has metadata that defines its identity and behavior:

- **name**: Human-readable name of the agent
- **agentId**: Unique identifier for the agent
- **instructions**: Primary system instructions for the agent
- **goal** (optional): The agent's primary objective
- **role** (optional): The role the agent plays in a system

### Model Integration

Agents work with language models to generate responses:

- Support for various model providers (OpenAI, Anthropic, etc.)
- Custom model configuration (temperature, max tokens, etc.)
- Compatible with Vercel AI SDK's `LanguageModelV1` interface

### Tool Integration

Agents can use tools to perform actions:

```typescript
agent.configureTools({
  weatherTool: {
    id: 'weather',
    description: 'Get current weather for a location',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'The city and state, e.g. San Francisco, CA',
        },
      },
      required: ['location'],
    },
    execute: async params => {
      // Implementation to fetch weather data
      return { temperature: 72, conditions: 'sunny' };
    },
  },
});
```

Features include:

- Tool validation and normalization
- Support for different tool formats
- Tool selection control via toolChoice parameter
- Automatic tool execution and result handling

### Memory System

Agents can maintain conversation history:

- Thread-based conversation storage
- Automatic message retrieval and context building
- Message sanitization and processing
- Integration with custom memory implementations

### Resource Management

Agents can work with various resources:

- Documents for providing context
- Knowledge bases for information retrieval
- Personas for role-playing specific characters
- Custom prompts for specialized tasks

### Response Generation

Two primary modes of response generation:

1. **Text Generation**:

   ```typescript
   const result = await agent.generate(messages, {
     instructions: 'Additional instructions...',
     context: { user: 'Alice' },
     memoryOptions: { lastMessages: 5 },
   });
   console.log(result.text);
   ```

2. **Object Generation** (with schema validation):

   ```typescript
   import { z } from 'zod';

   const weatherSchema = z.object({
     temperature: z.number(),
     conditions: z.string(),
     forecast: z.array(z.string()),
   });

   const result = await agent.generate(messages, {
     output: weatherSchema,
   });
   console.log(result.object); // Typed object matching schema
   ```

### Streaming Support

For real-time interactions, agents support streaming responses:

```typescript
const stream = await agent.stream(messages);
for await (const chunk of stream.text) {
  console.log(chunk); // Process each chunk as it arrives
}
```

Advanced features include:

- Tool call streaming
- Real-time updates
- Event-based processing via callbacks

## Advanced Features

### Thread and Resource Management

Agents can work with specific conversation threads and resources:

```typescript
const result = await agent.generate(messages, {
  threadId: 'conversation-123',
  resourceId: 'document-456',
  runId: 'execution-789',
});
```

### Tool Execution Controls

Fine-grained control over tool execution:

- Maximum steps limitation
- Tool selection preferences
- Tool execution callbacks for monitoring

### Error Handling

Robust error handling for various scenarios:

- Model generation errors
- Tool execution failures
- Memory operation issues
- JSON parsing and validation errors

## Utility Functions

The agent system provides several utility functions:

- `makeCoreTool`: Create properly formatted tool definitions
- `ensureToolProperties`: Validate and normalize tool objects
- `isVercelTool`: Check if a tool follows the Vercel AI SDK format

## Integration with Event Systems

Agents can be integrated into event-driven architectures where multiple agents collaborate:

```typescript
// Example from the Task Management System
import { Agent, EventSystem } from '@a2/core';

const eventSystem = new EventSystem();
const taskManager = new TaskManagerAgent();
const assignmentAgent = new AssignmentAgent();

eventSystem.registerAgent(taskManager);
eventSystem.registerAgent(assignmentAgent);

// Agents communicate via events
taskManager.createTask('Debug the authentication module', 'high');
```

## Conclusion

The Agent System provides a powerful foundation for building AI-powered applications with autonomous agents. By combining language models, tools, memory, and resource management, it enables the creation of sophisticated systems that can solve complex problems through agent collaboration.
