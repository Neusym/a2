// Import the required modules
import { Agent } from '../../src/agent/agent';
import { ToolRegistry } from '../../src/tools/registry';
import { z } from 'zod';
import { CoreMessage } from 'ai';

// Create a mock model wrapper
const createMockModelWrapper = () => {
  return {
    generate: jest.fn().mockResolvedValue({
      content: 'Generated response',
      toolCalls: [],
    }),
    stream: jest.fn().mockImplementation(() => {
      return {
        [Symbol.asyncIterator]: async function* () {
          yield { content: 'Streaming ', toolCalls: [] };
          yield { content: 'response', toolCalls: [] };
        }
      };
    })
  };
};

// Mock memory implementation
const createMockMemory = () => {
  return {
    getMessages: jest.fn().mockResolvedValue([]),
    getLastMessages: jest.fn().mockResolvedValue([]),
    addMessage: jest.fn().mockResolvedValue(true),
    clear: jest.fn().mockResolvedValue(true),
    retrieveUserContext: jest.fn().mockResolvedValue({}),
    updateUserContext: jest.fn().mockResolvedValue(true),
  };
};

describe('Agent', () => {
  let agent: Agent;
  const mockModelWrapper = createMockModelWrapper();
  const mockMemory = createMockMemory();
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create a new agent
    agent = new Agent({
      metadata: {
        agentId: 'test-agent-id',
        name: 'Test Agent',
        instructions: 'You are a helpful assistant for testing.',
        goal: 'Help with testing',
        role: 'assistant'
      },
      model: mockModelWrapper as any,
      memory: mockMemory as any
    });
  });
  
  test('should initialize correctly with metadata', () => {
    expect(agent.getAgentId()).toBe('test-agent-id');
    expect(agent.getName()).toBe('Test Agent');
    expect(agent.getInstructions()).toBe('You are a helpful assistant for testing.');
    expect(agent.getGoal()).toBe('Help with testing');
    expect(agent.getRole()).toBe('assistant');
    expect(agent.getMemory()).toBe(mockMemory);
  });
  
  test('should sanitize response messages', () => {
    const messages: CoreMessage[] = [
      {
        role: 'assistant',
        content: 'Safe content <script>alert("XSS")</script> javascript:alert("XSS")',
        id: 'test-msg-1'
      }
    ];
    
    const sanitized = agent['sanitizeResponseMessages'](messages);
    expect(sanitized[0].content).not.toContain('<script>');
    expect(sanitized[0].content).not.toContain('javascript:');
  });
  
  test('should generate a title from user message', async () => {
    const userMessage: CoreMessage = {
      role: 'user',
      content: 'This is a test message for title generation',
      id: 'test-msg-1'
    };
    
    const title = await agent.generateTitleFromUserMessage({ message: userMessage });
    expect(title).toContain('Conversation about');
    expect(title).toContain('This is a test message');
  });
  
  test('should configure tools correctly', () => {
    const testTool = {
      description: 'A test tool',
      parameters: z.object({
        param1: z.string().describe('A test parameter')
      }),
      execute: jest.fn()
    };
    
    agent['configureTools']({ testTool } as any);
    expect(agent.tools).toHaveProperty('testTool');
  });
  
  test('should convert tools for model consumption', () => {
    const testTool = {
      description: 'A test tool',
      parameters: z.object({
        param1: z.string().describe('A test parameter')
      }),
      execute: jest.fn()
    };
    
    agent['configureTools']({ testTool } as any);
    
    const convertedTools = agent['convertTools']({
      threadId: 'test-thread',
      resourceId: 'test-resource'
    });
    
    expect(convertedTools).toHaveProperty('testTool');
    expect(convertedTools.testTool).toHaveProperty('description');
    expect(convertedTools.testTool).toHaveProperty('parameters');
  });
}); 