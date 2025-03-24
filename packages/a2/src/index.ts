/**
 * a2 Framework
 *
 * Main entry point for the a2 framework.
 */

// Export everything from the a2 namespace
export * from './a2';

// Export the framework instance
import { a2 } from './a2';
export default a2;

// Export agent types and implementations
export * from './agent/types';
export { Agent } from './agent/agent';

// Export memory system
export * from './memory';

// Export tools system - selective export to avoid naming conflicts
import { createTool, convertToolsToVercelTools, ToolRegistry } from './tools';

export { createTool, convertToolsToVercelTools, ToolRegistry };

// Export logger system
export * from './logger';

// Export model providers
export * from './provider/model';

// Export utilities
export * from './utils';
