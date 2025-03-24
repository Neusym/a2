import { CoreTool } from '../tools/types';

/**
 * Ensures that a tool has all required properties
 */
export function ensureToolProperties(tool: CoreTool): CoreTool {
  if (!tool.id) {
    tool.id = tool.type === 'provider-defined' ? tool.id : generateToolId();
  }

  if (!tool.type) {
    tool.type = 'function';
  }

  return tool;
}

/**
 * Check if a tool is a Vercel AI SDK tool
 */
export function isVercelTool(tool: any): boolean {
  return (
    tool &&
    typeof tool === 'object' &&
    typeof tool.description === 'string' &&
    tool.parameters &&
    typeof tool.parameters === 'object'
  );
}

/**
 * Creates a core tool from parameters
 */
export function makeCoreTool(
  id: string,
  description: string,
  parameters: any,
  execute?: (params: any) => Promise<any>,
): CoreTool {
  return {
    id,
    description,
    parameters,
    execute,
    type: 'function',
  };
}

/**
 * Generate a random tool ID
 */
function generateToolId(): string {
  return `tool_${Math.random().toString(36).substring(2, 10)}`;
}
