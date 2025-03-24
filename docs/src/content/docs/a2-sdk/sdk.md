---
title: A2 SDK Documentation
description: Comprehensive guide to using the A2 SDK for building AI agents, workflows, and tools
---

# A2 SDK

A2 SDK is a powerful toolkit for building AI agents, workflows, and tools using the A2 Core framework. It provides a simplified interface for creating and managing AI components with native support for leading LLM providers like OpenAI and Anthropic.

## Installation

Install the A2 SDK using pnpm:

```bash
pnpm add @a2/sdk
```

For OpenAI support:

```bash
pnpm add @ai-sdk/openai
```

For Anthropic support:

```bash
pnpm add @ai-sdk/anthropic
```

## Quick Start

```typescript
import { A2SDK } from '@a2/sdk';

// Create a new SDK instance
const sdk = new A2SDK({
  apiKey: process.env.OPENAI_API_KEY,
  defaultProvider: 'openai',
  defaultModel: 'gpt-4',
});

// Create an agent
const agent = sdk.createAgent({
  name: 'Help Assistant',
  instructions: 'You are a helpful assistant that answers questions concisely.',
});

// Generate a response
const response = await agent.generate('What is the A2 SDK?');
console.log(response.text);
```

## Core Concepts

The A2 SDK provides a simple interface to work with the following core components:

- **Agents**: AI entities that can process information and generate responses
- **Processes**: Sequential steps for handling complex tasks
- **Workflows**: Coordinated execution of multiple agents and processes
- **Memory**: Storage systems for maintaining context and history
- **Tools**: Functional capabilities that agents can use
- **Resources**: External data and services that agents can access

## SDK Configuration

The `A2SDK` class accepts the following configuration options:

```typescript
interface A2SDKConfig {
  // Default API key for models
  apiKey?: string;

  // Default model provider ('openai' | 'anthropic' | 'custom')
  defaultProvider?: string;

  // Default model name
  defaultModel?: string;

  // Logger configuration
  logger?: any;

  // SDK component name
  name?: string;

  // Additional configuration options for core components
  coreOptions?: ComponentConfig;
}
```

## Creating Agents

Agents are the primary way to interact with language models:

```typescript
const agent = sdk.createAgent({
  name: 'Code Assistant',
  instructions: 'You are a coding assistant that helps with TypeScript.',
  model: 'gpt-4', // Optional if set in SDK config
  provider: 'openai', // Optional if set in SDK config
  apiKey: 'your-api-key', // Optional if set in SDK config
  tools: {
    // Custom tools the agent can use
    searchDocs: async (query: string) => {
      /* ... */
    },
  },
  memory: customMemory, // Optional custom memory implementation
  metadata: {
    // Optional metadata
    expertise: ['typescript', 'react', 'node'],
  },
});
```

### Agent Methods

```typescript
// Generate a text response
const textResponse = await agent.generate('How do I use TypeScript interfaces?');
console.log(textResponse.text);

// Generate with structured output
const jsonSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    codeSnippet: { type: 'string' },
    difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
  },
  required: ['summary', 'codeSnippet', 'difficulty'],
};

const structuredResponse = await agent.generateObject('Explain TypeScript interfaces', jsonSchema);
console.log(structuredResponse.data);

// Stream responses
for await (const chunk of agent.stream('Explain Redux in simple terms')) {
  process.stdout.write(chunk.text);
}
```

## Working with Memory

Memory allows agents to maintain context across interactions:

```typescript
const memory = sdk.createMemory({
  type: 'vector',
  config: {
    embeddings: {
      provider: 'openai',
      model: 'text-embedding-3-small',
      dimensions: 1536,
    },
    storage: {
      type: 'inmemory', // Or 'redis', 'pinecone', etc.
    },
  },
});

const agent = sdk.createAgent({
  name: 'Memory-Enabled Assistant',
  instructions: 'You are a helpful assistant that remembers previous conversations.',
  memory: memory,
});
```

## Creating Processes

Processes allow you to define a sequence of steps:

```typescript
const process = sdk.createProcess({
  name: 'Document Analysis',
  steps: [
    {
      name: 'Extract Key Information',
      handler: async (input, context) => {
        const agent = sdk.createAgent({
          name: 'Extractor',
          instructions: 'Extract key information from documents',
        });

        return await agent.generate(`Extract key points from: ${input}`);
      },
    },
    {
      name: 'Summarize',
      handler: async (input, context) => {
        const agent = sdk.createAgent({
          name: 'Summarizer',
          instructions: 'Create concise summaries',
        });

        return await agent.generate(`Summarize these key points: ${input}`);
      },
    },
  ],
});

const result = await process.run('Long document text here...');
```

