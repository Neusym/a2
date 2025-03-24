/**
 * a2 Framework Core
 *
 * This is the main entry point for the a2 framework.
 * It provides the core components and utilities for building
 * AI-powered applications.
 */

// Export core component classes
import { CoreComponent, ComponentConfig } from './core';
export * from './core';

// Re-export necessary types from dependencies
import { RegisteredLogger, LogLevel } from '../logger';
export { RegisteredLogger, LogLevel };

// Re-export specific tools functionality

export { CoreTool, ToolRegistry, createTool, convertToolsToVercelTools };

// Re-export agent capabilities
import { Agent } from '../agent/agent';
import {
  AgentConfig,
  AgentMetadata,
  AgentGenerateOptions,
  AgentStreamOptions,
} from '../agent/types';
export { Agent, AgentConfig, AgentMetadata, AgentGenerateOptions, AgentStreamOptions };

// Re-export memory systems
import { Memory, MemoryConfig } from '../memory';
export { Memory, MemoryConfig };

// Re-export providers
import { Model } from '../provider/model';
export { Model };

// Re-export resource management
import { DefaultResourceManager } from '../resource/manager';
import { createTool, convertToolsToVercelTools } from '../tools';
import { ToolRegistry } from '../tools/registry';
import { CoreTool } from '../tools/types';
import { Resource, ResourceLibrary } from '../tools/types';
export { DefaultResourceManager, Resource, ResourceLibrary };

/**
 * Create an instance of a framework component with consistent configuration
 * @param componentType Type of component to create
 * @param options Component configuration options
 * @returns Instance of the specified component type
 */
export function createComponent<T extends typeof CoreComponent>(
  componentType: T,
  options: ComponentConfig = {},
): InstanceType<T> {
  return new componentType(options) as InstanceType<T>;
}

/**
 * Create an agent with the a2 framework
 * @param config Agent configuration
 * @returns A new Agent instance
 */
export function createAgent(config: AgentConfig): Agent {
  return new Agent(config);
}

/**
 * Framework version information
 */
export const version = {
  /** Framework version number */
  number: '0.1.0',
  /** Framework name */
  name: 'a2',
  /** Full framework identifier */
  get full(): string {
    return `${this.name}@${this.number}`;
  },
};

/**
 * Framework namespace object
 * Provides centralized access to framework components
 */
export const a2 = {
  /** Core component base class */
  CoreComponent,
  /** Create a component instance */
  create: createComponent,
  /** Create an agent */
  createAgent,
  /** Framework version information */
  version,
  /** Logger types */
  logger: {
    RegisteredLogger,
    LogLevel,
  },
  /** Core agent functionality */
  Agent,
  /** Memory system */
  Memory,
  /** Model providers */
  Model,
  /** Tools subsystem */
  tools: {
    ToolRegistry,
    createTool,
    convertToolsToVercelTools,
  },
  /** Resource management */
  resources: {
    DefaultResourceManager,
  },
};
