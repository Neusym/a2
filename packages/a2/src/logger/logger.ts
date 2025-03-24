import { Transform } from 'stream';

import pino from 'pino';
import pretty from 'pino-pretty';

import { LogLevel, RegisteredLogger, TransportMap } from './types';

/**
 * Main Logger implementation
 */
export class Logger {
  protected logger: pino.Logger;
  transports: TransportMap;
  private logContext: Record<string, any> = {};

  constructor(
    options: {
      name?: string;
      level?: LogLevel;
      transports?: TransportMap;
      overrideDefaultTransports?: boolean;
      context?: Record<string, any>;
    } = {},
  ) {
    this.transports = options.transports || {};
    this.logContext = options.context || {};

    // Create Pino logger with multiple streams
    const transportsAry = Object.entries(this.transports);
    this.logger = pino(
      {
        name: options.name || 'core',
        level: options.level || LogLevel.INFO,
        formatters: {
          level: (label: string) => {
            return { level: label };
          },
        },
      },
      options.overrideDefaultTransports
        ? options?.transports?.default
        : transportsAry.length === 0
          ? pretty({
              colorize: true,
              levelFirst: true,
              ignore: 'pid,hostname',
              colorizeObjects: true,
              translateTime: 'SYS:standard',
              singleLine: false,
            })
          : pino.multistream([
              ...transportsAry.map(([_, transport]) => ({
                stream: transport,
                level: options.level || LogLevel.INFO,
              })),
              {
                stream: pretty({
                  colorize: true,
                  levelFirst: true,
                  ignore: 'pid,hostname',
                  colorizeObjects: true,
                  translateTime: 'SYS:standard',
                  singleLine: false,
                }),
                level: options.level || LogLevel.INFO,
              },
            ]),
    );
  }

  /**
   * Add context to all logs created from this logger
   */
  setContext(context: Record<string, any>): void {
    this.logContext = { ...this.logContext, ...context };
  }

  debug(message: string, args: Record<string, any> = {}): void {
    this.logger.debug({ ...this.logContext, ...args }, message);
  }

  info(message: string, args: Record<string, any> = {}): void {
    this.logger.info({ ...this.logContext, ...args }, message);
  }

  warn(message: string, args: Record<string, any> = {}): void {
    this.logger.warn({ ...this.logContext, ...args }, message);
  }

  error(message: string, args: Record<string, any> = {}): void {
    this.logger.error({ ...this.logContext, ...args }, message);
  }

  // Stream creation for process output handling
  createStream(): Transform {
    return new Transform({
      transform: (chunk, _encoding, callback) => {
        const line = chunk.toString().trim();
        if (line) {
          this.info(line);
        }
        callback(null, chunk);
      },
    });
  }

  async getLogs(transportId: string) {
    if (!transportId || !this.transports[transportId]) {
      return [];
    }
    return this.transports[transportId].getLogs();
  }

  async getLogsByAgentId({ agentId, transportId }: { transportId: string; agentId: string }) {
    return this.transports[transportId]?.getLogsByAgentId({ agentId });
  }

  async getLogsByWorkflowId({
    workflowId,
    transportId,
  }: {
    transportId: string;
    workflowId: string;
  }) {
    return this.transports[transportId]?.getLogsByWorkflowId({ workflowId });
  }

  async getLogsByRunId({ runId, transportId }: { transportId: string; runId: string }) {
    return this.transports[transportId]?.getLogsByRunId({ runId });
  }
}

/**
 * Factory function for creating loggers
 */
export function createLogger(options: {
  name?: string;
  level?: LogLevel;
  transports?: TransportMap;
  context?: Record<string, any>;
}) {
  return new Logger(options);
}

/**
 * Factory functions for component-specific loggers
 */

/**
 * Create an Agent-specific logger
 */
export function createAgentLogger(
  options: {
    agentId: string;
    level?: LogLevel;
    transports?: TransportMap;
  } = { agentId: 'unknown' },
) {
  return new Logger({
    name: RegisteredLogger.AGENT,
    level: options.level,
    transports: options.transports,
    context: { agentId: options.agentId },
  });
}

/**
 * Create a Workflow-specific logger
 */
export function createWorkflowLogger(
  options: {
    workflowId: string;
    level?: LogLevel;
    transports?: TransportMap;
  } = { workflowId: 'unknown' },
) {
  return new Logger({
    name: RegisteredLogger.WORKFLOW,
    level: options.level,
    transports: options.transports,
    context: { workflowId: options.workflowId },
  });
}

/**
 * Create an Event-specific logger
 */
export function createEventLogger(
  options: {
    level?: LogLevel;
    transports?: TransportMap;
    context?: Record<string, any>;
  } = {},
) {
  return new Logger({
    name: RegisteredLogger.EVENT,
    level: options.level,
    transports: options.transports,
    context: options.context,
  });
}

/**
 * Multi-logger implementation for handling multiple loggers
 */
export class MultiLogger {
  private loggers: Logger[];

  constructor(loggers: Logger[]) {
    this.loggers = loggers;
  }

  debug(message: string, args: Record<string, any> = {}): void {
    this.loggers.forEach((logger) => logger.debug(message, args));
  }

  info(message: string, args: Record<string, any> = {}): void {
    this.loggers.forEach((logger) => logger.info(message, args));
  }

  warn(message: string, args: Record<string, any> = {}): void {
    this.loggers.forEach((logger) => logger.warn(message, args));
  }

  error(message: string, args: Record<string, any> = {}): void {
    this.loggers.forEach((logger) => logger.error(message, args));
  }
}

/**
 * Utility function to combine multiple loggers
 */
export function combineLoggers(loggers: Logger[]): MultiLogger {
  return new MultiLogger(loggers);
}

/**
 * Default logger instance for backward compatibility
 */
export const defaultLogger = createLogger({
  name: 'default',
  level: LogLevel.INFO,
});

/**
 * No-op logger implementation
 */
export const noopLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  cleanup: async () => {},
};
