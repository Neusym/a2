import { Logger, createLogger } from '../logger';

import type { Tool } from './tool';

/**
 * Registry for managing tools
 */
export class ToolRegistry {
  private tools: Map<string, Tool<any, any, any>> = new Map();
  private logger: Logger;

  constructor(options: { logger?: Logger } = {}) {
    this.logger = options.logger || createLogger({ name: 'tool-registry' });
  }

  /**
   * Register a tool with the registry
   */
  register(tool: Tool<any, any, any>): void {
    if (this.tools.has(tool.id)) {
      const error = `Tool with ID '${tool.id}' is already registered`;
      this.logger.error(error, { toolId: tool.id });
      throw new Error(error);
    }

    this.tools.set(tool.id, tool);
    this.logger.debug(`Registered tool: ${tool.id}`, { toolId: tool.id });
  }

  /**
   * Register multiple tools at once
   */
  registerMany(tools: Tool<any, any, any>[]): void {
    for (const tool of tools) {
      try {
        this.register(tool);
      } catch (error) {
        this.logger.error(`Failed to register tool ${tool.id}`, {
          toolId: tool.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Get a tool by ID
   */
  getTool(id: string): Tool<any, any, any> | undefined {
    const tool = this.tools.get(id);
    if (!tool) {
      this.logger.warn(`Tool not found: ${id}`, { toolId: id });
    }
    return tool;
  }

  /**
   * Get all registered tools
   */
  getAllTools(): Tool<any, any, any>[] {
    return Array.from(this.tools.values());
  }

  /**
   * Remove a tool from the registry
   */
  unregister(id: string): boolean {
    const result = this.tools.delete(id);
    if (result) {
      this.logger.debug(`Unregistered tool: ${id}`, { toolId: id });
    } else {
      this.logger.warn(`Failed to unregister tool (not found): ${id}`, { toolId: id });
    }
    return result;
  }

  /**
   * Check if a tool is registered
   */
  hasToolId(id: string): boolean {
    return this.tools.has(id);
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    const count = this.tools.size;
    this.tools.clear();
    this.logger.debug(`Cleared registry (${count} tools removed)`);
  }
}

/**
 * Create a new tool registry instance
 */
export function createToolRegistry(options: { logger?: Logger } = {}): ToolRegistry {
  return new ToolRegistry(options);
}
