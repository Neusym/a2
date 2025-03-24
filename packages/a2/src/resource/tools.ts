import { z } from 'zod';

import { Resource, ResourceManager } from './types';

/**
 * Interface representing the context for resource tool execution
 */
export interface ResourceToolContext {
  resourceManager: ResourceManager;
}

// Type definitions for resource tools
type GetResourceParams = z.ZodObject<{ resourceId: z.ZodString }>;
type ListResourcesParams = z.ZodObject<{ type: z.ZodOptional<z.ZodString> }>;
type GetPromptParams = z.ZodObject<{ promptName: z.ZodString }>;
type RenderPromptParams = z.ZodObject<{
  promptName: z.ZodString;
  params: z.ZodOptional<z.ZodRecord<z.ZodAny>>;
}>;

// Define all parameter schemas
const getResourceParams = z.object({
  resourceId: z.string().describe('The ID of the resource to retrieve'),
});

const listResourcesParams = z.object({
  type: z.string().optional().describe('Filter resources by type (optional)'),
});

const getPromptParams = z.object({
  promptName: z.string().describe('The name of the prompt to retrieve'),
});

const renderPromptParams = z.object({
  promptName: z.string().describe('The name of the prompt to render'),
  params: z.record(z.any()).optional().describe('Parameters to use in the prompt template'),
});

/**
 * Tool for getting a resource by its ID
 */
export const getResourceTool = {
  name: 'get-resource',
  description: 'Get a resource by its ID from the resource library',
  parameters: getResourceParams,
  execute: async (
    { resourceId }: z.infer<typeof getResourceParams>,
    context: ResourceToolContext,
  ): Promise<Resource> => {
    try {
      const resource = context.resourceManager.getResource(resourceId);
      return resource;
    } catch (error) {
      throw new Error(`Error retrieving resource: ${error}`);
    }
  },
};

/**
 * Tool for listing available resources
 */
export const listResourcesTool = {
  name: 'list-resources',
  description: 'List all available resources in the resource library',
  parameters: listResourcesParams,
  execute: async (
    { type }: z.infer<typeof listResourcesParams>,
    context: ResourceToolContext,
  ): Promise<string[] | Resource[]> => {
    try {
      if (type) {
        return context.resourceManager.getResourcesByType(type);
      }
      return context.resourceManager.listResources();
    } catch (error) {
      throw new Error(`Error listing resources: ${error}`);
    }
  },
};

/**
 * Tool for getting a prompt
 */
export const getPromptTool = {
  name: 'get-prompt',
  description: 'Get a prompt by its name from the prompt library',
  parameters: getPromptParams,
  execute: async (
    { promptName }: z.infer<typeof getPromptParams>,
    context: ResourceToolContext,
  ): Promise<string | { type: string; name: string; description: string }> => {
    try {
      const prompt = context.resourceManager.getPrompt(promptName);

      if (typeof prompt === 'function') {
        return {
          type: 'function',
          name: promptName,
          description: 'This is a function prompt that requires parameters',
        };
      }

      return prompt;
    } catch (error) {
      throw new Error(`Error retrieving prompt: ${error}`);
    }
  },
};

/**
 * Tool for rendering a prompt with parameters
 */
export const renderPromptTool = {
  name: 'render-prompt',
  description: 'Render a prompt with parameters',
  parameters: renderPromptParams,
  execute: async (
    { promptName, params = {} }: z.infer<typeof renderPromptParams>,
    context: ResourceToolContext,
  ): Promise<string> => {
    try {
      return context.resourceManager.renderPrompt(promptName, params);
    } catch (error) {
      throw new Error(`Error rendering prompt: ${error}`);
    }
  },
};

/**
 * Collection of all resource tools
 */
export const resourceTools = [getResourceTool, listResourcesTool, getPromptTool, renderPromptTool];
