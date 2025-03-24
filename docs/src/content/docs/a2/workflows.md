---
title: Workflows
description: Understanding workflows in A2
---

A2 Workflows is a powerful orchestration system for defining, executing, and managing complex sequences of operations. It provides a flexible, type-safe way to create pipelines of steps that can be conditionally executed, retried on failure, and monitored throughout their lifecycle.

## Installation

```typescript
import { Workflow, Step } from '@a2/core';
```

## Core Concepts

### Workflow

The central component of the A2 Workflow system. A workflow:

- Defines a sequence of steps to be executed
- Manages dependencies between steps
- Handles error conditions and retries
- Provides context for step execution
- Supports conditional branching and looping

```typescript
const workflow = new Workflow('document-processor', {
  triggerSchema: z.object({ documentId: z.string() }),
  defaultExecutionMode: ExecutionMode.SEQUENTIAL,
  logLevel: LogLevel.INFO,
});
```

### Step

A single unit of work within a workflow. Steps can:

- Define input and output schemas
- Perform actions when executed
- Depend on other steps
- Include retry logic
- Handle conditional execution
- Interact with workflow context

```typescript
workflow.step<string, ProcessedDocument>(
  'process-document',
  async (documentId, context) => {
    // Process the document and return the result
    return processedDocument;
  },
  {
    input: z.string(),
    output: ProcessedDocumentSchema,
    description: 'Processes a raw document',
  }
);
```

### Workflow Instance

A running instance of a workflow with:

- Current state of all steps
- Execution context
- Event handling capabilities
- Methods for starting, pausing, and resuming execution

```typescript
const instance = workflow.createRun({ documentId: 'doc-123' });
const state = await instance.start();
```

## Key Features

### Type Safety

All steps have strongly-typed inputs and outputs using Zod schemas, ensuring type safety throughout the workflow.

### Execution Modes

Workflows support different execution modes:

- `ExecutionMode.SEQUENTIAL`: Steps execute one after another
- `ExecutionMode.PARALLEL`: Steps execute concurrently where possible

### Step Dependencies

Steps can depend on the completion or outcome of other steps:

```typescript
processStep.after('fetch-document');
summarizeStep.after('process-document', 'success');
```

### Conditional Logic

Implement complex conditional logic within workflows:

```typescript
workflow
  .if({ path: 'document.type', operator: '==', value: 'pdf' })
  .then(pdfProcessingStep)
  .else(genericProcessingStep)
  .endIf();

// Or use while loops
workflow
  .while({ path: 'hasMorePages', operator: '==', value: true })
  .do(processPageStep)
  .endWhile();
```

### Error Handling & Retries

Configure retry behavior for steps that might fail:

```typescript
step.withRetry({
  maxAttempts: 3,
  backoffFactor: 1.5,
  initialDelay: 1000,
});
```

### Event System

Workflows can emit and react to events:

```typescript
workflow.addEvent({
  type: 'document-processed',
  schema: z.object({ documentId: z.string() }),
});

step.afterEvent('document-processed');
```

### Persistence

Workflows can be saved and restored:

```typescript
// Save workflow state
const persistenceId = await instance.getState().persistenceId;

// Restore workflow
const restoredInstance = await workflow.restoreRun(persistenceId);
```

### AI Agent Integration

A2 Workflows seamlessly integrate with A2 Agents:

```typescript
workflow.registerAgent(
  'summarizer',
  new A2Agent({
    /* config */
  })
);

// Use in a step
workflow.step(
  'summarize-content',
  async (content, context) => {
    return await context.agents.summarizer.generate({ text: content });
  },
  {
    /* schema config */
  }
);
```

### Observability

Monitor workflow execution with built-in telemetry:

```typescript
const workflow = new Workflow('data-pipeline', {
  telemetryProvider: new OpenTelemetryProvider(),
});
```

## Advanced Usage

### Step Groups

Organize steps into logical groups with specific execution modes:

```typescript
workflow.group(
  'data-processing',
  ['extract-data', 'transform-data', 'validate-data'],
  ExecutionMode.PARALLEL
);
```

### Variable Binding

Create steps that utilize dynamic variables from context:

```typescript
step.withVariable('documentType', context => context.triggerData.type);
```

### Custom Events

Build reactive workflows with custom events:

```typescript
step.afterEvent('processing-complete', async (event, context) => {
  // Custom handler logic
});
```

### Suspending and Resuming

Implement workflows that can pause and resume:

```typescript
// In a step's execute function
context.suspend('waiting-for-approval');

// Later, resume the workflow
instance.resume();
```

## Example

```typescript
import { Workflow, ExecutionMode, LogLevel } from '@a2/core';
import { z } from 'zod';

// Define workflow
const workflow = new Workflow('document-processor', {
  triggerSchema: z.object({ documentId: z.string() }),
  defaultExecutionMode: ExecutionMode.SEQUENTIAL,
  logLevel: LogLevel.INFO,
});

// Define steps
const fetchStep = workflow.step<{ documentId: string }, string>(
  'fetch-document',
  async (input, context) => {
    return await fetchDocumentById(input.documentId);
  },
  {
    input: z.object({ documentId: z.string() }),
    output: z.string(),
    description: 'Fetches document by ID',
  }
);

const processStep = workflow
  .step<string, ProcessedDocument>(
    'process-document',
    async (document, context) => {
      return await processDocument(document);
    },
    {
      input: z.string(),
      output: ProcessedDocumentSchema,
      description: 'Processes the document',
    }
  )
  .after('fetch-document');

// Create and run an instance
const instance = workflow.createRun({ documentId: 'doc-123' });
const finalState = await instance.start();
```

By leveraging the A2 Workflow system, you can create complex, resilient processes that handle errors gracefully, execute steps in the optimal order, and maintain a clear audit trail of execution.
