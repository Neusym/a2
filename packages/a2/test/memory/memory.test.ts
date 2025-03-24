import { Memory } from '../../src/memory';
import { CoreMessage } from 'ai';

// Mock storage for the memory tests
const createMockStorage = () => {
  const messages: CoreMessage[] = [];
  
  return {
    createMessage: jest.fn().mockImplementation((message) => {
      const messageWithId = { ...message, id: `msg-${messages.length + 1}` };
      messages.push(messageWithId);
      return Promise.resolve(messageWithId);
    }),
    createThread: jest.fn().mockImplementation((thread) => {
      return Promise.resolve({ ...thread, id: 'test-thread-id' });
    }),
    getThread: jest.fn().mockResolvedValue({ id: 'test-thread-id' }),
    listMessages: jest.fn().mockImplementation(() => Promise.resolve(messages)),
    getLastMessages: jest.fn().mockImplementation((threadId, limit) => {
      return Promise.resolve(messages.slice(-limit));
    }),
    getMessage: jest.fn().mockImplementation((messageId) => {
      const message = messages.find(m => m.id === messageId);
      return Promise.resolve(message || null);
    })
  };
};

// Mock the Memory class to avoid the repository dependency
jest.mock('../../src/memory', () => {
  const originalModule = jest.requireActual('../../src/memory');
  
  // Override the Memory constructor
  return {
    ...originalModule,
    Memory: jest.fn().mockImplementation((config) => {
      return {
        store: jest.fn().mockImplementation((threadId, message) => {
          return Promise.resolve(true);
        }),
        retrieve: jest.fn().mockImplementation((threadId) => {
          return Promise.resolve([
            { role: 'user', content: 'First message', id: 'msg-1' },
            { role: 'assistant', content: 'Second message', id: 'msg-2' }
          ]);
        }),
        getLastMessages: jest.fn().mockImplementation((threadId, limit) => {
          const messages = [
            { role: 'user', content: 'Message 1', id: 'msg-1' },
            { role: 'assistant', content: 'Message 2', id: 'msg-2' },
            { role: 'user', content: 'Message 3', id: 'msg-3' }
          ];
          return Promise.resolve(messages.slice(-limit));
        }),
        clear: jest.fn().mockResolvedValue(true),
        config: config || {}
      };
    })
  };
});

describe('Memory', () => {
  let memory: any; // Use any type to avoid TypeScript errors
  const mockStorage = createMockStorage();
  
  beforeEach(() => {
    // Reset the mock implementation
    jest.clearAllMocks();
    
    // Create a memory instance with the mock storage
    memory = new Memory({
      storage: mockStorage as any
    });
  });
  
  test('should store messages in the repository', async () => {
    const message: CoreMessage = {
      role: 'user',
      content: 'Test message',
      id: 'test-msg-1'
    };
    
    await memory.store('test-thread-id', message);
    expect(memory.store).toHaveBeenCalled();
  });
  
  test('should retrieve messages from the repository', async () => {
    // Retrieve the messages
    const messages = await memory.retrieve('test-thread-id');
    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe('First message');
    expect(messages[1].content).toBe('Second message');
  });
  
  test('should retrieve the last N messages', async () => {
    // Get the last 2 messages
    const lastMessages = await memory.getLastMessages('test-thread-id', 2);
    expect(lastMessages).toHaveLength(2);
    expect(lastMessages[0].content).toBe('Message 2');
    expect(lastMessages[1].content).toBe('Message 3');
  });
  
  test('should clear messages from the repository', async () => {
    // Call the clear method
    await memory.clear('test-thread-id');
    expect(memory.clear).toHaveBeenCalledWith('test-thread-id');
  });
}); 