/**
 * @a2/sdk
 * 
 * Easy-to-use SDK for building AI agents, workflows, and tools with @a2/core framework
 */

// Export SDK creators
export * from './creators';

// Export specific SDK modules
export * from './agents';
export * from './processes';
export * from './workflows';
export * from './memory';
export * from './tools';
export * from './resources';

// Export the main SDK interface
import { A2SDK } from './sdk';
export default A2SDK;

// Re-export necessary types from @a2/core
export {
  AgentMetadata,
  AgentGenerateOptions,
  AgentStreamOptions,
  LogLevel
} from '../../a2/dist'; 