import type { Tool as VercelTool } from 'ai';
import type { z } from 'zod';

import { createLogger } from '../logger';

import type { Tool } from './tool';
import type { ToolExecutionContext } from './types';

// Logger for the converter
const logger = createLogger({ name: 'tool-converter' });

/**
 * Convert our tool format to Vercel AI SDK's Tool format
 */
export function convertToolToVercelTool<
  TSchemaIn extends z.ZodSchema,
  TSchemaOut extends z.ZodSchema | undefined,
  TContext extends ToolExecutionContext<TSchemaIn>,
>(tool: Tool<TSchemaIn, TSchemaOut, TContext>): VercelTool {
  if (!tool.inputSchema) {
    const error = `Tool ${tool.id} must have an inputSchema to be converted to a Vercel Tool`;
    logger.error(error, { toolId: tool.id });
    throw new Error(error);
  }

  // The cast is necessary because the Vercel AI SDK Tool type might have evolved
  return {
    type: 'function',
    name: tool.id,
    parameters: tool.inputSchema,
    description: tool.description,
  } as VercelTool;
}

/**
 * Convert multiple tools to Vercel AI SDK Tool format
 */
export function convertToolsToVercelTools(tools: Tool<any, any, any>[]): VercelTool[] {
  return tools
    .filter((tool) => {
      if (!tool.inputSchema) {
        logger.warn(`Tool ${tool.id} skipped during conversion: missing inputSchema`, {
          toolId: tool.id,
        });
        return false;
      }
      return true;
    })
    .map((tool) => convertToolToVercelTool(tool));
}
