---
title: Providers
description: Understanding providers in A2
---

Providers in A2 are integrations with various AI model providers like OpenAI and Anthropic. The provider system allows you to seamlessly work with different language models through a unified interface.

## Installation Requirements

To use specific providers, install the corresponding packages:

```bash
# For OpenAI support
pnpm add @ai-sdk/openai

# For Anthropic support
pnpm add @ai-sdk/anthropic
```

## Built on Vercel AI SDK

A2's provider system is built on top of the Vercel AI SDK, leveraging its core functionality while adding enhanced features and a simplified interface:

### Integration with Vercel AI SDK

- A2 wraps the Vercel AI SDK's `LanguageModelV1` interface
- Uses SDK functions like `generateText`, `streamText`, and `generateObject`
- Dynamically imports provider-specific modules from the AI SDK
- Adds additional error handling and logging capabilities

```typescript
// Example of how A2 wraps the Vercel AI SDK
import {
  LanguageModelV1,
  generateText as aiGenerateText,
  streamText as aiStreamText,
  generateObject as aiGenerateObject
} from 'ai';

export class Model {
  private model: LanguageModelV1;

  constructor(model: LanguageModelV1, config: Partial<ModelConfig> = {}) {
    this.model = model;
    // Additional setup...
  }

  // Wraps the SDK's generateText with additional functionality
  public async generateText(prompt: string, options = {}) {
    // A2-specific preprocessing
    const result = await aiGenerateText({
      model: this.model,
      messages: [...],
      // Configure parameters
    });
    // A2-specific postprocessing
    return result.text;
  }
}
```

### Provider Management

A2 simplifies provider management by:

1. **Auto-detection**: Attempts to dynamically import provider modules
2. **Configuration standardization**: Provides a unified configuration interface
3. **Provider abstraction**: Shields your code from provider-specific implementation details

```typescript
// How A2 initializes different providers
public static fromConfig(config: ModelConfig & { apiKey: string }): Model {
  const { provider, modelName, apiKey, ...otherConfig } = config;

  let model: LanguageModelV1;

  switch (provider) {
    case 'openai':
      // Initialize OpenAI provider from AI SDK
      model = new OpenAIModule.OpenAI({ apiKey });
      break;
    case 'anthropic':
      // Initialize Anthropic provider from AI SDK
      model = new AnthropicModule.Anthropic({ apiKey });
      break;
    // Other providers...
  }

  return new Model(model, { modelName, provider, ...otherConfig });
}
```

### Benefits of the Vercel AI SDK Foundation

- **Standardized interfaces**: Work with different providers through consistent methods
- **Future compatibility**: New AI providers can be added easily
- **Performance optimizations**: Takes advantage of Vercel AI SDK's optimizations
- **Type safety**: Full TypeScript support through Zod schemas and strong typing

## Overview

The `@a2/core` package includes a provider system that:

- Offers a consistent interface for multiple AI providers
- Supports text generation, object generation, and streaming
- Handles conversation management and tool execution
- Provides TypeScript types for type safety

## Supported Providers

A2 currently supports the following providers:

- **OpenAI** - Access to GPT models like GPT-4
- **Anthropic** - Access to Claude models
- **Custom** - Support for custom model implementations

## Getting Started

To use a provider, you'll need to install the corresponding AI SDK package and configure a model:

```typescript
import { Model } from '@a2/core';

// Create an OpenAI model
const openaiModel = Model.fromConfig({
  provider: 'openai',
  modelName: 'gpt-4',
  apiKey: 'your-api-key',
  temperature: 0.7,
});

// Create an Anthropic model
const anthropicModel = Model.fromConfig({
  provider: 'anthropic',
  modelName: 'claude-3-opus-20240229',
  apiKey: 'your-api-key',
});
```

## Model Configuration

When configuring a model, you can set various parameters:

```typescript
interface ModelConfig {
  modelName: string; // Model name (e.g. "gpt-4")
  provider: string; // Provider name (e.g. "openai")
  temperature?: number; // Model temperature (0-1)
  maxTokens?: number; // Maximum tokens to generate
  topP?: number; // Top-p sampling (0-1)
  topK?: number; // Top-k sampling
  frequencyPenalty?: number; // Frequency penalty (0-2)
  presencePenalty?: number; // Presence penalty (0-2)
  options?: Record<string, unknown>; // Additional provider-specific options
}
```

## Basic Usage

### Text Generation

Generate text from a prompt:

```typescript
const response = await model.generateText('Hello, how are you?');
console.log(response);
```

### Chat Conversations

Have a multi-turn conversation:

```typescript
const messages = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Tell me about A2.' },
];

const response = await model.chat(messages);
console.log(response);
```

### Streaming Responses

Stream responses for real-time display:

```typescript
const stream = model.streamText('Explain quantum computing');
for await (const chunk of stream) {
  process.stdout.write(chunk);
}
```

## Advanced Features

### Tool Execution

A2 supports tool calling, allowing models to use functions:

```typescript
// Define a tool
const weatherTool = model.createTool('getWeather', {
  description: 'Get the weather for a location',
  parameters: z.object({
    location: z.string().describe('The city and state')
  }),
  execute: async ({ location }) => {
    // Fetch weather data
    return { temperature: 72, conditions: 'sunny' };
  }
});

// Use the tool in a generation
const response = await model.generateText('What's the weather in San Francisco?', {
  tools: { getWeather: weatherTool }
});
```

### Structured Output

Generate structured objects with Zod validation:

```typescript
import { z } from 'zod';

const personSchema = z.object({
  name: z.string(),
  age: z.number(),
  bio: z.string(),
});

const person = await model.generateObject(
  'Generate information about a fictional person',
  personSchema
);

console.log(person.name, person.age, person.bio);
```

## Implementing Custom Providers

For advanced use cases, you can implement custom providers by creating a compatible language model that adheres to the Vercel AI SDK's `LanguageModelV1` interface.
