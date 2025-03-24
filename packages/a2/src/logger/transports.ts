import { BaseLogMessage, LoggerTransport } from './types';

/**
 * In-memory transport for logs
 */
export class InMemoryTransport extends LoggerTransport {
  private logs: BaseLogMessage[] = [];
  private maxLogs: number;

  constructor(options: { maxLogs?: number } = {}) {
    super();
    this.maxLogs = options.maxLogs || 1000;
  }

  _write(chunk: any, _encoding: string, callback: (error?: Error | null) => void): void {
    try {
      const log = JSON.parse(chunk);
      this.logs.push(log);

      // Trim logs if we exceed the maximum
      if (this.logs.length > this.maxLogs) {
        this.logs = this.logs.slice(-this.maxLogs);
      }

      callback();
    } catch (error) {
      callback(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async getLogs(): Promise<BaseLogMessage[]> {
    return [...this.logs];
  }

  async getLogsByAgentId({ agentId }: { agentId: string }): Promise<BaseLogMessage[]> {
    return this.logs.filter((log) => log.agentId === agentId);
  }

  async getLogsByWorkflowId({ workflowId }: { workflowId: string }): Promise<BaseLogMessage[]> {
    return this.logs.filter((log) => log.workflowId === workflowId);
  }

  async getLogsByRunId({ runId }: { runId: string }): Promise<BaseLogMessage[]> {
    return this.logs.filter((log) => log.runId === runId);
  }

  async getLogsByTraceType({ type }: { type: string }): Promise<BaseLogMessage[]> {
    return this.logs.filter((log) => log.type === type);
  }

  clear(): void {
    this.logs = [];
  }
}

/**
 * Create a File Transport (example - would need fs module implementation)
 */
export class FileTransport extends LoggerTransport {
  private filePath: string;

  constructor(filePath: string) {
    super();
    this.filePath = filePath;
  }

  _write(chunk: any, _encoding: string, callback: (error?: Error | null) => void): void {
    // Here you would implement writing to file
    // For example: fs.appendFile(this.filePath, chunk + '\n', callback);

    // For now, we'll just call the callback
    callback();
  }

  async getLogs(): Promise<BaseLogMessage[]> {
    return []; // Would implement file reading
  }

  async getLogsByAgentId(_args: { agentId: string }): Promise<BaseLogMessage[]> {
    return []; // Would implement filtered file reading
  }

  async getLogsByWorkflowId(_args: { workflowId: string }): Promise<BaseLogMessage[]> {
    return []; // Would implement filtered file reading
  }

  async getLogsByRunId(_args: { runId: string }): Promise<BaseLogMessage[]> {
    return []; // Would implement filtered file reading
  }

  async getLogsByTraceType(_args: { type: string }): Promise<BaseLogMessage[]> {
    return []; // Would implement filtered file reading
  }
}
