# A2 SDK

A2 SDK is a powerful toolkit for building AI agents, workflows, and tools using the A2 Core framework. It provides a simplified interface for creating and managing AI components with native support for leading LLM providers like OpenAI and Anthropic.


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

- **Agents**: AI entities that process information and generate responses
- **Processes**: Sequential steps for handling complex tasks
- **Workflows**: Coordinated execution of multiple agents and processes
- **Memory**: Storage systems for maintaining context and history
- **Tools**: Functional capabilities that agents can use
- **Resources**: External data and services that agents can access

## Creating Agents

```typescript
const agent = sdk.createAgent({
  name: 'Code Assistant',
  instructions: 'You are a coding assistant that helps with TypeScript.',
  model: 'gpt-4', // Optional if set in SDK config
  provider: 'openai', // Optional if set in SDK config
  tools: {
    searchDocs: async (query: string) => {
      /* ... */
    },
  },
});

// Generate response
const textResponse = await agent.generate('How do I use TypeScript interfaces?');

// Generate structured output
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

// Stream responses
for await (const chunk of agent.stream('Explain Redux in simple terms')) {
  process.stdout.write(chunk.text);
}
```

## Working with Memory

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

## Creating Processes and Workflows

```typescript
// Create a process with sequential steps
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

// Create a workflow to orchestrate multiple agents
const workflow = sdk.createWorkflow({
  name: 'Content Creation Pipeline',
  agents: {
    researcher: sdk.createAgent({ name: 'Researcher', instructions: 'Research topics thoroughly' }),
    writer: sdk.createAgent({ name: 'Writer', instructions: 'Write engaging content' }),
    editor: sdk.createAgent({ name: 'Editor', instructions: 'Edit and improve content' }),
  },
  flowDefinition: [
    { id: 'research', agent: 'researcher', input: '{{initial}}', output: 'researchFindings' },
    { id: 'write', agent: 'writer', input: '{{researchFindings}}', output: 'draftContent' },
    { id: 'edit', agent: 'editor', input: '{{draftContent}}', output: 'finalContent' },
  ],
});
```

## Creating Tools and Resources

```typescript
// Define a tool for agents
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

// Define a resource for external services
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
```

## Best Practices

- Initialize the SDK once and reuse it
- Set default configurations at the SDK level
- Choose the right memory implementation for your use case
- Implement proper error handling for LLM interactions
- Use streaming responses for better user experience
- Use structured outputs when specific data formats are needed

## Troubleshooting

- **Provider not found**: Ensure you've installed the appropriate provider package
- **Authentication errors**: Verify your API keys are correctly set
- **Memory persistence**: For persistent memory across sessions, use an external storage provider
