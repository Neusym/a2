---
title: Processes
description: Understanding processes in A2
---

The Process module is the central orchestration and runtime environment for the A2 framework components. It manages the instantiation, execution, and monitoring of agents, workflows, and other components during application runtime.

## Usage

```typescript
import { Process } from '@a2/core';

// Create a new process with configuration
const process = new Process({
  agents: {
    assistant: {
      name: 'Assistant',
      instructions: 'You are a helpful assistant.',
      role: 'assistant',
    },
  },
});

// Initialize and run the process
await process.initialize();
await process.run();
```

## API Reference

### Creating a Process

```typescript
import { Process } from '@a2/core';

const process = new Process(config);
```

The Process constructor accepts an optional configuration object with the following properties:

- `agents`: Record of agent configurations
- `workflow`: Workflow configuration
- `logger`: Custom logger instance
- `repository`: Custom repository instance
- `apiMiddleware`: API middleware configurations
- `memory`: Memory instance
- `collab`: Collaboration instances

### Process Methods

#### `initialize()`

Initializes the process and all components.

```typescript
await process.initialize();
```

#### `run(triggerData?)`

Starts the Process, initiating the current workflow.

```typescript
await process.run(triggerData);
```

#### Agents

```typescript
// Get all agents
const agents = process.getAgents();

// Get specific agent
const agent = process.getAgent('agentId');

// Register a new agent
const agent = process.registerAgent('newAgent', agentConfig);

// Unregister an agent
process.unregisterAgent('agentId');
```

#### Workflows

```typescript
// Get current workflow
const workflow = process.getWorkflow();

// Set or replace workflow
const workflow = process.setWorkflow(workflowConfig, 'workflowId');

// Clear workflow
process.clearWorkflow();

// Start workflow
const instance = await process.startWorkflow(triggerData);
```

#### Other Utilities

```typescript
// Get logger
const logger = process.getLogger();

// Get/set memory
const memory = process.getMemory();
process.setMemory(memory);

// Get repository
const repository = process.getRepository();

// Get API middleware
const middleware = process.getApiMiddleware();

// Get collabs
const collabs = process.getCollabs();
const specificCollab = process.getCollabs('collabId');
```

### Events

The Process class extends EventEmitter and emits the following events:

- `agent:created`: When a new agent is created
- `agent:deleted`: When an agent is deleted
- `workflow:created`: When a workflow is created
- `workflow:deleted`: When a workflow is deleted
- `workflow:started`: When a workflow is started
- `workflow:completed`: When a workflow completes successfully
- `workflow:failed`: When a workflow fails
- `memory:initialized`: When memory is initialized
- `persistence:initialized`: When persistence is initialized