## Creating Workflows

Workflows orchestrate multiple agents and processes:

```typescript
const workflow = sdk.createWorkflow({
  name: 'Content Creation Pipeline',
  agents: {
    researcher: sdk.createAgent({
      name: 'Researcher',
      instructions: 'Research topics thoroughly',
    }),
    writer: sdk.createAgent({
      name: 'Writer',
      instructions: 'Write engaging content',
    }),
    editor: sdk.createAgent({
      name: 'Editor',
      instructions: 'Edit and improve content',
    }),
  },
  flowDefinition: [
    {
      id: 'research',
      agent: 'researcher',
      input: '{{initial}}',
      output: 'researchFindings',
    },
    {
      id: 'write',
      agent: 'writer',
      input: '{{researchFindings}}',
      output: 'draftContent',
    },
    {
      id: 'edit',
      agent: 'editor',
      input: '{{draftContent}}',
      output: 'finalContent',
    },
  ],
});

const result = await workflow.run('Create content about TypeScript best practices');
console.log(result.finalContent);
```

## Creating Tools

Tools provide agents with additional capabilities:

```typescript
const searchTool = sdk.createTool({
  name: 'search',
  description: 'Search for information on a topic',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query' },
    },
    required: ['query'],
  },
  handler: async ({ query }) => {
    // Implementation of search functionality
    return `Results for "${query}"`;
  },
});

const agent = sdk.createAgent({
  name: 'Research Assistant',
  instructions: 'You are a research assistant',
  tools: {
    search: searchTool,
  },
});
```

## Creating Resources

Resources provide access to external data or services:

```typescript
const databaseResource = sdk.createResource({
  name: 'database',
  type: 'postgres',
  config: {
    connectionString: process.env.DATABASE_URL,
  },
  methods: {
    query: async sql => {
      // Implementation of database query
      return [{ id: 1, name: 'Example' }];
    },
  },
});

const agent = sdk.createAgent({
  name: 'Data Analyst',
  instructions: 'Analyze data and provide insights',
  tools: {
    queryDatabase: async query => {
      return await databaseResource.methods.query(query);
    },
  },
});
```

## Agent Chains

You can create chains of agents that pass information sequentially:

```typescript
const researchAgent = sdk.createAgent({
  name: 'Researcher',
  instructions: 'Research information',
});

const writerAgent = sdk.createAgent({
  name: 'Writer',
  instructions: 'Write content based on research',
});

const chain = createAgentChain([researchAgent, writerAgent]);
const result = await chain.run('Tell me about TypeScript');

console.log(result.result); // Final output from writerAgent
console.log(result.allResponses); // All intermediate responses
```

## Advanced Usage

### Custom Model Providers

You can integrate custom model providers:

```typescript
import { CustomModel } from 'your-custom-model-library';

const customModel = new CustomModel({
  // Custom model configuration
});

const agent = sdk.createAgent({
  name: 'Custom Model Agent',
  instructions: 'You are powered by a custom model',
  model: customModel,
  provider: 'custom',
});
```

### Direct Access to Core Framework

```typescript
// Access the underlying A2 Core framework
const core = sdk.core;

// Use core functionality directly
const coreAgent = core.agent.create({
  // More advanced configuration options
});
```

## Versioning

```typescript
// Get version information
const version = sdk.version;
console.log(`SDK Version: ${version.sdk}, Core Version: ${version.core}`);
```

## Best Practices

1. **Initialize the SDK once**: Create a single SDK instance and reuse it
2. **Set default configurations**: Configure defaults at the SDK level to avoid repetition
3. **Use appropriate memory**: Choose the right memory implementation for your use case
4. **Error handling**: Always implement proper error handling for LLM interactions
5. **Streaming for UX**: Use streaming responses for better user experience with long-running operations
6. **Structured outputs**: Use structured outputs (generateObject) when you need specific data formats

## Troubleshooting

- **Provider not found**: Ensure you've installed the appropriate provider package (`@ai-sdk/openai` or `@ai-sdk/anthropic`)
- **Authentication errors**: Verify your API keys are correctly set
- **Memory persistence**: For persistent memory across sessions, use an external storage provider
