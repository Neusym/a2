import fs from 'fs';
import path from 'path';

import { Logger } from '../logger';

import { Resource, ResourceLibrary, PromptTemplate, PromptLibrary } from './types';

/**
 * Configuration for the resource manager
 */
export interface ResourceManagerConfig {
  resourceLibrary?: ResourceLibrary;
  promptLibrary?: PromptLibrary;
  resourceDirectory?: string;
  logger?: Logger;
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

/**
 * Default implementation of the ResourceManager
 */
export class DefaultResourceManager implements ResourceManager {
  private resourceLibrary: ResourceLibrary = {};
  private promptLibrary: PromptLibrary = {};
  private resourceDirectory?: string;
  private logger: Logger;

  constructor(config: ResourceManagerConfig = {}) {
    this.resourceLibrary = config.resourceLibrary || {};
    this.promptLibrary = config.promptLibrary || {};
    this.resourceDirectory = config.resourceDirectory;
    this.logger =
      config.logger ||
      new Logger({
        name: 'resource-manager',
      });

    // Initialize resource directory if provided
    if (this.resourceDirectory && !fs.existsSync(this.resourceDirectory)) {
      try {
        fs.mkdirSync(this.resourceDirectory, { recursive: true });
      } catch (error) {
        this.logger.error(`Failed to create resource directory: ${this.resourceDirectory}`, {
          error: error instanceof Error ? error.message : String(error),
          resourceDirectory: this.resourceDirectory,
        });
        throw new Error(
          `Failed to create resource directory: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  getResource(resourceId: string): Resource {
    if (!this.resourceLibrary[resourceId]) {
      const errorMsg = `Resource "${resourceId}" not found in library`;
      this.logger.error(errorMsg, { resourceId });
      throw new Error(errorMsg);
    }

    return this.resourceLibrary[resourceId];
  }

  addResource(resource: Resource): void {
    this.resourceLibrary[resource.id] = resource;
  }

  updateResource(resourceId: string, resource: Partial<Resource>): boolean {
    if (!this.resourceLibrary[resourceId]) {
      return false;
    }

    this.resourceLibrary[resourceId] = {
      ...this.resourceLibrary[resourceId],
      ...resource,
    };

    return true;
  }

  removeResource(resourceId: string): boolean {
    if (!this.resourceLibrary[resourceId]) {
      return false;
    }

    delete this.resourceLibrary[resourceId];
    return true;
  }

  listResources(): string[] {
    return Object.keys(this.resourceLibrary);
  }

  getResourcesByType(type: string): Resource[] {
    return Object.values(this.resourceLibrary).filter((resource) => resource.type === type);
  }

  loadResourceFromFile(
    filePath: string,
    type?: string,
    metadata: Record<string, any> = {},
  ): Resource {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const id = path.basename(filePath);

      const resourceType = type || this.inferTypeFromFile(filePath);

      const resource: Resource = {
        id,
        content,
        type: resourceType,
        metadata: {
          ...metadata,
          filepath: filePath,
          loadedAt: new Date().toISOString(),
        },
      };

      this.addResource(resource);
      return resource;
    } catch (error) {
      const errorMessage = `Failed to load resource from file ${filePath}`;
      this.logger.error(errorMessage, {
        filePath,
        type,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`${errorMessage}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  saveResourceToFile(resourceId: string, filePath: string): boolean {
    try {
      const resource = this.getResource(resourceId);
      fs.writeFileSync(filePath, resource.content, 'utf-8');

      // Update resource metadata
      this.updateResource(resourceId, {
        metadata: {
          ...resource.metadata,
          filepath: filePath,
          savedAt: new Date().toISOString(),
        },
      });

      return true;
    } catch (error) {
      this.logger.error(`Failed to save resource to file ${filePath}`, {
        resourceId,
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  loadResourcesFromDirectory(directoryPath: string, type?: string): Resource[] {
    try {
      const files = fs.readdirSync(directoryPath);
      const resources: Resource[] = [];

      for (const file of files) {
        const filePath = path.join(directoryPath, file);
        const stats = fs.statSync(filePath);

        if (stats.isFile()) {
          try {
            const resourceType = type || this.inferTypeFromFile(filePath);
            const resource = this.loadResourceFromFile(filePath, resourceType);
            resources.push(resource);
          } catch (error) {
            this.logger.warn(`Failed to load resource from ${filePath}`, {
              filePath,
              type,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      return resources;
    } catch (error) {
      const errorMessage = `Failed to load resources from directory ${directoryPath}`;
      this.logger.error(errorMessage, {
        directoryPath,
        type,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`${errorMessage}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  exportResourcesToDirectory(resourceIds: string[], directoryPath: string): boolean {
    try {
      // Create directory if it doesn't exist
      if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
      }

      let success = true;

      for (const resourceId of resourceIds) {
        try {
          const resource = this.getResource(resourceId);
          const filePath = path.join(directoryPath, `${resourceId}`);

          if (!this.saveResourceToFile(resourceId, filePath)) {
            success = false;
          }
        } catch (error) {
          this.logger.error(`Failed to export resource ${resourceId}`, {
            resourceId,
            directoryPath,
            error: error instanceof Error ? error.message : String(error),
          });
          success = false;
        }
      }

      return success;
    } catch (error) {
      this.logger.error(`Failed to export resources to directory ${directoryPath}`, {
        resourceIds,
        directoryPath,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  // Prompt-related methods
  getPrompt(promptName: string): string | PromptTemplate {
    if (!this.promptLibrary[promptName]) {
      const errorMsg = `Prompt "${promptName}" not found in library`;
      this.logger.error(errorMsg, { promptName });
      throw new Error(errorMsg);
    }

    return this.promptLibrary[promptName];
  }

  renderPrompt(promptName: string, params: Record<string, any> = {}): string {
    const prompt = this.getPrompt(promptName);

    if (typeof prompt === 'string') {
      // Simple template string replacement
      return this.interpolateTemplate(prompt, params);
    } else if (typeof prompt === 'function') {
      // Call the template function
      return prompt(params);
    }

    const error = `Invalid prompt type for "${promptName}"`;
    this.logger.error(error, { promptName, promptType: typeof prompt });
    throw new Error(error);
  }

  addPrompt(promptName: string, prompt: string | PromptTemplate): void {
    this.promptLibrary[promptName] = prompt;
    this.logger.debug(`Added prompt: ${promptName}`, { promptName });
  }

  updatePrompt(promptName: string, prompt: string | PromptTemplate): boolean {
    if (!this.promptLibrary[promptName]) {
      this.logger.warn(`Cannot update: Prompt "${promptName}" not found`, { promptName });
      return false;
    }

    this.promptLibrary[promptName] = prompt;
    this.logger.debug(`Updated prompt: ${promptName}`, { promptName });
    return true;
  }

  removePrompt(promptName: string): boolean {
    if (!this.promptLibrary[promptName]) {
      this.logger.warn(`Cannot remove: Prompt "${promptName}" not found`, { promptName });
      return false;
    }

    delete this.promptLibrary[promptName];
    this.logger.debug(`Removed prompt: ${promptName}`, { promptName });
    return true;
  }

  listPrompts(): string[] {
    return Object.keys(this.promptLibrary);
  }

  composePrompt(promptNames: string[], params: Record<string, any> = {}): string {
    try {
      return promptNames.map((name) => this.renderPrompt(name, params)).join('\n\n');
    } catch (error) {
      this.logger.error(`Error composing prompts`, {
        promptNames,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Error composing prompts: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Helper methods
  private interpolateTemplate(template: string, params: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return params[key] !== undefined ? String(params[key]) : `{{${key}}}`;
    });
  }

  private inferTypeFromFile(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();

    switch (extension) {
      case '.txt':
        return 'text';
      case '.json':
        return 'json';
      case '.md':
        return 'markdown';
      case '.yaml':
      case '.yml':
        return 'yaml';
      case '.csv':
        return 'csv';
      case '.prompt':
        return 'prompt';
      default:
        return 'unknown';
    }
  }
}
