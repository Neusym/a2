import { TaskFormatter } from './src/agent-bus/intake-clarification/task.formatter';
import { CandidateEvaluator } from './src/agent-bus/matching-routing/candidate.evaluator';
import { PromptManager } from './src/agent-bus/integrations/llm/prompt.manager';
import { PinoLogger } from './src/agent-bus/common/utils/logger';

// Simple mock logger for testing
const logger = new PinoLogger({ level: 'info' });

// ========== Task Formatter Tests ==========
console.log('Testing TaskFormatter...');

// Create TaskFormatter instance
const taskFormatter = new TaskFormatter(logger);

// Test inferComplexity with llm_complexity_hint
const mockParams = {
  initial_description: 'Test task',
  llm_complexity_hint: 'complex' as string | undefined, // Make it optional
  required_platforms: ['web'],
  quality: 'high',
  inputs: { url: 'https://example.com' }
};

// Access the private method using type assertion
const complexityWithHint = (taskFormatter as any).inferComplexity(mockParams);
console.log('inferComplexity with hint:', complexityWithHint); // Should be true based on 'complex' hint

// Test without hint - set to undefined instead of using delete
mockParams.llm_complexity_hint = undefined;
const complexityWithoutHint = (taskFormatter as any).inferComplexity(mockParams);
console.log('inferComplexity without hint (using heuristic):', complexityWithoutHint); // Should be true based on quality and platforms

// ========== Prompt Manager Tests ==========
console.log('\nTesting PromptManager...');

// Mock the getPrompt method since we don't have actual prompt files
class TestPromptManager extends PromptManager {
  constructor() {
    // Pass correct constructor parameters
    super(logger, '');
  }

  // Override to avoid file system access
  async getPrompt(): Promise<string> {
    return "Hello {name}! Your age is {user.age} and your favorite color is {user.preferences.color}.";
  }
}

const promptManager = new TestPromptManager();

// Test the enhanced formatPrompt with nested properties
const promptData = {
  name: 'John',
  user: {
    age: 30,
    preferences: {
      color: 'blue'
    }
  }
};

promptManager.formatPrompt('test', promptData)
  .then(formatted => {
    console.log('Formatted prompt with nested placeholders:');
    console.log(formatted);
    // Should print: Hello John! Your age is 30 and your favorite color is blue.
  });

// ========== Candidate Evaluator Tests ==========
console.log('\nTesting CandidateEvaluator...');

// Mock the needed dependencies
const mockPromptManager = { 
  formatPrompt: () => Promise.resolve('mock prompt')
};
const mockEmbeddingService = { 
  generateEmbedding: () => Promise.resolve([0.1, 0.2, 0.3])
};
const mockStorageClient = {};

// Create CandidateEvaluator instance
const candidateEvaluator = new CandidateEvaluator(
  mockPromptManager as any,
  mockEmbeddingService as any,
  mockStorageClient as any,
  logger
);

// Test priceEstimation (private method accessed via type assertion)
const mockTaskSpec = { 
  description: 'Test task',
  inputs: {},
  outputs: {}
};

const mockProcessor1 = {
  processorId: 'proc-1',
  pricing: { price: 500, model: 'fixed' }
};

const mockProcessor2 = {
  processorId: 'proc-2',
  pricing: undefined
};

const price1 = (candidateEvaluator as any).estimatePrice(mockTaskSpec, mockProcessor1);
const price2 = (candidateEvaluator as any).estimatePrice(mockTaskSpec, mockProcessor2);

console.log('Price for processor with pricing:', price1); // Should be 500
console.log('Price for processor without pricing:', price2); // Should be default (1000)

// Test schema compatibility (private method accessed via type assertion)
const mockProcessorWithValidSchemas = {
  processorId: 'proc-3',
  inputSchema: { type: 'object', properties: { url: { type: 'string' } } },
  outputSchema: { type: 'object', properties: { data: { type: 'array' } } }
};

const mockProcessorWithInvalidSchemas = {
  processorId: 'proc-4',
  inputSchema: { foo: 'bar' }, // Not a valid JSON schema
  outputSchema: null
};

const mockProcessorMissingSchemas = {
  processorId: 'proc-5'
};

const compatibility1 = (candidateEvaluator as any).calculateSchemaCompatibility(mockTaskSpec, mockProcessorWithValidSchemas);
const compatibility2 = (candidateEvaluator as any).calculateSchemaCompatibility(mockTaskSpec, mockProcessorWithInvalidSchemas);
const compatibility3 = (candidateEvaluator as any).calculateSchemaCompatibility(mockTaskSpec, mockProcessorMissingSchemas);

console.log('Schema compatibility for valid schemas:', compatibility1); // Should be high (1.0)
console.log('Schema compatibility for invalid schemas:', compatibility2); // Should be low
console.log('Schema compatibility for missing schemas:', compatibility3); // Should be very low (0.2)

console.log('\nTests completed!'); 