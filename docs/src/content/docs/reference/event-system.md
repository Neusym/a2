---
title: EventSystem Class
description: API reference for the EventSystem class in the Agent System framework
---

# EventSystem Class

The `EventSystem` class is the central hub for event management in the Agent System framework. It facilitates communication between agents by routing events to the appropriate handlers.

## Constructor

```typescript
constructor(options?: EventSystemOptions)
```

Creates a new event system instance.

| Parameter | Type                 | Description                                           |
| --------- | -------------------- | ----------------------------------------------------- |
| `options` | `EventSystemOptions` | (Optional) Configuration options for the event system |

### EventSystemOptions

| Property  | Type      | Description                                               |
| --------- | --------- | --------------------------------------------------------- |
| `debug`   | `boolean` | When true, enables debug logging for event processing     |
| `timeout` | `number`  | Maximum time in milliseconds to wait for event processing |

## Methods

### registerAgent

```typescript
registerAgent(agent: Agent): void
```

Registers an agent with the event system, allowing it to receive events.

| Parameter | Type    | Description           |
| --------- | ------- | --------------------- |
| `agent`   | `Agent` | The agent to register |

#### Returns

`void`

### unregisterAgent

```typescript
unregisterAgent(agentId: string): boolean
```

Unregisters an agent from the event system.

| Parameter | Type     | Description                       |
| --------- | -------- | --------------------------------- |
| `agentId` | `string` | The ID of the agent to unregister |

#### Returns

`boolean` - true if the agent was successfully unregistered, false otherwise

### emit

```typescript
emit<T extends Event>(event: T, source?: string): Promise<any>
```

Emits an event to be processed by registered agents.

| Parameter | Type              | Description                    |
| --------- | ----------------- | ------------------------------ |
| `event`   | `T extends Event` | The event to emit              |
| `source`  | `string`          | (Optional) The source agent ID |

#### Returns

`Promise<any>` - Resolves with the result of processing the event

### getAgent

```typescript
getAgent(agentId: string): Agent | undefined
```

Gets an agent by its ID.

| Parameter | Type     | Description         |
| --------- | -------- | ------------------- |
| `agentId` | `string` | The ID of the agent |

#### Returns

`Agent | undefined` - The agent if found, otherwise undefined

### getAgents

```typescript
getAgents(): Agent[]
```

Gets all registered agents.

#### Returns

`Agent[]` - An array of all registered agents

## Usage Example

```typescript
import { EventSystem, Agent } from '@agent-system/core';

// Create agents
class GreeterAgent extends Agent {
  constructor() {
    super('greeter');
    this.on('greeting', event => {
      console.log(`Received: ${event.message}`);
      return { type: 'greeting-response', message: 'Hello there!' };
    });
  }
}

class RespondingAgent extends Agent {
  constructor() {
    super('responder');
    this.on('greeting-response', event => {
      console.log(`Response received: ${event.message}`);
      return { type: 'follow-up', message: 'How are you?' };
    });
  }
}

// Set up event system
const eventSystem = new EventSystem({ debug: true });

// Register agents
const greeter = new GreeterAgent();
const responder = new RespondingAgent();
eventSystem.registerAgent(greeter);
eventSystem.registerAgent(responder);

// Emit an event
async function runExample() {
  const result = await eventSystem.emit({
    type: 'greeting',
    message: 'Hello world',
  });

  console.log('Final result:', result);
}

runExample();
```
