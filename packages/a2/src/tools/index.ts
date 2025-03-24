// Export resource types
export * from './types';

// Export resource manager
export * from './resource-manager';

// Export resource tools
export * from './resource-tools';

// Export Tool class and createTool function
export * from './tool';

// Export converter utilities
export * from './converter';

// Export registry
export * from './registry';

// Example tool creation
import { z } from 'zod';

import { createLogger } from '../logger';

import { createTool } from './tool';
import type { ToolExecutionContext } from './types';

// Logger for the calculator tool
const calculatorLogger = createLogger({ name: 'calculator-tool' });

// Define the input schema type
const calculatorSchema = z.object({
  operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
  a: z.number().describe('First number'),
  b: z.number().describe('Second number'),
});

// Define the output schema type
const outputSchema = z.number();

// Type for the calculator context
type CalculatorContext = ToolExecutionContext<typeof calculatorSchema>;

/**
 * Example of creating a calculator tool
 */
export const calculatorTool = createTool({
  id: 'calculator',
  description: 'Perform mathematical calculations',
  inputSchema: calculatorSchema,
  outputSchema: outputSchema,
  execute: async (context: CalculatorContext) => {
    const { operation, a, b } = context.context;

    try {
      calculatorLogger.debug(`Performing ${operation}`, { operation, a, b });

      switch (operation) {
        case 'add':
          return a + b;
        case 'subtract':
          return a - b;
        case 'multiply':
          return a * b;
        case 'divide':
          if (b === 0) {
            const error = 'Division by zero';
            calculatorLogger.error(error, { operation, a, b });
            throw new Error(error);
          }
          return a / b;
        default:
          const error = `Unsupported operation: ${operation}`;
          calculatorLogger.error(error, { operation });
          throw new Error(error);
      }
    } catch (error) {
      calculatorLogger.error(
        `Error in calculator tool: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation,
          a,
          b,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      throw error;
    }
  },
});
