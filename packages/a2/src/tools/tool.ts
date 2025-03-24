import type { ToolExecutionOptions } from 'ai';
import type { z } from 'zod';

import { createLogger } from '../logger';

import type { ToolAction, ToolExecutionContext } from './types';

// Create a logger for tools
const logger = createLogger({ name: 'tool' });

/**
 * Tool class that implements the ToolAction interface
 */
export class Tool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TContext extends ToolExecutionContext<TSchemaIn> = ToolExecutionContext<TSchemaIn>,
> implements ToolAction<TSchemaIn, TSchemaOut, TContext>
{
  id: string;
  description: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  execute?: ToolAction<TSchemaIn, TSchemaOut, TContext>['execute'];

  constructor(opts: ToolAction<TSchemaIn, TSchemaOut, TContext>) {
    this.id = opts.id;
    this.description = opts.description;
    this.inputSchema = opts.inputSchema;
    this.outputSchema = opts.outputSchema;
    this.execute = opts.execute;

    logger.debug(`Tool created: ${this.id}`, {
      toolId: this.id,
      hasInputSchema: !!this.inputSchema,
      hasOutputSchema: !!this.outputSchema,
      hasExecute: !!this.execute,
    });
  }
}

/**
 * Create a new tool instance
 */
export function createTool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TContext extends ToolExecutionContext<TSchemaIn> = ToolExecutionContext<TSchemaIn>,
>(opts: ToolAction<TSchemaIn, TSchemaOut, TContext>) {
  if (!opts.id) {
    const error = 'Tool must have an ID';
    logger.error(error);
    throw new Error(error);
  }

  return new Tool(opts);
}
