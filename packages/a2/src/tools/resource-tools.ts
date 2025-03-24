import { ToolExecutionOptions } from 'ai';
import { z } from 'zod';

import { Logger, createLogger } from '../logger';

import { CoreTool, ToolExecutionContext } from './types';

// Create a logger for the resource tools
const logger = createLogger({ name: 'resource-tools' });

// Helper function for interpolating templates - shared across the module
export function interpolateTemplate(template: string, params: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return params[key] !== undefined ? String(params[key]) : `{{${key}}}`;
  });
}

// Extended ToolExecutionOptions to include context
interface ExtendedToolExecutionOptions extends ToolExecutionOptions {
  context?: Record<string, any>;
}

// Type-safe way to extract context from options
function getExecutionContext(options: ExtendedToolExecutionOptions): ToolExecutionContext {
  if (!options.context) {
    logger.error('Context is not available in tool execution options');
    throw new Error('Context is not available in this tool execution');
  }
  return options.context as unknown as ToolExecutionContext;
}

// Tool for accessing and using resources
export const getResourceTool: CoreTool = {
  id: 'get-resource',
  description: 'Get a resource by its ID from the resource library',
  parameters: z.object({
    resourceId: z.string().describe('The ID of the resource to retrieve'),
  }),
  execute: async (
    { resourceId }: z.infer<typeof getResourceTool.parameters>,
    options: ExtendedToolExecutionOptions,
  ) => {
    try {
      const executionContext = getExecutionContext(options);
      const resources = executionContext.primitives?.resources;

      if (!resources) {
        const error = 'Resource library is not available in this context';
        logger.error(error, { resourceId });
        throw new Error(error);
      }

      const resource = resources[resourceId];
      if (!resource) {
        const error = `Resource "${resourceId}" not found`;
        logger.error(error, { resourceId });
        throw new Error(error);
      }

      return resource;
    } catch (error) {
      const errorMsg = `Error retrieving resource: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg, { resourceId });
      throw new Error(errorMsg);
    }
  },
};

// Tool for listing available resources
export const listResourcesTool: CoreTool = {
  id: 'list-resources',
  description: 'List all available resources in the resource library',
  parameters: z.object({
    type: z.string().optional().describe('Filter resources by type (optional)'),
  }),
  execute: async (
    { type }: z.infer<typeof listResourcesTool.parameters>,
    options: ExtendedToolExecutionOptions,
  ) => {
    try {
      const executionContext = getExecutionContext(options);
      const resources = executionContext.primitives?.resources;

      if (!resources) {
        const error = 'Resource library is not available in this context';
        logger.error(error, { type });
        throw new Error(error);
      }

      const resourceList = Object.values(resources);
      if (type) {
        return resourceList.filter((resource) => resource.type === type);
      }
      return resourceList;
    } catch (error) {
      const errorMsg = `Error listing resources: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg, { type });
      throw new Error(errorMsg);
    }
  },
};

// Tool for getting a prompt
export const getPromptTool: CoreTool = {
  id: 'get-prompt',
  description: 'Get a prompt by its name from the prompt library',
  parameters: z.object({
    promptName: z.string().describe('The name of the prompt to retrieve'),
  }),
  execute: async (
    { promptName }: z.infer<typeof getPromptTool.parameters>,
    options: ExtendedToolExecutionOptions,
  ) => {
    try {
      const executionContext = getExecutionContext(options);
      const prompts = executionContext.primitives?.prompts;

      if (!prompts) {
        const error = 'Prompt library is not available in this context';
        logger.error(error, { promptName });
        throw new Error(error);
      }

      const prompt = prompts[promptName];
      if (!prompt) {
        const error = `Prompt "${promptName}" not found`;
        logger.error(error, { promptName });
        throw new Error(error);
      }

      if (typeof prompt === 'function') {
        return {
          type: 'function',
          name: promptName,
          description: 'This is a function prompt that requires parameters',
        };
      }

      return prompt;
    } catch (error) {
      const errorMsg = `Error retrieving prompt: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg, { promptName });
      throw new Error(errorMsg);
    }
  },
};

// Tool for rendering a prompt with parameters
export const renderPromptTool: CoreTool = {
  id: 'render-prompt',
  description: 'Render a prompt with parameters',
  parameters: z.object({
    promptName: z.string().describe('The name of the prompt to render'),
    params: z.record(z.any()).optional().describe('Parameters to use in the prompt template'),
  }),
  execute: async (
    { promptName, params = {} }: z.infer<typeof renderPromptTool.parameters>,
    options: ExtendedToolExecutionOptions,
  ) => {
    try {
      const executionContext = getExecutionContext(options);
      const prompts = executionContext.primitives?.prompts;

      if (!prompts) {
        const error = 'Prompt library is not available in this context';
        logger.error(error, { promptName });
        throw new Error(error);
      }

      const prompt = prompts[promptName];
      if (!prompt) {
        const error = `Prompt "${promptName}" not found`;
        logger.error(error, { promptName });
        throw new Error(error);
      }

      if (typeof prompt === 'string') {
        // Simple template string replacement
        return interpolateTemplate(prompt, params);
      } else if (typeof prompt === 'function') {
        // Call the template function
        return prompt(params);
      }

      const error = `Invalid prompt type for "${promptName}"`;
      logger.error(error, { promptName, promptType: typeof prompt });
      throw new Error(error);
    } catch (error) {
      const errorMsg = `Error rendering prompt: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg, { promptName, params });
      throw new Error(errorMsg);
    }
  },
};

// Export all resource tools
export const resourceTools = [getResourceTool, listResourcesTool, getPromptTool, renderPromptTool];
