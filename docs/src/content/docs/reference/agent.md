---
title: Agent Class
description: API reference for the Agent class in the Agent System framework
---

# Agent Class

The `Agent` class is a fundamental building block in the Agent System framework. It provides the core functionality for creating autonomous agents that can react to events and communicate with other agents.

## Constructor

```typescript
constructor(id: string)
```

Creates a new agent with the specified ID.

| Parameter | Type     | Description                       |
| --------- | -------- | --------------------------------- |
| `id`      | `string` | A unique identifier for the agent |

## Properties

| Name | Type     | Description                        |
| ---- | -------- | ---------------------------------- |
| `id` | `string` | The unique identifier of the agent |

## Methods

### on

```typescript
on<T extends Event>(eventType: string, handler: EventHandler<T>): void
```

Registers an event handler for a specific event type.

| Parameter   | Type              | Description                                               |
| ----------- | ----------------- | --------------------------------------------------------- |
| `eventType` | `string`          | The type of event to handle                               |
| `handler`   | `EventHandler<T>` | A function that will be called when the event is received |

#### Returns

`void`

### emit

```typescript
emit<T extends Event>(event: T): Promise<any>
```

Emits an event to the event system.

| Parameter | Type              | Description       |
| --------- | ----------------- | ----------------- |
| `event`   | `T extends Event` | The event to emit |

#### Returns

`Promise<any>` - Resolves with the result of processing the event

### getEventHandler

```typescript
getEventHandler(eventType: string): EventHandler<any> | undefined
```

Gets the event handler for a specific event type.

| Parameter   | Type     | Description       |
| ----------- | -------- | ----------------- |
| `eventType` | `string` | The type of event |

#### Returns

`EventHandler<any> | undefined` - The handler function if registered, otherwise undefined

## Usage Example

```typescript
import { Agent } from '@agent-system/core';

class MyAgent extends Agent {
  constructor() {
    super('my-agent');

    this.on('greeting', event => {
      console.log(`Received greeting: ${event.message}`);
      return { type: 'greeting-response', message: 'Hello back!' };
    });
  }

  sendGreeting(message: string) {
    return this.emit({
      type: 'greeting',
      message,
    });
  }
}

// Usage
const agent = new MyAgent();
agent.sendGreeting('Hello, world!');
```

## Extending the Agent Class

When building your own agents, you typically want to extend the `Agent` class:

```typescript
class CustomAgent extends Agent {
  constructor() {
    super('custom-agent');
    this.initialize();
  }

  private initialize() {
    // Register event handlers
    this.on('custom-event', this.handleCustomEvent.bind(this));
  }

  private handleCustomEvent(event: any) {
    // Handle the event
    return { type: 'custom-response', data: 'Processed event' };
  }

  // Add custom methods
  performAction() {
    // Custom agent logic
  }
}
```
