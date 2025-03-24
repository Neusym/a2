---
title: Resources
description: Understanding resources in A2
---

Resources in A2 are a powerful system for managing and accessing structured content that your agents can utilize. The Resource system provides a consistent way to store, retrieve, and manipulate different types of content, from prompt templates to files.

## Overview

The A2 Resource system is composed of:

- **Resources**: Individual content items with metadata
- **ResourceManager**: A service for managing resources and prompts
- **Prompt Templates**: Parameterized text templates that can be rendered with variables
- **Resource Tools**: A set of tools for working with resources within agent workflows

## Getting Started

Import the Resource system from the core package:

```typescript
import { DefaultResourceManager, ResourceManager } from '@a2/core';
```

Create a resource manager instance:

```typescript
const resourceManager = new DefaultResourceManager({
  resourceDirectory: './resources', // Optional: path to store/load resources
});
```

## Working with Resources

### Resource Structure

Resources have the following structure:

```typescript
interface Resource {
  id: string; // Unique identifier
  content: string; // The actual content
  type: string; // Type of resource (e.g., 'text', 'json', 'prompt')
  metadata?: Record<string, any>; // Optional additional metadata
}
```

### Managing Resources

```typescript
// Add a resource
resourceManager.addResource({
  id: 'welcome-message',
  content: 'Welcome to the A2 framework!',
  type: 'text',
});

// Get a resource
const welcomeMsg = resourceManager.getResource('welcome-message');

// Update a resource
resourceManager.updateResource('welcome-message', {
  content: 'Welcome to the new A2 framework!',
});

// List all resources
const resourceIds = resourceManager.listResources();

// Get resources of a specific type
const textResources = resourceManager.getResourcesByType('text');

// Remove a resource
resourceManager.removeResource('welcome-message');
```

### File Operations

The Resource Manager provides methods for working with files:

```typescript
// Load a resource from a file
const jsonResource = resourceManager.loadResourceFromFile('./data.json', 'json', {
  description: 'Configuration data',
});

// Save a resource to a file
resourceManager.saveResourceToFile('config-data', './saved-config.json');

// Load all resources from a directory
const resources = resourceManager.loadResourcesFromDirectory('./resources', 'json');

// Export resources to files
resourceManager.exportResourcesToDirectory(
  ['welcome-message', 'config-data'],
  './exported-resources'
);
```

## Working with Prompts

The Resource Manager also provides a prompt management system, allowing for reusable, parametrized prompt templates.

### Prompt Types

Prompts can be either static strings or template functions:

```typescript
// Static prompt
resourceManager.addPrompt('greeting', 'Hello, how can I help you today?');

// Template function
resourceManager.addPrompt(
  'personalized-greeting',
  params => `Hello ${params.name}, how can I help you today?`
);
```

### Using Prompts

```typescript
// Get a prompt
const greeting = resourceManager.getPrompt('greeting');

// Render a prompt with parameters
const personalGreeting = resourceManager.renderPrompt('personalized-greeting', {
  name: 'Alice',
});

// Compose multiple prompts
const fullPrompt = resourceManager.composePrompt(['greeting', 'instructions', 'examples'], {
  userName: 'Bob',
});
```

## Resource Tools

A2 provides tools that agents can use to work with resources:

- `get-resource`: Retrieve a resource by ID
- `list-resources`: List available resources, optionally filtered by type
- `get-prompt`: Get a prompt by name
- `render-prompt`: Render a prompt with parameters

These tools can be integrated into your agent's toolset to allow manipulation of resources during execution.

## Best Practices

- **Organization**: Group related resources by type for easier management
- **Naming Conventions**: Use clear, consistent naming for resource IDs
- **Parameterization**: Create flexible prompt templates using parameters
- **Persistence**: Use the file operations to persist important resources

## Example: Building a Knowledge Base

```typescript
// Create a resource manager with a dedicated directory
const knowledgeBase = new DefaultResourceManager({
  resourceDirectory: './knowledge-base',
});

// Load existing resources from the directory
knowledgeBase.loadResourcesFromDirectory('./knowledge-base');

// Add a new knowledge article
knowledgeBase.addResource({
  id: 'api-usage',
  content: '# API Usage Guide\n\nThis document explains...',
  type: 'markdown',
  metadata: {
    author: 'A2 Team',
    lastUpdated: new Date().toISOString(),
  },
});

// Create a prompt that references knowledge
knowledgeBase.addPrompt(
  'answer-with-knowledge',
  params => `Use the following information to answer the question:
  
${params.resourceContent}

Question: ${params.question}
Answer:`
);

// Use the knowledge in an agent interaction
const apiGuide = knowledgeBase.getResource('api-usage');
const prompt = knowledgeBase.renderPrompt('answer-with-knowledge', {
  resourceContent: apiGuide.content,
  question: 'How do I authenticate to the API?',
});
```
