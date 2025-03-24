---
title: Logger
description: Understanding the event system in A2
---

# Logger

The A2 framework provides a powerful logging system through the `@a2/core` package. The Logger module offers a flexible, extensible logging infrastructure built on top of [Pino](https://getpino.io/), enabling structured logging with multiple transport options.

## Basic Usage

```typescript
import { createLogger, LogLevel } from '@a2/core';

// Create a basic logger
const logger = createLogger({
  name: 'my-service',
  level: LogLevel.INFO,
});

// Log messages at different levels
logger.debug('Debug message', { detail: 'extra information' });
logger.info('Info message', { userId: 123 });
logger.warn('Warning message', { reason: 'disk space low' });
logger.error('Error occurred', { error: new Error('Failed operation') });
```

## Logger Features

The Logger provides:

- Multiple log levels (DEBUG, INFO, WARN, ERROR)
- Structured logging with context and metadata
- Multiple transport options (Console, In-Memory, File)
- Component-specific loggers for different parts of your application
- Filtering and querying capabilities for log retrieval

## Core Classes

### Logger

The main `Logger` class provides methods for logging at different levels and managing log transports.

```typescript
import { Logger, LogLevel } from '@a2/core';

const logger = new Logger({
  name: 'service-name',
  level: LogLevel.DEBUG,
  context: { service: 'auth' },
});
```

#### Methods

- `debug(message: string, args?: Record<string, any>)`: Log at DEBUG level
- `info(message: string, args?: Record<string, any>)`: Log at INFO level
- `warn(message: string, args?: Record<string, any>)`: Log at WARN level
- `error(message: string, args?: Record<string, any>)`: Log at ERROR level
- `setContext(context: Record<string, any>)`: Add context to all logs
- `createStream()`: Create a Transform stream for piping process output
- `getLogs(transportId: string)`: Retrieve logs from a specific transport
- `getLogsByAgentId({agentId, transportId})`: Get logs for a specific agent
- `getLogsByWorkflowId({workflowId, transportId})`: Get logs for a specific workflow
- `getLogsByRunId({runId, transportId})`: Get logs for a specific run

## Factory Functions

The framework provides several factory functions to create specialized loggers:

### createLogger

Creates a general-purpose logger instance:

```typescript
import { createLogger, LogLevel } from '@a2/core';

const logger = createLogger({
  name: 'api-service',
  level: LogLevel.INFO,
  context: { environment: 'production' },
});
```

### createAgentLogger

Creates a logger specifically for an Agent:

```typescript
import { createAgentLogger } from '@a2/core';

const agentLogger = createAgentLogger({
  agentId: 'agent-123',
  level: LogLevel.DEBUG,
});
```

### createWorkflowLogger

Creates a logger specifically for a Workflow:

```typescript
import { createWorkflowLogger } from '@a2/core';

const workflowLogger = createWorkflowLogger({
  workflowId: 'workflow-456',
  level: LogLevel.INFO,
});
```

### createEventLogger

Creates a logger specifically for Events:

```typescript
import { createEventLogger } from '@a2/core';

const eventLogger = createEventLogger({
  level: LogLevel.INFO,
  context: { eventSource: 'scheduler' },
});
```

## MultiLogger

The `MultiLogger` class allows you to combine multiple loggers and broadcast log messages to all of them:

```typescript
import { combineLoggers, createAgentLogger, createWorkflowLogger } from '@a2/core';

const agentLogger = createAgentLogger({ agentId: 'agent-123' });
const workflowLogger = createWorkflowLogger({ workflowId: 'workflow-456' });

const multiLogger = combineLoggers([agentLogger, workflowLogger]);

// This logs to both the agent and workflow logger
multiLogger.info('Starting task', { taskId: 'task-789' });
```

## Log Transports

The Logger supports different transports for log output:

### InMemoryTransport

Stores logs in memory, useful for testing or for retrieving logs programmatically:

```typescript
import { InMemoryTransport, createLogger } from '@a2/core';

const memoryTransport = new InMemoryTransport({ maxLogs: 1000 });

const logger = createLogger({
  name: 'service',
  transports: {
    memory: memoryTransport,
  },
});

// Later, retrieve logs
const logs = await logger.getLogs('memory');
const agentLogs = await logger.getLogsByAgentId({
  transportId: 'memory',
  agentId: 'agent-123',
});
```

### FileTransport

Saves logs to a file (requires additional filesystem implementation):

```typescript
import { FileTransport, createLogger } from '@a2/core';

const fileTransport = new FileTransport('/path/to/logs/app.log');

const logger = createLogger({
  name: 'service',
  transports: {
    file: fileTransport,
  },
});
```

## Log Levels

The framework provides standard log levels:

- `LogLevel.DEBUG`: Detailed information for debugging
- `LogLevel.INFO`: Informational messages about normal operations
- `LogLevel.WARN`: Warning conditions that should be addressed
- `LogLevel.ERROR`: Error conditions that require attention
- `LogLevel.NONE`: No logging (silent)

## Advanced Usage

### Adding Context to Logs

```typescript
import { createLogger } from '@a2/core';

const logger = createLogger({ name: 'auth-service' });

// Add context that will be included in all subsequent logs
logger.setContext({
  userId: '12345',
  sessionId: 'sess-abcdef',
  requestId: 'req-xyz123',
});

// Context will be included in this log
logger.info('User authenticated');
```

### Custom Transports

You can create custom transports by extending the `LoggerTransport` abstract class:

```typescript
import { LoggerTransport, BaseLogMessage } from '@a2/core';

class CustomTransport extends LoggerTransport {
  _write(chunk: any, _encoding: string, callback: (error?: Error | null) => void): void {
    // Implement custom writing logic
    const log = JSON.parse(chunk);
    // Process the log...
    callback();
  }

  async getLogs(): Promise<BaseLogMessage[]> {
    // Implement log retrieval
    return [];
  }

  // Implement other required methods...
  async getLogsByAgentId(args: { agentId: string }): Promise<BaseLogMessage[]> {
    return [];
  }

  async getLogsByWorkflowId(args: { workflowId: string }): Promise<BaseLogMessage[]> {
    return [];
  }

  async getLogsByRunId(args: { runId: string }): Promise<BaseLogMessage[]> {
    return [];
  }

  async getLogsByTraceType(args: { type: string }): Promise<BaseLogMessage[]> {
    return [];
  }
}
```
