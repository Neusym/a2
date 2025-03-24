/**
 * a2 Framework Base
 *
 * This file re-exports all framework components from a single centralized location.
 * It is the recommended way to import the framework in applications.
 */

// Export the core framework
export * from './a2';

// Export main framework components directly
export * from './agent/agent';
export * from './memory';
export * from './provider/model';
export * from './tools/registry';
export * from './resource/manager';
export * from './logger';
export * from './utils';

/**
 * Create and export a default instance of the a2 framework
 */
import { a2 } from './a2';
export default a2;
