// Add Jest globals for TypeScript
import 'jest';

// Extend global namespace for Jest
declare global {
  const describe: jest.Describe;
  const test: jest.It;
  const expect: jest.Expect;
  const beforeEach: jest.Lifecycle;
  const afterEach: jest.Lifecycle;
  const beforeAll: jest.Lifecycle;
  const afterAll: jest.Lifecycle;
  const jest: typeof import('jest');
} 