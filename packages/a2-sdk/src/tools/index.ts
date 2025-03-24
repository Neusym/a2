import { createTool as coreCreateTool, ToolRegistry } from '../../../a2/dist';
import { z } from 'zod';

/**
 * Function type for tool execution
 */
export type ToolExecuteFunction = (context: any) => Promise<Record<string, any>>;

/**
 * Options for creating a tool
 */
export interface CreateToolOptions {
  /**
   * Unique identifier for the tool
   */
  id: string;
  
  /**
   * Display name for the tool
   */
  name: string;
  
  /**
   * Description of what the tool does
   */
  description: string;
  
  /**
   * Zod schema for the tool parameters
   */
  parameters: z.ZodType<any>;
  
  /**
   * Function to execute when the tool is called
   */
  execute: ToolExecuteFunction;
}

/**
 * Create a tool with simplified options
 * 
 * @example
 * ```typescript
 * const calculator = createTool({
 *   id: 'calculator',
 *   name: 'Calculator',
 *   description: 'Perform mathematical calculations',
 *   parameters: z.object({
 *     operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
 *     a: z.number(),
 *     b: z.number()
 *   }),
 *   execute: async ({ operation, a, b }) => {
 *     let result: number;
 *     switch (operation) {
 *       case 'add': result = a + b; break;
 *       case 'subtract': result = a - b; break;
 *       case 'multiply': result = a * b; break;
 *       case 'divide': result = a / b; break;
 *       default: throw new Error(`Unknown operation`);
 *     }
 *     return { result };
 *   }
 * });
 * ```
 * 
 * @param options Options for creating the tool
 * @returns A new tool instance
 */
export function createTool(options: CreateToolOptions): any {
  const { id, name, description, parameters, execute } = options;
  
  // Create a tool with the core API
  return coreCreateTool({
    id,
    description,
    inputSchema: parameters,
    execute: async (context) => {
      return execute(context.context);
    }
  });
}

/**
 * Create a collection of tools
 * 
 * @param tools Object mapping tool ids to tool instances
 * @returns A tool registry containing the provided tools
 */
export function createToolCollection(tools: Record<string, any>): ToolRegistry {
  const registry = new ToolRegistry();
  
  // Register each tool according to the API
  Object.entries(tools).forEach(([id, tool]) => {
    registry.register(tool);
  });
  
  return registry;
}

/**
 * Options for creating a simple API tool
 */
export interface CreateApiToolOptions {
  /**
   * Unique identifier for the tool
   */
  id: string;
  
  /**
   * Display name for the tool
   */
  name: string;
  
  /**
   * Description of what the tool does
   */
  description: string;
  
  /**
   * API endpoint URL
   */
  endpoint: string;
  
  /**
   * HTTP method to use
   */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  
  /**
   * Headers to include in the request
   */
  headers?: Record<string, string>;
  
  /**
   * Zod schema for the tool parameters
   */
  parameters: z.ZodType<any>;
  
  /**
   * Optional function to transform the response before returning
   */
  transformResponse?: (response: any) => any;
}

/**
 * Create a tool that makes an API call
 * 
 * @param options Options for creating the API tool
 * @returns A new tool instance
 */
export function createApiTool(options: CreateApiToolOptions): any {
  const { 
    id, 
    name, 
    description, 
    endpoint, 
    method = 'GET',
    headers = {},
    parameters,
    transformResponse = (data) => data
  } = options;
  
  return createTool({
    id,
    name,
    description,
    parameters,
    execute: async (params) => {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        ...(method !== 'GET' ? { body: JSON.stringify(params) } : {})
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      return transformResponse(data);
    }
  });
} 