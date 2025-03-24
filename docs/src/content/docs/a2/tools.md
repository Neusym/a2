---
title: Tools
description: Understanding tools in A2
---

The A2 framework provides a powerful and flexible tools system that allows agents to interact with resources, perform calculations, and execute various actions. Tools in A2 are built on top of the AI SDK's tools capabilities, providing enhanced type safety, resource management, and execution context.

## Core Concepts

### Tool Architecture

A2's tool system consists of several key components:

- **Tool**: The base class for creating tools with type-safe input/output schemas
- **ToolRegistry**: A centralized registry for managing and retrieving tools
- **ResourceManager**: Manages resources and prompts that can be used by tools
- **Converter**: Utilities for converting between A2 tools and AI SDK tools

### Importing Tools

Tools can be imported from the core package:

```typescript
import { Tool, createTool } from '@a2/core';
```

## Creating Tools

A2 provides a simple and type-safe way to create tools using the `createTool` function:

```typescript
import { z } from 'zod';
import { createTool } from '@a2/core';

const calculatorTool = createTool({
  id: 'calculator',
  description: 'Perform mathematical calculations',
  inputSchema: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number().describe('First number'),
    b: z.number().describe('Second number'),
  }),
  outputSchema: z.number(),
  execute: async context => {
    const { operation, a, b } = context.context;

    switch (operation) {
      case 'add':
        return a + b;
      case 'subtract':
        return a - b;
      case 'multiply':
        return a * b;
      case 'divide':
        if (b === 0) throw new Error('Division by zero');
        return a / b;
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  },
});
```

## Tool Registry

The `ToolRegistry` provides a centralized way to register and retrieve tools:

```typescript
import { createToolRegistry } from '@a2/core';

const registry = createToolRegistry();
registry.register(calculatorTool);

// Later, retrieve the tool
const tool = registry.getTool('calculator');
```

## Resource Management

The ResourceManager helps manage resources and prompts that can be used by tools:

```typescript
import { DefaultResourceManager } from '@a2/core';

const resourceManager = new DefaultResourceManager({
  resourceDirectory: './resources',
});

// Add a resource
resourceManager.addResource({
  id: 'sample-data',
  content: JSON.stringify({ key: 'value' }),
  type: 'json',
});

// Add a prompt template
resourceManager.addPrompt('greeting', 'Hello, {{name}}!');
```

## Built-in Tools

A2 comes with several built-in tools:

### Resource Tools

- **get-resource**: Retrieves a resource by ID
- **list-resources**: Lists available resources
- **search-resources**: Searches for resources by content or metadata

### AI SDK Integration

A2 tools can be easily converted to AI SDK tools using the converter utilities:

```typescript
import { convertToolToVercelTool } from '@a2/core';

const aiSdkTool = convertToolToVercelTool(calculatorTool);
```

## Advanced Usage

### Tool Execution Context

Tools can access a rich execution context including primitives like storage, agents, memory, resources, and prompts:

```typescript
export interface ToolExecutionContext<TSchemaIn extends z.ZodSchema | undefined = undefined> {
  context: TSchemaIn extends z.ZodSchema ? z.infer<TSchemaIn> : {};
  runId?: string;
  threadId?: string;
  resourceId?: string;
  primitives?: {
    storage?: Storage;
    agents?: Record<string, Agent>;
    memory?: Memory;
    resources?: ResourceLibrary;
    prompts?: PromptLibrary;
  };
}
```

### Custom Tool Implementation

For more complex scenarios, you can extend the `Tool` class directly:

```typescript
import { Tool } from '@a2/core';
import { z } from 'zod';

const inputSchema = z.object({ query: z.string() });
const outputSchema = z.array(z.string());

class SearchTool extends Tool<typeof inputSchema, typeof outputSchema> {
  constructor() {
    super({
      id: 'search',
      description: 'Search for information',
      inputSchema,
      outputSchema,
      execute: async context => {
        // Implementation
        return ['result1', 'result2'];
      },
    });
  }
}
```

## @tools Wrapper

A2 provides a convenient wrapper for the AI SDK tools that simplifies integration and enhances type safety:

- Pre-configured tool instances
- Type-safe input/output interfaces
- Simplified integration with A2 agents
- Consistent error handling and logging
