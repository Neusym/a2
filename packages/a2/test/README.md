# a2 Framework Tests

This directory contains tests for the a2 framework components.

## Test Structure

- `a2/`: Tests for the core framework components
- `agent/`: Tests for the agent functionality
- `tools/`: Tests for the tools and tool registry
- `memory/`: Tests for the memory system
- `utils/`: Test utilities and helpers

## Running Tests

Run all tests:

```bash
npm test
```

Run tests with coverage report:

```bash
pnpm run test:coverage
```

Run tests in watch mode (development):

```bash
pnpm run test:watch
```

## Writing Tests

When writing new tests, follow these guidelines:

1. Place tests in the appropriate subdirectory based on what you're testing
2. Use the test helpers in `utils/test-helpers.ts` to create mock objects
3. Name test files with `.test.ts` suffix
4. Use descriptive test names that explain the expected behavior

## Mocking

For mocking dependencies:

- Use Jest's built-in mocking functionality
- Consider using the helper functions in `utils/test-helpers.ts`
- Mock external dependencies but test internal interactions

## Test Coverage

The goal is to maintain high test coverage for the core framework components. Focus on testing:

1. Public API interfaces
2. Edge cases and error handling
3. Component interactions
4. Important business logic 