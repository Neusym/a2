import { Transform } from 'stream';

/**
 * Available logger components based on the core architecture
 */
export const RegisteredLogger = {
  AGENT: 'AGENT',
  REPOSITORY: 'REPOSITORY',
  MEMORY: 'MEMORY',
  TOOL: 'TOOL',
  RESOURCE: 'RESOURCE',
  PROVIDER: 'PROVIDER',
  PROCESS: 'PROCESS',
  EVENT: 'EVENT',
  WORKFLOW: 'WORKFLOW',
  COLLAB: 'COLLAB',
  ORCHESTRATOR: 'ORCHESTRATOR',
  DISCOVERY: 'DISCOVERY',
  ERROR: 'ERROR',
} as const;

export type RegisteredLogger = (typeof RegisteredLogger)[keyof typeof RegisteredLogger];

/**
 * Log levels
 */
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  NONE: 'silent',
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

/**
 * Base log message interface
 */
export interface BaseLogMessage {
  msg: string;
  level: number;
  time: Date;
  pid: number;
  hostname: string;
  name: string;
  source?: string;
  agentId?: string;
  workflowId?: string;
  stepId?: string;
  eventType?: string;
  type?: string;
  runId?: string;
  toolCallId?: string;
  workflowTraceId?: string;
  memoryOpId?: string;
  errorId?: string;
  parentId?: string;
  action?: string;
  collabId?: string;
  resourceId?: string;
  providerId?: string;
  processId?: string;
  eventId?: string;
}

/**
 * Base transport class for logging
 */
export abstract class LoggerTransport extends Transform {
  constructor(opts: any = {}) {
    super({ ...opts, objectMode: true });
  }

  abstract getLogs(): Promise<BaseLogMessage[]>;
  abstract getLogsByAgentId(args: { agentId: string }): Promise<BaseLogMessage[]>;
  abstract getLogsByWorkflowId(args: { workflowId: string }): Promise<BaseLogMessage[]>;
  abstract getLogsByRunId(args: { runId: string }): Promise<BaseLogMessage[]>;
  abstract getLogsByTraceType(args: { type: string }): Promise<BaseLogMessage[]>;
}

export type TransportMap = Record<string, LoggerTransport>;

/**
 * Pino Logger interface for use in the codebase
 */
export interface PinoLogger {
  debug: (obj: object, msg?: string) => void;
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
}

/**
 * Pino pretty options interface
 */
export interface PinoPrettyOptions {
  colorize?: boolean;
  levelFirst?: boolean;
  ignore?: string;
  colorizeObjects?: boolean;
  translateTime?: string;
  singleLine?: boolean;
}
