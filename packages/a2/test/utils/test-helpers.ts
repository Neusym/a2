import { CoreComponent, ComponentConfig } from '../../src/a2/core';
import { Memory } from '../../src/memory';
import { Model } from '../../src/provider/model';
import { Agent } from '../../src/agent/agent';
import { RegisteredLogger, LogLevel, Logger, createLogger } from '../../src/logger';

// No need to import jest types as they are globally available

/**
 * Creates a mock Logger instance for testing
 */
export const createMockLogger = (): Logger => {
  const logs: any[] = [];
  
  const logger: Logger = {
    debug: (message: string, context?: any) => { logs.push({ level: 'debug', message, context }); },
    info: (message: string, context?: any) => { logs.push({ level: 'info', message, context }); },
    warn: (message: string, context?: any) => { logs.push({ level: 'warn', message, context }); },
    error: (message: string, context?: any) => { logs.push({ level: 'error', message, context }); },
    level: LogLevel.DEBUG,
    child: () => logger,
  } as any; // Use type assertion to simplify
  
  // Add the getLogs method
  (logger as any).getLogs = () => logs;
  
  return logger as Logger & { getLogs: () => any[] };
};

/**
 * Creates a test CoreComponent for testing
 */
export const createTestComponent = (config: ComponentConfig = {}): CoreComponent => {
  return new CoreComponent({
    component: RegisteredLogger.AGENT,
    name: 'test-component',
    logger: createMockLogger(),
    ...config
  });
};

/**
 * Creates a mock Model for testing
 */
export const createMockModel = (): Model => {
  const mockModel = {
    generate: jest.fn().mockResolvedValue({
      content: 'Mock model response',
      toolCalls: []
    }),
    stream: jest.fn().mockImplementation(() => {
      const mockAsyncIterable = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: 'Mock ', toolCalls: [] };
          yield { content: 'stream ', toolCalls: [] };
          yield { content: 'response', toolCalls: [] };
        }
      };
      return mockAsyncIterable;
    })
  } as any;
  
  return new Model(mockModel);
};

/**
 * Creates a mock Memory for testing
 */
export const createMockMemory = (): Memory => {
  const mockMemory = {
    store: jest.fn().mockResolvedValue(true),
    retrieve: jest.fn().mockResolvedValue([]),
    clear: jest.fn().mockResolvedValue(true),
    getMessages: jest.fn().mockResolvedValue([]),
    getLastMessages: jest.fn().mockResolvedValue([]),
    addMessage: jest.fn().mockResolvedValue(true),
    config: {}
  } as any;
  
  return mockMemory;
};

/**
 * Creates a test Agent for testing
 */
export const createTestAgent = (): Agent => {
  return new Agent({
    metadata: {
      agentId: 'test-agent-id',
      name: 'Test Agent',
      instructions: 'Test instructions',
      goal: 'Test goal',
      role: 'assistant'
    },
    model: createMockModel() as any,
    memory: createMockMemory()
  });
}; 