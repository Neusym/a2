import { ILogger } from './logger'; // Use interface

// Base custom error class
export class AgentBusError extends Error {
  public readonly context?: Record<string, any>;
  public readonly originalError?: Error;
  public readonly statusCode: number; // Add HTTP status code hint

  constructor(message: string, statusCode: number = 500, context?: Record<string, any>, originalError?: Error) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.context = context;
    this.originalError = originalError;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error types
export class LlmError extends AgentBusError {
  constructor(message: string, context?: Record<string, any>, originalError?: Error) {
    super(message, 503, context, originalError); // 503 Service Unavailable
    this.name = 'LlmError';
  }
}

export class DatabaseError extends AgentBusError {
  constructor(message: string, context?: Record<string, any>, originalError?: Error) {
    super(message, 500, context, originalError); // 500 Internal Server Error
    this.name = 'DatabaseError';
  }
}

export class MatchingError extends AgentBusError {
  constructor(message: string, context?: Record<string, any>, originalError?: Error) {
    // Use 404 if no match found, otherwise 500
    const status = message.toLowerCase().includes('no match found') || message.toLowerCase().includes('no healthy processors') ? 404 : 500;
    super(message, status, context, originalError);
    this.name = 'MatchingError';
  }
}

export class ConfigurationError extends AgentBusError {
  constructor(message: string, context?: Record<string, any>, originalError?: Error) {
    super(message, 500, context, originalError);
    this.name = 'ConfigurationError';
  }
}

export class StorageError extends AgentBusError {
  constructor(message: string, context?: Record<string, any>, originalError?: Error) {
    super(message, 500, context, originalError);
    this.name = 'StorageError';
  }
}

export class QueueError extends AgentBusError {
  constructor(message: string, context?: Record<string, any>, originalError?: Error) {
    super(message, 500, context, originalError);
    this.name = 'QueueError';
  }
}

export class ValidationError extends AgentBusError {
  constructor(message: string, context?: Record<string, any>, originalError?: Error) {
    super(message, 400, context, originalError); // 400 Bad Request
    this.name = 'ValidationError';
  }
}


/**
 * Centralized error handling function. Logs the error and ensures it's an AgentBusError.
 * @param error The error caught.
 * @param logger An ILogger instance.
 * @param context Additional context for logging.
 * @returns An instance of AgentBusError.
 */
export function handleServiceError(error: unknown, logger: ILogger, context: Record<string, any> = {}): AgentBusError {
    if (error instanceof AgentBusError) {
        logger.error(error.message, { // Log as error level for visibility
            name: error.name,
            status: error.statusCode,
            context: { ...error.context, ...context }, // Merge contexts
            originalError: error.originalError?.message,
            stack: error.stack // Log stack for detailed debugging
        });
        return error; // Return the specific error
    }

    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    const originalError = error instanceof Error ? error : undefined;

    // Wrap unknown errors in a generic AgentBusError
    const wrappedError = new AgentBusError(message, 500, context, originalError);

    logger.error(wrappedError.message, { // Log as error level
        name: wrappedError.name,
        status: wrappedError.statusCode,
        context: wrappedError.context,
        originalError: wrappedError.originalError?.message,
        stack: wrappedError.stack
     });

    return wrappedError;
} 