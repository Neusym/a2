/**
 * Represents a resource that can be used by agents
 */
export interface Resource {
  id: string;
  content: string;
  type: string;
  metadata?: Record<string, any>;
}

/**
 * A collection of resources
 */
export interface ResourceLibrary {
  [resourceId: string]: Resource;
}

/**
 * A function that takes parameters and returns a formatted prompt string
 */
export type PromptTemplate = (params: Record<string, any>) => string;

/**
 * A simple key-value store of prompts or templates
 */
export interface PromptLibrary {
  [promptName: string]: string | PromptTemplate;
}

/**
 * Configuration for the resource manager
 */
export interface ResourceManagerConfig {
  resourceLibrary?: ResourceLibrary;
  promptLibrary?: PromptLibrary;
  resourceDirectory?: string;
}

/**
 * Interface for the resource manager
 */
export interface ResourceManager {
  /**
   * Get a resource by its ID
   */
  getResource(resourceId: string): Resource;

  /**
   * Add a new resource to the library
   */
  addResource(resource: Resource): void;

  /**
   * Update an existing resource
   */
  updateResource(resourceId: string, resource: Partial<Resource>): boolean;

  /**
   * Remove a resource from the library
   */
  removeResource(resourceId: string): boolean;

  /**
   * Get the list of available resources
   */
  listResources(): string[];

  /**
   * Get resources by type
   */
  getResourcesByType(type: string): Resource[];

  /**
   * Load a resource from a file
   */
  loadResourceFromFile(filePath: string, type?: string, metadata?: Record<string, any>): Resource;

  /**
   * Save a resource to a file
   */
  saveResourceToFile(resourceId: string, filePath: string): boolean;

  /**
   * Load resources from a directory
   */
  loadResourcesFromDirectory(directoryPath: string, type?: string): Resource[];

  /**
   * Export resources to files in a directory
   */
  exportResourcesToDirectory(resourceIds: string[], directoryPath: string): boolean;

  /**
   * Get a prompt by its name
   */
  getPrompt(promptName: string): string | PromptTemplate;

  /**
   * Render a prompt template with parameters
   */
  renderPrompt(promptName: string, params?: Record<string, any>): string;

  /**
   * Add a new prompt to the library
   */
  addPrompt(promptName: string, prompt: string | PromptTemplate): void;

  /**
   * Update an existing prompt
   */
  updatePrompt(promptName: string, prompt: string | PromptTemplate): boolean;

  /**
   * Remove a prompt from the library
   */
  removePrompt(promptName: string): boolean;

  /**
   * Get the list of available prompts
   */
  listPrompts(): string[];

  /**
   * Compose multiple prompts into one
   */
  composePrompt(promptNames: string[], params?: Record<string, any>): string;
}
